"""PPTX export of a draft (M4 TZ Phase 3): title slide, optional chart slide, body slides."""

from __future__ import annotations

from io import BytesIO

from pptx import Presentation
from pptx.util import Inches, Pt

MAX_CHARS_PER_SLIDE = 700


def split_body(body: str, limit: int = MAX_CHARS_PER_SLIDE) -> list[str]:
    """Group paragraphs into slide-sized chunks; an oversize paragraph is split on sentence ends."""
    paragraphs = [p.strip() for p in body.replace("\r\n", "\n").split("\n\n") if p.strip()]
    pieces: list[str] = []
    for p in paragraphs:
        while len(p) > limit:
            cut = max(p.rfind(". ", 0, limit), p.rfind(" ", 0, limit))
            cut = cut + 1 if cut > 0 else limit
            pieces.append(p[:cut].strip())
            p = p[cut:].strip()
        if p:
            pieces.append(p)
    slides: list[str] = []
    current = ""
    for piece in pieces:
        if current and len(current) + len(piece) + 2 > limit:
            slides.append(current)
            current = piece
        else:
            current = f"{current}\n\n{piece}" if current else piece
    if current:
        slides.append(current)
    return slides


def build_pptx(title: str, body: str, meta: list[str] | None = None, chart_png: bytes | None = None) -> bytes:
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)  # 16:9

    cover = prs.slides.add_slide(prs.slide_layouts[0])
    cover.shapes.title.text = title or "Untitled"
    cover.placeholders[1].text = " · ".join(meta or [])

    if chart_png:
        slide = prs.slides.add_slide(prs.slide_layouts[5])
        slide.shapes.title.text = "Data"
        slide.shapes.add_picture(BytesIO(chart_png), Inches(1.7), Inches(1.7), height=Inches(5.3))

    chunks = split_body(body)
    for i, chunk in enumerate(chunks, 1):
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = title if len(chunks) == 1 else f"{title} ({i}/{len(chunks)})"
        frame = slide.placeholders[1].text_frame
        frame.word_wrap = True
        frame.text = chunk
        for para in frame.paragraphs:
            for run in para.runs:
                run.font.size = Pt(20)

    buf = BytesIO()
    prs.save(buf)
    return buf.getvalue()
