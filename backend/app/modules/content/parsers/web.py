"""Web article parser (M4 TZ §4.5): fetch a URL and extract readable article text."""

from __future__ import annotations

from datetime import UTC, datetime

import httpx

from app.modules.content.parsers.base import ParsedItem, content_hash

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
_MIN_ARTICLE_CHARS = 200


def _extract_article(html: str) -> tuple[str, str, str | None]:
    """Return (title, text, author) from raw HTML using BeautifulSoup heuristics."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form", "noscript", "iframe"]):
        tag.decompose()

    og_title = soup.find("meta", property="og:title")
    title = (og_title.get("content") if og_title else None) or (soup.title.string if soup.title else "") or ""
    title = str(title).strip()

    author_meta = soup.find("meta", attrs={"name": "author"}) or soup.find("meta", property="article:author")
    author = str(author_meta.get("content")).strip() if author_meta and author_meta.get("content") else None

    # Prefer semantic containers, fall back to whole page paragraphs
    container = soup.find("article") or soup.find("main") or soup.body or soup
    paragraphs = [p.get_text(" ", strip=True) for p in container.find_all(["p", "h1", "h2", "h3", "li"])]
    text = "\n".join(p for p in paragraphs if p and len(p) > 30)
    if len(text) < _MIN_ARTICLE_CHARS:
        # last resort: all visible text
        text = container.get_text("\n", strip=True)
    return title, text.strip(), author


async def parse_web_article(url: str) -> ParsedItem:
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, headers={"User-Agent": _UA}) as client:
        r = await client.get(url)
        r.raise_for_status()
        html = r.text

    title, text, author = _extract_article(html)
    if len(text) < _MIN_ARTICLE_CHARS:
        raise RuntimeError("Could not extract readable article text from URL")
    raw_text = f"{title}\n\n{text}".strip() if title else text
    return ParsedItem(
        raw_text=raw_text[:50000],
        post_date=datetime.now(UTC),
        source_url=url,
        author=author,
        content_hash=content_hash(raw_text),
    )
