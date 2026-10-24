"""PDF export of a draft (M4 TZ Phase 3). Pure function: text in, PDF bytes out.

The built-in PDF fonts only cover Latin-1. For Cyrillic and other scripts a TrueType font is needed:
set APEX_PDF_FONT to a .ttf path (use a CJK font for ja/zh) or install DejaVu (the backend image does).
"""

from __future__ import annotations

import os
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

_FONT_NAME = "ApexSans"
_FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
)


class PdfFontMissing(Exception):
    """Text needs glyphs the available fonts cannot draw."""


def _needs_unicode(text: str) -> bool:
    try:
        text.encode("latin-1")
        return False
    except UnicodeEncodeError:
        return True


def _unicode_font() -> str | None:
    """Register (once) and return a Unicode-capable font name, or None if none is installed."""
    if _FONT_NAME in pdfmetrics.getRegisteredFontNames():
        return _FONT_NAME
    for path in (os.environ.get("APEX_PDF_FONT", ""), *_FONT_CANDIDATES):
        if path and os.path.isfile(path):
            try:
                pdfmetrics.registerFont(TTFont(_FONT_NAME, path))
                return _FONT_NAME
            except Exception:  # noqa: BLE001 - unreadable font file: try the next one
                continue
    return None


def build_pdf(title: str, body: str, meta: list[str] | None = None) -> bytes:
    """Render title, a one-line meta strip and body paragraphs into an A4 PDF."""
    meta = meta or []
    combined = "\n".join([title, body, *meta])
    font = "Helvetica"
    if _needs_unicode(combined):
        found = _unicode_font()
        if not found:
            raise PdfFontMissing("Text contains non-Latin characters; install DejaVu or set APEX_PDF_FONT to a .ttf file")
        font = found

    title_style = ParagraphStyle("t", fontName=font, fontSize=20, leading=25, spaceAfter=6)
    meta_style = ParagraphStyle("m", fontName=font, fontSize=9, leading=12, textColor="#666666", spaceAfter=14)
    body_style = ParagraphStyle("b", fontName=font, fontSize=11, leading=16, spaceAfter=8)

    story = [Paragraph(escape(title or "Untitled"), title_style)]
    if meta:
        story.append(Paragraph(escape(" · ".join(meta)), meta_style))
    for chunk in (c.strip() for c in body.replace("\r\n", "\n").split("\n\n")):
        if chunk:
            story.append(Paragraph(escape(chunk).replace("\n", "<br/>"), body_style))
        else:
            story.append(Spacer(1, 4))

    buf = BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm, bottomMargin=20 * mm,
                      title=title or "APEX draft").build(story)
    return buf.getvalue()
