"""Email and Stripe invoice actions: queued by Jarvis, sent only on approval."""

from __future__ import annotations

import base64
import email
import json
from datetime import datetime, timedelta, timezone
from email import policy
from typing import Any, Dict, List

import httpx
import pytest

from openjarvis.tools import business_actions as ba
from openjarvis.tools.approval_store import (
    STATUS_EXECUTED,
    STATUS_PENDING,
    TIER_HIGH,
    ApprovalStore,
)


@pytest.fixture
def store(tmp_path):
    s = ApprovalStore(db_path=str(tmp_path / "approvals.db"))
    yield s
    s.close()


@pytest.fixture
def gmail_connected(monkeypatch):
    monkeypatch.setattr(ba, "_gmail_credentials_path", lambda: "/tmp/gmail.json")


@pytest.fixture
def stripe_key(monkeypatch):
    monkeypatch.setenv("STRIPE_API_KEY", "rk_test_dummy")
    monkeypatch.delenv("JARVIS_INVOICE_CURRENCY", raising=False)


def _invoice_params(**overrides: Any) -> Dict[str, Any]:
    params: Dict[str, Any] = {
        "customer_email": "accounts@acme.co.uk",
        "customer_name": "Acme Ltd",
        "items": [
            {"description": "Website design", "quantity": 1, "unit_price": 750},
            {"description": "Hosting (monthly)", "quantity": 3, "unit_price": "19.99"},
        ],
    }
    params.update(overrides)
    return params


# ---------------------------------------------------------------------------
# email_send: validation and queueing
# ---------------------------------------------------------------------------


class TestEmailSendTool:
    def test_queues_for_approval_without_sending(self, store, gmail_connected):
        result = ba.EmailSendTool(store=store).execute(
            to=["sam@example.com"],
            subject="Thursday",
            body="Hi Sam,\n\nStill on for Thursday?\n\nTom",
        )
        assert result.success
        content = json.loads(result.content)
        assert content["status"] == "awaiting_approval"
        assert "NOT SENT" in content["next_step"]

        pending = store.list_pending()
        assert len(pending) == 1
        action = pending[0]
        assert action.action_type == ba.ACTION_EMAIL_SEND
        assert action.tier == TIER_HIGH
        assert action.status == STATUS_PENDING
        assert action.payload["to"] == ["sam@example.com"]
        assert action.payload["body"].startswith("Hi Sam")

    def test_accepts_comma_separated_string(self, store, gmail_connected):
        result = ba.EmailSendTool(store=store).execute(
            to="a@example.com, b@example.com", subject="Hi", body="Hello"
        )
        assert result.success
        assert store.list_pending()[0].payload["to"] == [
            "a@example.com",
            "b@example.com",
        ]

    @pytest.mark.parametrize(
        "params, reason",
        [
            ({"to": ["not-an-address"], "subject": "s", "body": "b"}, "valid email"),
            ({"to": [], "subject": "s", "body": "b"}, "at least one"),
            ({"to": ["a@b.com"], "subject": "", "body": "b"}, "'subject' is required"),
            ({"to": ["a@b.com"], "subject": "s", "body": "  "}, "'body' is required"),
            (
                {"to": ["a@b.com"], "subject": "hi\nBcc: x@evil.com", "body": "b"},
                "single line",
            ),
        ],
    )
    def test_rejects_bad_input(self, store, gmail_connected, params, reason):
        result = ba.EmailSendTool(store=store).execute(**params)
        assert not result.success
        assert reason in result.content
        assert store.list_pending() == []

    def test_rejects_when_gmail_not_connected(self, store, monkeypatch):
        def _missing():
            raise ba.ActionError("Gmail is not connected.")

        monkeypatch.setattr(ba, "_gmail_credentials_path", _missing)
        result = ba.EmailSendTool(store=store).execute(
            to=["a@b.com"], subject="s", body="b"
        )
        assert not result.success
        assert "Gmail is not connected" in result.content
        assert store.list_pending() == []


# ---------------------------------------------------------------------------
# stripe_invoice: validation and queueing
# ---------------------------------------------------------------------------


class TestStripeInvoiceTool:
    def test_queues_with_totals_in_minor_units(self, store, stripe_key):
        result = ba.StripeInvoiceTool(store=store).execute(**_invoice_params())
        assert result.success
        summary = json.loads(result.content)["summary"]
        assert "£809.97" in summary
        assert "Acme Ltd <accounts@acme.co.uk>" in summary

        action = store.list_pending()[0]
        assert action.action_type == ba.ACTION_STRIPE_INVOICE
        assert action.tier == TIER_HIGH
        payload = action.payload
        assert payload["currency"] == "gbp"
        assert payload["days_until_due"] == 14
        assert payload["items"][0]["amount"] == 75000
        assert payload["items"][1] == {
            "description": "Hosting (monthly)",
            "quantity": 3,
            "unit_amount": 1999,
            "amount": 5997,
        }
        assert payload["total"] == 80997

    def test_zero_decimal_currency(self, store, stripe_key):
        ba.StripeInvoiceTool(store=store).execute(
            **_invoice_params(
                currency="JPY",
                items=[
                    {"description": "Consulting", "quantity": 2, "unit_price": 5000}
                ],
            )
        )
        payload = store.list_pending()[0].payload
        assert payload["currency"] == "jpy"
        assert payload["total"] == 10000

    @pytest.mark.parametrize(
        "overrides, reason",
        [
            ({"customer_email": "nope"}, "valid email"),
            ({"customer_email": "a@b.com, c@d.com"}, "exactly one"),
            ({"items": []}, "at least one line item"),
            ({"items": [{"description": "x", "unit_price": 0}]}, "more than zero"),
            ({"items": [{"description": "x", "unit_price": -5}]}, "more than zero"),
            ({"items": [{"description": "x", "unit_price": "abc"}]}, "number"),
            (
                {"items": [{"description": "x", "quantity": 1.5, "unit_price": 5}]},
                "whole number",
            ),
            ({"items": [{"unit_price": 5}]}, "description' is required"),
            ({"currency": "pounds"}, "currency code"),
            ({"days_until_due": 900}, "between 0 and 365"),
        ],
    )
    def test_rejects_bad_input(self, store, stripe_key, overrides, reason):
        result = ba.StripeInvoiceTool(store=store).execute(
            **_invoice_params(**overrides)
        )
        assert not result.success
        assert reason in result.content
        assert store.list_pending() == []

    def test_rejects_without_stripe_key(self, store, monkeypatch):
        monkeypatch.delenv("STRIPE_API_KEY", raising=False)
        result = ba.StripeInvoiceTool(store=store).execute(**_invoice_params())
        assert not result.success
        assert "STRIPE_API_KEY" in result.content
        assert store.list_pending() == []


# ---------------------------------------------------------------------------
# Approval → execution
# ---------------------------------------------------------------------------


def _queue_email(store) -> str:
    return store.queue_action(
        action_type=ba.ACTION_EMAIL_SEND,
        description="Email to a@b.com",
        payload={"to": ["a@b.com"], "cc": [], "subject": "s", "body": "b"},
        permission_key="email_send:a@b.com",
        tier=TIER_HIGH,
    ).id


class TestRunApprovedAction:
    def test_success_marks_executed(self, store):
        action_id = _queue_email(store)
        calls: List[str] = []

        def dispatcher(action):
            calls.append(action.id)
            return True, "Email sent to a@b.com."

        result = ba.run_approved_action(store, action_id, dispatcher=dispatcher)
        assert result == {
            "id": action_id,
            "status": "executed",
            "success": True,
            "message": "Email sent to a@b.com.",
        }
        assert calls == [action_id]
        assert store.get_action(action_id).status == STATUS_EXECUTED

    def test_second_approval_never_sends_twice(self, store):
        action_id = _queue_email(store)
        calls: List[str] = []

        def dispatcher(action):
            calls.append(action.id)
            return True, "sent"

        ba.run_approved_action(store, action_id, dispatcher=dispatcher)
        with pytest.raises(ba.ActionError, match="already"):
            ba.run_approved_action(store, action_id, dispatcher=dispatcher)
        assert calls == [action_id]

    def test_failure_marks_failed_and_reports(self, store):
        action_id = _queue_email(store)
        result = ba.run_approved_action(
            store, action_id, dispatcher=lambda a: (False, "Gmail said no")
        )
        assert result["success"] is False
        assert result["message"] == "Gmail said no"
        assert store.get_action(action_id).status == ba.STATUS_FAILED

    def test_expired_request_is_refused(self, store):
        action_id = _queue_email(store)
        past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        store._conn.execute(
            "UPDATE pending_actions SET expires_at = ? WHERE id = ?", (past, action_id)
        )
        store._conn.commit()
        with pytest.raises(ba.ActionError, match="expired"):
            ba.run_approved_action(store, action_id, dispatcher=lambda a: (True, ""))

    def test_other_action_types_are_refused(self, store):
        action_id = store.queue_action(
            action_type="email_delete",
            description="d",
            payload={},
            permission_key="k",
            tier=TIER_HIGH,
        ).id
        with pytest.raises(ba.ActionError):
            ba.run_approved_action(store, action_id, dispatcher=lambda a: (True, ""))

    def test_sending_actions_are_invisible_to_the_proactive_executor(self, store):
        action_id = _queue_email(store)
        ba.claim_for_sending(store, action_id)
        assert store.list_approved() == []
        assert store.list_pending() == []


# ---------------------------------------------------------------------------
# Gmail send
# ---------------------------------------------------------------------------


def test_execute_email_send_posts_raw_message(monkeypatch, gmail_connected):
    sent: Dict[str, Any] = {}

    def fake_call_with_refresh(fn, credentials_path, raw):
        sent["path"] = credentials_path
        sent["raw"] = raw
        return {"id": "msg1"}

    monkeypatch.setattr(
        "openjarvis.connectors.google_auth.call_with_refresh", fake_call_with_refresh
    )
    ok, message = ba.execute_email_send(
        {
            "to": ["sam@example.com"],
            "cc": ["boss@example.com"],
            "subject": "Invoice attached",
            "body": "Hi Sam,\nPlease find it attached.\nTom",
        }
    )
    assert ok, message
    assert sent["path"] == "/tmp/gmail.json"
    parsed = email.message_from_bytes(
        base64.urlsafe_b64decode(sent["raw"]), policy=policy.default
    )
    assert parsed["To"] == "sam@example.com"
    assert parsed["Cc"] == "boss@example.com"
    assert parsed["Subject"] == "Invoice attached"
    assert "Please find it attached." in parsed.get_content()


def test_execute_email_send_reports_permission_error(monkeypatch, gmail_connected):
    def fake_call_with_refresh(fn, credentials_path, raw):
        request = httpx.Request("POST", ba._GMAIL_SEND_URL)
        raise httpx.HTTPStatusError(
            "forbidden", request=request, response=httpx.Response(403, request=request)
        )

    monkeypatch.setattr(
        "openjarvis.connectors.google_auth.call_with_refresh", fake_call_with_refresh
    )
    ok, message = ba.execute_email_send(
        {"to": ["a@b.com"], "cc": [], "subject": "s", "body": "b"}
    )
    assert not ok
    assert "jarvis connect gdrive" in message


# ---------------------------------------------------------------------------
# Stripe invoice
# ---------------------------------------------------------------------------


class _FakeStripe:
    def __init__(self, existing_customer: bool) -> None:
        self.existing_customer = existing_customer
        self.calls: List[Dict[str, Any]] = []

    def __call__(self, method, url, *, headers, data=None, params=None, timeout):
        path = url.removeprefix(ba._STRIPE_API_BASE)
        self.calls.append(
            {"method": method, "path": path, "data": data, "params": params,
             "headers": headers}
        )  # fmt: skip
        request = httpx.Request(method, url)
        if path == "/customers" and method == "GET":
            data_list = [{"id": "cus_old"}] if self.existing_customer else []
            body: Dict[str, Any] = {"data": data_list}
        elif path == "/customers":
            body = {"id": "cus_new"}
        elif path == "/invoices":
            body = {"id": "in_123"}
        elif path == "/invoiceitems":
            body = {"id": f"ii_{len(self.calls)}"}
        elif path.endswith("/finalize"):
            body = {"id": "in_123", "number": "ABC-0001", "total": 80997}
        elif path.endswith("/send"):
            body = {
                "id": "in_123",
                "number": "ABC-0001",
                "total": 80997,
                "hosted_invoice_url": "https://invoice.stripe.com/i/abc",
            }
        else:  # pragma: no cover
            return httpx.Response(
                404, json={"error": {"message": "?"}}, request=request
            )
        return httpx.Response(200, json=body, request=request)


def _queued_invoice_payload(store) -> Dict[str, Any]:
    ba.StripeInvoiceTool(store=store).execute(**_invoice_params(memo="Thanks!"))
    return store.list_pending()[0].payload


def test_execute_stripe_invoice_creates_finalizes_and_sends(
    monkeypatch, store, stripe_key
):
    fake = _FakeStripe(existing_customer=False)
    monkeypatch.setattr(httpx, "request", fake)
    payload = _queued_invoice_payload(store)

    ok, message = ba.execute_stripe_invoice(payload, action_id="act1")

    assert ok
    assert "ABC-0001" in message and "£809.97" in message
    assert "https://invoice.stripe.com/i/abc" in message
    steps = [(c["method"], c["path"]) for c in fake.calls]
    assert steps == [
        ("GET", "/customers"),
        ("POST", "/customers"),
        ("POST", "/invoices"),
        ("POST", "/invoiceitems"),
        ("POST", "/invoiceitems"),
        ("POST", "/invoices/in_123/finalize"),
        ("POST", "/invoices/in_123/send"),
    ]
    invoice = fake.calls[2]["data"]
    assert invoice["customer"] == "cus_new"
    assert invoice["collection_method"] == "send_invoice"
    assert invoice["currency"] == "gbp"
    assert invoice["description"] == "Thanks!"
    items = [c["data"] for c in fake.calls if c["path"] == "/invoiceitems"]
    assert [i["amount"] for i in items] == [75000, 5997]
    assert items[1]["description"] == "Hosting (monthly) (3 × £19.99)"
    # Every write is idempotent so a retry can't double-bill.
    writes = [c for c in fake.calls if c["method"] == "POST"]
    keys = [c["headers"].get("Idempotency-Key") for c in writes]
    assert all(k and k.startswith("openjarvis-act1-") for k in keys)
    assert len(set(keys)) == len(keys)
    assert all(
        c["headers"]["Authorization"] == "Bearer rk_test_dummy" for c in fake.calls
    )


def test_execute_stripe_invoice_reuses_existing_customer(
    monkeypatch, store, stripe_key
):
    fake = _FakeStripe(existing_customer=True)
    monkeypatch.setattr(httpx, "request", fake)
    ok, _ = ba.execute_stripe_invoice(_queued_invoice_payload(store), action_id="a")
    assert ok
    assert ("POST", "/customers") not in [(c["method"], c["path"]) for c in fake.calls]
    assert fake.calls[1]["data"]["customer"] == "cus_old"


def test_stripe_error_message_is_reported(monkeypatch, store, stripe_key):
    def failing(method, url, **kwargs):
        request = httpx.Request(method, url)
        return httpx.Response(
            402,
            json={"error": {"message": "Your account cannot send invoices."}},
            request=request,
        )

    monkeypatch.setattr(httpx, "request", failing)
    payload = _queued_invoice_payload(store)
    action_id = store.list_pending()[0].id
    result = ba.run_approved_action(store, action_id)
    assert result["success"] is False
    assert "Your account cannot send invoices." in result["message"]
    assert "rk_test_dummy" not in result["message"]
    assert payload["total"] == 80997


def test_format_money():
    assert ba.format_money(80997, "gbp") == "£809.97"
    assert ba.format_money(123456, "usd") == "$1,234.56"
    assert ba.format_money(5000, "jpy") == "5,000 JPY"
    assert ba.format_money(1050, "chf") == "10.50 CHF"
