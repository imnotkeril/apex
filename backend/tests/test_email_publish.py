"""Email publisher: SMTP delivery behind _send_smtp, mocked (no real mail server)."""

import pytest

from app.modules.content.services import publish


def _secrets(monkeypatch, values: dict[str, str]):
    async def fake_get_secret(_org, key):
        return values.get(key, "")

    monkeypatch.setattr(publish, "get_secret", fake_get_secret)


FULL = {
    "smtp_host": "smtp.example.test",
    "smtp_port": "587",
    "smtp_user": "u",
    "smtp_password": "p",
    "smtp_from": "APEX <apex@example.test>",
    "email_recipients": "a@example.test; b@example.test",
}


@pytest.mark.asyncio
async def test_publish_to_email_builds_and_sends_message(monkeypatch):
    _secrets(monkeypatch, FULL)
    sent = {}
    monkeypatch.setattr(publish, "_send_smtp", lambda cfg, msg: sent.update(cfg=cfg, msg=msg))
    out = await publish.publish_to_email("Body text", subject="Weekly", html="<p>Body</p>")
    msg = sent["msg"]
    assert msg["Subject"] == "Weekly"
    assert msg["To"] == "a@example.test, b@example.test"
    assert msg.get_body(("plain",)).get_content().strip() == "Body text"
    assert "<p>Body</p>" in msg.get_body(("html",)).get_content()
    assert sent["cfg"]["host"] == "smtp.example.test" and sent["cfg"]["port"] == "587"
    assert out["platform_post_id"] == msg["Message-ID"] and out["post_url"] is None


@pytest.mark.asyncio
async def test_publish_to_email_defaults_subject_to_first_line(monkeypatch):
    _secrets(monkeypatch, FULL)
    sent = {}
    monkeypatch.setattr(publish, "_send_smtp", lambda cfg, msg: sent.update(msg=msg))
    await publish.publish_to_email("First line\nsecond")
    assert sent["msg"]["Subject"] == "First line"


@pytest.mark.asyncio
@pytest.mark.parametrize("missing", ["smtp_host", "smtp_from", "email_recipients"])
async def test_publish_to_email_requires_config(monkeypatch, missing):
    _secrets(monkeypatch, {k: v for k, v in FULL.items() if k != missing})
    monkeypatch.setattr(publish, "_send_smtp", lambda *_: pytest.fail("must not send"))
    with pytest.raises(RuntimeError, match="Email needs"):
        await publish.publish_to_email("x")


@pytest.mark.asyncio
async def test_publish_to_email_rejects_bad_port(monkeypatch):
    _secrets(monkeypatch, {**FULL, "smtp_port": "abc"})
    with pytest.raises(RuntimeError, match="port"):
        await publish.publish_to_email("x")


def test_send_smtp_uses_ssl_on_465_and_starttls_otherwise(monkeypatch):
    calls = []

    class FakeSMTP:
        def __init__(self, host, port, **kw):
            calls.append(("init", type(self).__name__, port))

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def starttls(self, **kw):
            calls.append(("starttls",))

        def login(self, u, p):
            calls.append(("login", u))

        def send_message(self, m):
            calls.append(("send",))

    class FakeSSL(FakeSMTP):
        pass

    import smtplib

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(smtplib, "SMTP_SSL", FakeSSL)
    publish._send_smtp({"host": "h", "port": "465", "user": "u", "password": "p"}, object())
    publish._send_smtp({"host": "h", "port": "587", "user": "", "password": ""}, object())
    assert ("init", "FakeSSL", 465) in calls and ("init", "FakeSMTP", 587) in calls
    assert calls.count(("starttls",)) == 1 and calls.count(("login", "u")) == 1 and calls.count(("send",)) == 2


def test_email_provider_keys_registered():
    from app.core.org_secrets import PROVIDER_MAP

    assert PROVIDER_MAP["smtp_password"].secret is True
    assert PROVIDER_MAP["email_recipients"].secret is False
