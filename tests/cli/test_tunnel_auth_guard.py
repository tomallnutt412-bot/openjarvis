"""`jarvis tunnel` must not expose the server publicly without an API key."""

from __future__ import annotations

from unittest import mock

from click.testing import CliRunner

from openjarvis.cli import tunnel_cmd


def _run(monkeypatch, tmp_path, *, env_key="", config_text=None, args=()):
    config = tmp_path / "config.toml"
    if config_text is not None:
        config.write_text(config_text, encoding="utf-8")
    monkeypatch.setattr(tunnel_cmd, "DEFAULT_CONFIG_PATH", config)
    if env_key:
        monkeypatch.setenv("OPENJARVIS_API_KEY", env_key)
    else:
        monkeypatch.delenv("OPENJARVIS_API_KEY", raising=False)
    with (
        mock.patch.object(tunnel_cmd.shutil, "which", return_value="/bin/cloudflared"),
        mock.patch.object(tunnel_cmd.subprocess, "run") as run,
    ):
        result = CliRunner().invoke(tunnel_cmd.tunnel, list(args))
    return result, run


def test_refuses_without_api_key(monkeypatch, tmp_path):
    result, run = _run(monkeypatch, tmp_path)
    assert result.exit_code == 1
    assert "jarvis auth create-key" in result.output
    run.assert_not_called()


def test_starts_with_env_key(monkeypatch, tmp_path):
    result, run = _run(monkeypatch, tmp_path, env_key="secret")
    assert result.exit_code == 0, result.output
    run.assert_called_once()


def test_starts_with_config_key(monkeypatch, tmp_path):
    result, run = _run(
        monkeypatch, tmp_path, config_text='[server.auth]\napi_key = "oj_sk_x"\n'
    )
    assert result.exit_code == 0, result.output
    run.assert_called_once()


def test_override_flag(monkeypatch, tmp_path):
    result, run = _run(monkeypatch, tmp_path, args=["--allow-no-auth"])
    assert result.exit_code == 0, result.output
    run.assert_called_once()
