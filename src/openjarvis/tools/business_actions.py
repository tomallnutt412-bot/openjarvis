"""Business actions Jarvis can carry out for the user: send emails and invoices.

Neither tool acts immediately. Each one validates the request, then queues it
in the shared :class:`~openjarvis.tools.approval_store.ApprovalStore` as a
high-tier action. Nothing is sent until the user taps *Approve* in the
dashboard's approval bell (``POST /v1/approvals/{id}/approve``), which runs
:func:`run_approved_action`. The model never gets a tool that approves or
executes, so a misheard voice command or a prompt injection in an email can
at most produce a draft the user sees and declines.

* ``email_send`` sends from the user's Gmail account (``jarvis connect gdrive``
  grants the ``gmail.modify`` scope, which covers sending).
* ``stripe_invoice`` creates a Stripe invoice, finalizes it and has Stripe
  email it to the customer with a payment link. It needs ``STRIPE_API_KEY``.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from email.message import EmailMessage
from typing import Any, Callable, Dict, List, Optional, Tuple

import httpx

from openjarvis.core.registry import ToolRegistry
from openjarvis.core.types import ToolResult
from openjarvis.tools._stubs import BaseTool, ToolSpec
from openjarvis.tools.approval_store import (
    STATUS_EXECUTED,
    STATUS_PENDING,
    TIER_HIGH,
    ApprovalStore,
    PendingAction,
)

logger = logging.getLogger(__name__)

ACTION_EMAIL_SEND = "email_send"
ACTION_STRIPE_INVOICE = "stripe_invoice_send"

#: Action types that are carried out the moment the user approves them.
SEND_ON_APPROVE_TYPES = frozenset({ACTION_EMAIL_SEND, ACTION_STRIPE_INVOICE})

#: Interim status while an approved action runs, so a second tap (or the
#: proactive agent's ``execute_pending_actions``) can never send it twice.
STATUS_SENDING = "sending"
STATUS_FAILED = "failed"

_EMAIL_RE = re.compile(r"^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$")
_MAX_RECIPIENTS = 20
_MAX_SUBJECT_CHARS = 300
_MAX_BODY_CHARS = 50_000
_MAX_INVOICE_ITEMS = 50
_APPROVAL_TTL_HOURS = 24

_GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
_STRIPE_API_BASE = "https://api.stripe.com/v1"

# Stripe amounts are integers in the currency's minor unit; these currencies
# have none (https://docs.stripe.com/currencies#zero-decimal).
_ZERO_DECIMAL_CURRENCIES = frozenset(
    {
        "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
        "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
    }
)  # fmt: skip
_CURRENCY_SYMBOLS = {"gbp": "£", "usd": "$", "eur": "€"}


class ActionError(RuntimeError):
    """A request that cannot be queued or carried out, with a user-safe reason."""


# ---------------------------------------------------------------------------
# Shared store
# ---------------------------------------------------------------------------

_store: Optional[ApprovalStore] = None


def get_store() -> ApprovalStore:
    """Return the process-wide approval store (same DB the dashboard reads)."""
    global _store
    if _store is None:
        _store = ApprovalStore()
    return _store


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def _clean_text(value: Any, field: str, *, max_chars: int, required: bool) -> str:
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise ActionError(f"'{field}' must be text.")
    text = value.strip()
    if required and not text:
        raise ActionError(f"'{field}' is required.")
    if len(text) > max_chars:
        raise ActionError(f"'{field}' is longer than {max_chars} characters.")
    return text


def _single_line(value: str, field: str) -> str:
    # Header injection guard: a subject or name must never contain newlines.
    if "\r" in value or "\n" in value:
        raise ActionError(f"'{field}' must be a single line.")
    return value


def _email_list(value: Any, field: str, *, required: bool) -> List[str]:
    if value is None or value == "":
        items: List[Any] = []
    elif isinstance(value, str):
        items = [part for part in re.split(r"[,;]", value)]
    elif isinstance(value, list):
        items = value
    else:
        raise ActionError(f"'{field}' must be an email address or a list of them.")
    emails: List[str] = []
    for item in items:
        if not isinstance(item, str):
            raise ActionError(f"'{field}' must contain email addresses.")
        address = item.strip()
        if not address:
            continue
        if not _EMAIL_RE.match(address):
            raise ActionError(f"'{address}' is not a valid email address.")
        if address.lower() not in {e.lower() for e in emails}:
            emails.append(address)
    if required and not emails:
        raise ActionError(f"'{field}' needs at least one email address.")
    if len(emails) > _MAX_RECIPIENTS:
        raise ActionError(f"'{field}' has more than {_MAX_RECIPIENTS} addresses.")
    return emails


def _currency(value: Any) -> str:
    code = value if isinstance(value, str) and value.strip() else ""
    code = (code or os.environ.get("JARVIS_INVOICE_CURRENCY", "") or "gbp").strip()
    code = code.lower()
    if not re.fullmatch(r"[a-z]{3}", code):
        raise ActionError(f"'{code}' is not a three-letter currency code.")
    return code


def _to_minor_units(amount: Decimal, currency: str) -> int:
    exponent = Decimal("1") if currency in _ZERO_DECIMAL_CURRENCIES else Decimal("0.01")
    quantized = amount.quantize(exponent, rounding=ROUND_HALF_UP)
    if currency in _ZERO_DECIMAL_CURRENCIES:
        return int(quantized)
    return int(quantized * 100)


def format_money(minor_units: int, currency: str) -> str:
    """Render minor units for people, e.g. ``(12550, 'gbp') -> '£125.50'``."""
    if currency in _ZERO_DECIMAL_CURRENCIES:
        text = f"{minor_units:,}"
    else:
        text = f"{Decimal(minor_units) / 100:,.2f}"
    symbol = _CURRENCY_SYMBOLS.get(currency)
    return f"{symbol}{text}" if symbol else f"{text} {currency.upper()}"


def _invoice_items(value: Any, currency: str) -> List[Dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise ActionError("'items' needs at least one line item.")
    if len(value) > _MAX_INVOICE_ITEMS:
        raise ActionError(f"An invoice can have at most {_MAX_INVOICE_ITEMS} items.")
    items: List[Dict[str, Any]] = []
    for index, raw in enumerate(value, start=1):
        if not isinstance(raw, dict):
            raise ActionError(f"Item {index} must be an object.")
        description = _single_line(
            _clean_text(
                raw.get("description"),
                f"items[{index}].description",
                max_chars=250,
                required=True,
            ),
            f"items[{index}].description",
        )
        quantity = raw.get("quantity", 1)
        if isinstance(quantity, bool) or not isinstance(quantity, (int, float, str)):
            raise ActionError(f"Item {index}: quantity must be a whole number.")
        try:
            qty_dec = Decimal(str(quantity))
        except InvalidOperation:
            raise ActionError(f"Item {index}: quantity must be a whole number.")
        if qty_dec != qty_dec.to_integral_value() or not 1 <= qty_dec <= 100_000:
            raise ActionError(f"Item {index}: quantity must be a whole number ≥ 1.")
        price = raw.get("unit_price")
        if isinstance(price, bool) or not isinstance(price, (int, float, str)):
            raise ActionError(f"Item {index}: unit_price must be a number.")
        try:
            price_dec = Decimal(str(price).replace(",", "").lstrip("£$€"))
        except InvalidOperation:
            raise ActionError(f"Item {index}: unit_price must be a number.")
        if not price_dec.is_finite() or price_dec <= 0:
            raise ActionError(f"Item {index}: unit_price must be more than zero.")
        unit_minor = _to_minor_units(price_dec, currency)
        if unit_minor <= 0:
            raise ActionError(f"Item {index}: unit_price is too small.")
        qty = int(qty_dec)
        items.append(
            {
                "description": description,
                "quantity": qty,
                "unit_amount": unit_minor,
                "amount": unit_minor * qty,
            }
        )
    return items


# ---------------------------------------------------------------------------
# Gmail
# ---------------------------------------------------------------------------


def _gmail_credentials_path() -> str:
    from openjarvis.connectors.gmail import GmailConnector

    connector = GmailConnector()
    if not connector.is_connected():
        raise ActionError(
            "Gmail is not connected. Run `jarvis connect gdrive` on the computer "
            "running Jarvis, then try again."
        )
    return connector._credentials_path


def build_email_message(payload: Dict[str, Any]) -> EmailMessage:
    """Build the MIME message for an ``email_send`` payload."""
    message = EmailMessage()
    message["To"] = ", ".join(payload["to"])
    if payload.get("cc"):
        message["Cc"] = ", ".join(payload["cc"])
    message["Subject"] = payload["subject"]
    message.set_content(payload["body"])
    return message


def _gmail_api_send(token: str, raw: str) -> Dict[str, Any]:
    response = httpx.post(
        _GMAIL_SEND_URL,
        headers={"Authorization": f"Bearer {token}"},
        json={"raw": raw},
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()


def execute_email_send(payload: Dict[str, Any]) -> Tuple[bool, str]:
    """Send an approved ``email_send`` action through the Gmail API."""
    from openjarvis.connectors.google_auth import call_with_refresh

    credentials_path = _gmail_credentials_path()
    message = build_email_message(payload)
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")
    try:
        call_with_refresh(_gmail_api_send, credentials_path, raw)
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status == 403:
            return False, (
                "Gmail refused to send (HTTP 403). Reconnect Google with "
                "`jarvis connect gdrive` so Jarvis has permission to send."
            )
        return False, f"Gmail could not send the email (HTTP {status})."
    except httpx.HTTPError as exc:
        return False, f"Could not reach Gmail ({type(exc).__name__})."
    return True, f"Email sent to {', '.join(payload['to'])}."


# ---------------------------------------------------------------------------
# Stripe
# ---------------------------------------------------------------------------


def _stripe_key() -> str:
    key = os.environ.get("STRIPE_API_KEY", "").strip()
    if not key:
        raise ActionError(
            "Stripe is not set up. Set STRIPE_API_KEY on the computer running "
            "Jarvis (a restricted key with Invoices and Customers write access)."
        )
    return key


def _stripe_request(
    method: str,
    path: str,
    key: str,
    *,
    data: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None,
    idempotency_key: str = "",
) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {key}"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    try:
        response = httpx.request(
            method,
            f"{_STRIPE_API_BASE}{path}",
            headers=headers,
            data=data,
            params=params,
            timeout=30.0,
        )
    except httpx.HTTPError as exc:
        raise ActionError(f"Could not reach Stripe ({type(exc).__name__}).") from None
    if response.status_code >= 400:
        detail = ""
        try:
            error = response.json().get("error", {})
            detail = str(error.get("message", ""))[:300]
        except Exception:
            pass
        raise ActionError(
            f"Stripe rejected the request (HTTP {response.status_code})"
            + (f": {detail}" if detail else ".")
        )
    return response.json()


def execute_stripe_invoice(
    payload: Dict[str, Any], *, action_id: str = ""
) -> Tuple[bool, str]:
    """Create, finalize and email an approved Stripe invoice."""
    key = _stripe_key()
    # Idempotency keys make a retried approval reuse Stripe's earlier result
    # instead of creating a second customer, invoice or line item.
    idem = f"openjarvis-{action_id}" if action_id else ""

    def _idem(step: str) -> str:
        return f"{idem}-{step}" if idem else ""

    currency = payload["currency"]
    found = _stripe_request(
        "GET",
        "/customers",
        key,
        params={"email": payload["customer_email"], "limit": 1},
    )
    customers = found.get("data") or []
    if customers:
        customer_id = customers[0]["id"]
    else:
        customer_data = {"email": payload["customer_email"]}
        if payload.get("customer_name"):
            customer_data["name"] = payload["customer_name"]
        customer_id = _stripe_request(
            "POST", "/customers", key, data=customer_data, idempotency_key=_idem("cus")
        )["id"]

    invoice_data: Dict[str, Any] = {
        "customer": customer_id,
        "collection_method": "send_invoice",
        "days_until_due": payload["days_until_due"],
        "currency": currency,
        "auto_advance": "false",
        "pending_invoice_items_behavior": "exclude",
    }
    if payload.get("memo"):
        invoice_data["description"] = payload["memo"]
    invoice = _stripe_request(
        "POST", "/invoices", key, data=invoice_data, idempotency_key=_idem("inv")
    )
    invoice_id = invoice["id"]

    for index, item in enumerate(payload["items"]):
        description = item["description"]
        if item["quantity"] > 1:
            description = (
                f"{description} ({item['quantity']} × "
                f"{format_money(item['unit_amount'], currency)})"
            )
        _stripe_request(
            "POST",
            "/invoiceitems",
            key,
            data={
                "customer": customer_id,
                "invoice": invoice_id,
                "currency": currency,
                "amount": item["amount"],
                "description": description,
            },
            idempotency_key=_idem(f"item{index}"),
        )

    finalized = _stripe_request(
        "POST",
        f"/invoices/{invoice_id}/finalize",
        key,
        data={"auto_advance": "false"},
        idempotency_key=_idem("fin"),
    )
    sent = _stripe_request(
        "POST", f"/invoices/{invoice_id}/send", key, idempotency_key=_idem("send")
    )
    number = sent.get("number") or finalized.get("number") or invoice_id
    total = sent.get("total", finalized.get("total", payload["total"]))
    link = sent.get("hosted_invoice_url") or finalized.get("hosted_invoice_url") or ""
    message = (
        f"Invoice {number} for {format_money(int(total), currency)} sent to "
        f"{payload['customer_email']}."
    )
    if link:
        message += f" Payment page: {link}"
    return True, message


# ---------------------------------------------------------------------------
# Approval → execution
# ---------------------------------------------------------------------------


def _is_expired(action: PendingAction) -> bool:
    try:
        expires = datetime.fromisoformat(action.expires_at)
    except (TypeError, ValueError):
        return False
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return expires <= datetime.now(timezone.utc)


def claim_for_sending(store: ApprovalStore, action_id: str) -> PendingAction:
    """Atomically move a pending send-on-approve action to ``sending``.

    Raises :class:`ActionError` if it is missing, expired or already handled,
    so a double tap on *Approve* can never send twice.
    """
    action = store.get_action(action_id)
    if action is None:
        raise ActionError("That request no longer exists.")
    if action.action_type not in SEND_ON_APPROVE_TYPES:
        raise ActionError("That request is not an email or invoice.")
    if action.status != STATUS_PENDING:
        raise ActionError(f"That request is already {action.status}.")
    if _is_expired(action):
        raise ActionError("That request expired. Ask Jarvis to prepare it again.")
    now = datetime.now(timezone.utc).isoformat()
    cur = store._conn.execute(
        "UPDATE pending_actions SET status = ?, decision_at = ? "
        "WHERE id = ? AND status = ?",
        (STATUS_SENDING, now, action_id, STATUS_PENDING),
    )
    store._conn.commit()
    if cur.rowcount != 1:
        raise ActionError("That request is already being handled.")
    return action


def dispatch_action(action: PendingAction) -> Tuple[bool, str]:
    """Carry out an approved business action. Never raises."""
    try:
        if action.action_type == ACTION_EMAIL_SEND:
            return execute_email_send(action.payload)
        if action.action_type == ACTION_STRIPE_INVOICE:
            return execute_stripe_invoice(action.payload, action_id=action.id)
        return False, f"No executor for action type '{action.action_type}'."
    except ActionError as exc:
        return False, str(exc)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Business action %s failed", action.id)
        return False, f"Unexpected error ({type(exc).__name__})."


def run_approved_action(
    store: ApprovalStore,
    action_id: str,
    *,
    dispatcher: Callable[[PendingAction], Tuple[bool, str]] = dispatch_action,
) -> Dict[str, Any]:
    """Claim, execute and record a send-on-approve action for the dashboard."""
    action = claim_for_sending(store, action_id)
    ok, message = dispatcher(action)
    store.update_status(action_id, STATUS_EXECUTED if ok else STATUS_FAILED)
    logger.info(
        "Business action %s (%s) %s", action_id, action.action_type,
        "executed" if ok else "failed",
    )  # fmt: skip
    return {
        "id": action_id,
        "status": "executed" if ok else "failed",
        "success": ok,
        "message": message,
    }


# ---------------------------------------------------------------------------
# Tools the agent can call (they only ever queue a request)
# ---------------------------------------------------------------------------

_QUEUED_GUIDANCE = (
    "NOT SENT YET. It is waiting for the user's approval. Read the details "
    "back to the user in one short sentence and tell them to tap Approve on "
    "the bell icon at the top right of the dashboard. Do not say it has been "
    "sent."
)


def _queued_result(tool: str, action: PendingAction, summary: str) -> ToolResult:
    return ToolResult(
        tool_name=tool,
        success=True,
        content=json.dumps(
            {
                "status": "awaiting_approval",
                "approval_id": action.id,
                "summary": summary,
                "next_step": _QUEUED_GUIDANCE,
            }
        ),
        metadata={"action_id": action.id, "status": action.status},
    )


def _rejected(tool: str, reason: str) -> ToolResult:
    return ToolResult(
        tool_name=tool,
        success=False,
        content=f"Could not prepare this: {reason}",
        metadata={"status": "rejected"},
    )


@ToolRegistry.register("email_send")
class EmailSendTool(BaseTool):
    """Draft an email from the user's Gmail; sends only after they approve it."""

    tool_id = "email_send"
    is_local = False

    def __init__(self, store: Optional[ApprovalStore] = None) -> None:
        self._store = store

    @property
    def spec(self) -> ToolSpec:
        return ToolSpec(
            name="email_send",
            description=(
                "Prepare an email to send from the user's Gmail account. The "
                "email is NOT sent by this call: it is queued for the user to "
                "approve in the dashboard, and is sent only when they tap "
                "Approve. Use the user's exact recipient address; if you do "
                "not know it, ask for it instead of guessing."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "to": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Recipient email addresses.",
                    },
                    "subject": {"type": "string", "description": "Subject line."},
                    "body": {
                        "type": "string",
                        "description": "Plain-text body, written in full.",
                    },
                    "cc": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional CC addresses.",
                    },
                },
                "required": ["to", "subject", "body"],
            },
            category="communication",
            timeout_seconds=30.0,
        )

    def execute(self, **params: Any) -> ToolResult:
        try:
            to = _email_list(params.get("to"), "to", required=True)
            cc = _email_list(params.get("cc"), "cc", required=False)
            subject = _single_line(
                _clean_text(
                    params.get("subject"),
                    "subject",
                    max_chars=_MAX_SUBJECT_CHARS,
                    required=True,
                ),
                "subject",
            )
            body = _clean_text(
                params.get("body"), "body", max_chars=_MAX_BODY_CHARS, required=True
            )
            _gmail_credentials_path()
        except ActionError as exc:
            return _rejected(self.spec.name, str(exc))

        summary = f'Email to {", ".join(to)}: "{subject}"'
        payload = {"to": to, "cc": cc, "subject": subject, "body": body}
        action = (self._store or get_store()).queue_action(
            action_type=ACTION_EMAIL_SEND,
            description=summary,
            payload=payload,
            permission_key=f"{ACTION_EMAIL_SEND}:{','.join(sorted(to))}",
            tier=TIER_HIGH,
            ttl_hours=_APPROVAL_TTL_HOURS,
        )
        return _queued_result(self.spec.name, action, summary)


@ToolRegistry.register("stripe_invoice")
class StripeInvoiceTool(BaseTool):
    """Draft a Stripe invoice; Stripe emails it only after the user approves."""

    tool_id = "stripe_invoice"
    is_local = False

    def __init__(self, store: Optional[ApprovalStore] = None) -> None:
        self._store = store

    @property
    def spec(self) -> ToolSpec:
        return ToolSpec(
            name="stripe_invoice",
            description=(
                "Prepare a Stripe invoice for a customer. The invoice is NOT "
                "created or sent by this call: it is queued for the user to "
                "approve in the dashboard. When approved, Stripe creates the "
                "invoice and emails it to the customer with an online payment "
                "link. Prices are per unit in normal money (e.g. 125.50), not "
                "pence or cents. Ask the user for anything missing (customer "
                "email, items or prices) instead of guessing."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "customer_email": {
                        "type": "string",
                        "description": "Customer email (Stripe sends it here).",
                    },
                    "customer_name": {
                        "type": "string",
                        "description": "Customer or company name.",
                    },
                    "items": {
                        "type": "array",
                        "description": "Line items on the invoice.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "description": {"type": "string"},
                                "quantity": {"type": "integer", "minimum": 1},
                                "unit_price": {
                                    "type": "number",
                                    "description": "Price per unit, e.g. 125.50.",
                                },
                            },
                            "required": ["description", "unit_price"],
                        },
                    },
                    "currency": {
                        "type": "string",
                        "description": "Three-letter code, default gbp.",
                    },
                    "days_until_due": {
                        "type": "integer",
                        "description": "Days the customer has to pay (default 14).",
                    },
                    "memo": {
                        "type": "string",
                        "description": "Optional note shown on the invoice.",
                    },
                },
                "required": ["customer_email", "items"],
            },
            category="finance",
            timeout_seconds=30.0,
        )

    def execute(self, **params: Any) -> ToolResult:
        try:
            emails = _email_list(
                params.get("customer_email"), "customer_email", required=True
            )
            if len(emails) != 1:
                raise ActionError("An invoice goes to exactly one customer email.")
            customer_name = _single_line(
                _clean_text(
                    params.get("customer_name"),
                    "customer_name",
                    max_chars=200,
                    required=False,
                ),
                "customer_name",
            )
            currency = _currency(params.get("currency"))
            items = _invoice_items(params.get("items"), currency)
            days = params.get("days_until_due", 14)
            if isinstance(days, bool) or not isinstance(days, (int, float, str)):
                raise ActionError("'days_until_due' must be a whole number.")
            try:
                days_int = int(str(days))
            except ValueError:
                raise ActionError("'days_until_due' must be a whole number.")
            if not 0 <= days_int <= 365:
                raise ActionError("'days_until_due' must be between 0 and 365.")
            memo = _clean_text(
                params.get("memo"), "memo", max_chars=500, required=False
            )
            _stripe_key()
        except ActionError as exc:
            return _rejected(self.spec.name, str(exc))

        total = sum(item["amount"] for item in items)
        who = f"{customer_name} <{emails[0]}>" if customer_name else emails[0]
        count = len(items)
        summary = (
            f"Stripe invoice to {who} for {format_money(total, currency)} "
            f"({count} item{'s' if count != 1 else ''}), due in {days_int} days"
        )
        payload = {
            "customer_email": emails[0],
            "customer_name": customer_name,
            "currency": currency,
            "items": items,
            "total": total,
            "days_until_due": days_int,
            "memo": memo,
        }
        action = (self._store or get_store()).queue_action(
            action_type=ACTION_STRIPE_INVOICE,
            description=summary,
            payload=payload,
            permission_key=f"{ACTION_STRIPE_INVOICE}:{emails[0].lower()}",
            tier=TIER_HIGH,
            ttl_hours=_APPROVAL_TTL_HOURS,
        )
        return _queued_result(self.spec.name, action, summary)


__all__ = [
    "ACTION_EMAIL_SEND",
    "ACTION_STRIPE_INVOICE",
    "ActionError",
    "EmailSendTool",
    "SEND_ON_APPROVE_TYPES",
    "StripeInvoiceTool",
    "build_email_message",
    "claim_for_sending",
    "dispatch_action",
    "format_money",
    "run_approved_action",
]
