"""PDF export: valid PDF bytes, font handling for non-Latin text, endpoint behaviour."""

import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.content import router_ext
from app.modules.content.models import ContentDraft
from app.modules.content.services import pdf_export
from tests._fakes import FakeResult, FakeSession

ORG = uuid.uuid4()


def test_build_pdf_latin_text_is_a_pdf():
    pdf = pdf_export.build_pdf("Fed holds rates", "First paragraph.\n\nSecond <b>paragraph</b> & more.", ["EN", "Status: ready"])
    assert pdf.startswith(b"%PDF-") and len(pdf) > 500


def test_build_pdf_escapes_markup_and_handles_empty_body():
    pdf = pdf_export.build_pdf("T <i>", "", [])
    assert pdf.startswith(b"%PDF-")


def test_non_latin_without_font_raises(monkeypatch):
    monkeypatch.setattr(pdf_export, "_unicode_font", lambda: None)
    with pytest.raises(pdf_export.PdfFontMissing):
        pdf_export.build_pdf("Заголовок", "Текст", [])


def test_non_latin_with_font_renders():
    if pdf_export._unicode_font() is None:
        pytest.skip("no Unicode TTF font on this machine")
    assert pdf_export.build_pdf("Заголовок", "Текст поста", ["RU"]).startswith(b"%PDF-")


def _draft(**kw) -> ContentDraft:
    return ContentDraft(id=uuid.uuid4(), org_id=ORG, topic="Topic", language="en", status="ready", styled_text=kw.pop("styled_text", "Body"),
                        translations=kw.pop("translations", {"ru": "Тело"}), **kw)


@pytest.mark.asyncio
async def test_endpoint_returns_pdf_attachment():
    d = _draft()
    resp = await router_ext.draft_pdf(d.id, FakeSession([FakeResult(items=[d])]), SimpleNamespace(org_id=ORG), lang=None)
    assert resp.media_type == "application/pdf" and resp.body.startswith(b"%PDF-")
    assert f"draft-{d.id}.pdf" in resp.headers["content-disposition"]


@pytest.mark.asyncio
async def test_endpoint_409_when_language_missing_and_422_when_font_missing(monkeypatch):
    d = _draft()
    with pytest.raises(HTTPException) as e:
        await router_ext.draft_pdf(d.id, FakeSession([FakeResult(items=[d])]), SimpleNamespace(org_id=ORG), lang="ja")
    assert e.value.status_code == 409
    monkeypatch.setattr(pdf_export, "_unicode_font", lambda: None)
    with pytest.raises(HTTPException) as e:
        await router_ext.draft_pdf(d.id, FakeSession([FakeResult(items=[d])]), SimpleNamespace(org_id=ORG), lang="ru")
    assert e.value.status_code == 422
