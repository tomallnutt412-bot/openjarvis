"""CLI commands for Cloudflare Tunnel management."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

import click
import tomllib

from openjarvis.core.config import DEFAULT_CONFIG_PATH


def _configured_api_key() -> str:
    """Return the server API key from the environment or config, if any."""
    key = os.environ.get("OPENJARVIS_API_KEY", "").strip()
    if key:
        return key
    try:
        with open(DEFAULT_CONFIG_PATH, "rb") as handle:
            raw = tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError):
        return ""
    auth = raw.get("server", {}).get("auth", {})
    return str(auth.get("api_key", "")).strip() if isinstance(auth, dict) else ""


@click.group("tunnel", invoke_without_command=True)
@click.option("--port", default=8000, help="Local port to tunnel.")
@click.option(
    "--allow-no-auth",
    is_flag=True,
    default=False,
    help="Start even though no API key is configured (anyone with the link "
    "could use your assistant).",
)
@click.pass_context
def tunnel(ctx: click.Context, port: int, allow_no_auth: bool) -> None:
    """Start a Cloudflare tunnel or manage config."""
    if ctx.invoked_subcommand is not None:
        return
    # The tunnel puts the server on a public URL. Without an API key anyone
    # who finds that URL can chat with the agent and approve its actions
    # (sending email, invoices), so refuse unless the user opts out.
    if not _configured_api_key() and not allow_no_auth:
        click.echo(
            "Error: no API key is configured, so anyone with the tunnel link "
            "could use your assistant."
        )
        click.echo("Run `jarvis auth create-key`, restart `jarvis serve`, then retry.")
        click.echo("(Override with --allow-no-auth at your own risk.)")
        sys.exit(1)
    # Default behavior: start the tunnel
    if not shutil.which("cloudflared"):
        click.echo("Error: cloudflared is not installed.")
        click.echo(
            "Install it from: "
            "https://developers.cloudflare.com/"
            "cloudflare-one/connections/"
            "connect-networks/downloads/"
        )
        sys.exit(1)

    click.echo(f"Starting Cloudflare tunnel to localhost:{port}...")
    click.echo("Press Ctrl+C to stop.\n")

    try:
        subprocess.run(
            [
                "cloudflared",
                "tunnel",
                "--url",
                f"http://localhost:{port}",
            ],
            check=True,
        )
    except KeyboardInterrupt:
        click.echo("\nTunnel stopped.")
    except subprocess.CalledProcessError as e:
        click.echo(f"Tunnel failed: {e}")
        sys.exit(1)


@tunnel.command("status")
def status() -> None:
    """Show current tunnel configuration."""
    config_path = DEFAULT_CONFIG_PATH
    if not config_path.exists():
        click.echo("No config file found.")
        return

    content = config_path.read_text(encoding="utf-8")
    if "public_url" in content:
        for line in content.splitlines():
            if "public_url" in line:
                click.echo(f"Configured tunnel URL: {line.split('=', 1)[1].strip()}")
                return
    click.echo("No tunnel URL configured.")

    if shutil.which("cloudflared"):
        click.echo("cloudflared: installed")
    else:
        click.echo("cloudflared: not installed")
