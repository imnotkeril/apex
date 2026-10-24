"""YouTube parser (M4 TZ §4.3): subtitles via yt-dlp, Whisper fallback for short videos.

Handles both a single video URL and a channel/playlist URL (last N videos).
"""

from __future__ import annotations

import asyncio
import os
import tempfile
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.org_secrets import get_secret
from app.modules.content.parsers.base import ParsedItem, content_hash

MAX_CHANNEL_VIDEOS = 3          # per parse cycle, keeps hourly beat affordable
WHISPER_MAX_DURATION_S = 20 * 60  # skip Whisper beyond 20 minutes
WHISPER_MAX_FILE_MB = 24          # OpenAI API cap is 25 MB

_SUB_LANG_PRIORITY = ["en", "ru", "ja", "ko", "zh"]


def _ydl_opts(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    opts: dict[str, Any] = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True}
    if extra:
        opts.update(extra)
    return opts


def _extract_info(url: str, opts: dict[str, Any]) -> dict[str, Any]:
    import yt_dlp  # local import: heavy module

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return info or {}


def _pick_subtitle_url(info: dict[str, Any], preferred_lang: str) -> str | None:
    """Choose a json3/vtt subtitle track: manual first, then auto captions."""
    langs = [preferred_lang, *[l for l in _SUB_LANG_PRIORITY if l != preferred_lang]]
    for pool_name in ("subtitles", "automatic_captions"):
        pool = info.get(pool_name) or {}
        for lang in langs:
            for code, tracks in pool.items():
                if not code.startswith(lang):
                    continue
                for t in tracks or []:
                    if t.get("ext") in ("json3", "vtt") and t.get("url"):
                        return str(t["url"])
    return None


def _parse_subtitle_payload(text: str, content_type: str) -> str:
    if "json" in content_type or text.lstrip().startswith("{"):
        import json

        try:
            data = json.loads(text)
            parts: list[str] = []
            for ev in data.get("events") or []:
                for seg in ev.get("segs") or []:
                    s = seg.get("utf8")
                    if s and s.strip():
                        parts.append(s.strip())
            return " ".join(parts)
        except Exception:  # noqa: BLE001
            return ""
    # VTT: drop headers, timestamps and cue settings
    lines: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")) or "-->" in s or s.isdigit():
            continue
        lines.append(s)
    # collapse consecutive duplicates typical for rolling captions
    out: list[str] = []
    for s in lines:
        if not out or out[-1] != s:
            out.append(s)
    return " ".join(out)


async def _fetch_subtitles(info: dict[str, Any], preferred_lang: str) -> str:
    sub_url = _pick_subtitle_url(info, preferred_lang)
    if not sub_url:
        return ""
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(sub_url)
        r.raise_for_status()
        return _parse_subtitle_payload(r.text, r.headers.get("content-type", ""))


def _download_audio(url: str, tmpdir: str) -> str | None:
    """Download lowest-quality audio for Whisper. Returns file path or None."""
    import yt_dlp

    out_tmpl = os.path.join(tmpdir, "audio.%(ext)s")
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "format": "worstaudio/worst",
        "outtmpl": out_tmpl,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])
    for name in os.listdir(tmpdir):
        p = os.path.join(tmpdir, name)
        if os.path.isfile(p):
            return p
    return None


async def _whisper_transcribe(url: str, info: dict[str, Any], org_id: Any) -> str:
    """Whisper fallback: only for short videos and only when an OpenAI key exists."""
    duration = int(info.get("duration") or 0)
    if not duration or duration > WHISPER_MAX_DURATION_S:
        return ""
    api_key = await get_secret(org_id, "openai")
    if not api_key:
        return ""
    from openai import AsyncOpenAI

    with tempfile.TemporaryDirectory() as tmpdir:
        path = await asyncio.to_thread(_download_audio, url, tmpdir)
        if not path or os.path.getsize(path) > WHISPER_MAX_FILE_MB * 1024 * 1024:
            return ""
        client = AsyncOpenAI(api_key=api_key)
        with open(path, "rb") as f:
            tr = await client.audio.transcriptions.create(model="whisper-1", file=f)
        return (tr.text or "").strip()


async def parse_youtube_video(url: str, *, org_id: Any = None, preferred_lang: str = "en") -> ParsedItem | None:
    """Single video → transcript ParsedItem. Subtitles first, Whisper fallback."""
    info = await asyncio.to_thread(_extract_info, url, _ydl_opts())
    text = await _fetch_subtitles(info, preferred_lang)
    if not text:
        text = await _whisper_transcribe(url, info, org_id)
    if not text:
        raise RuntimeError("No subtitles available and Whisper transcription not possible")

    title = str(info.get("title") or "")
    raw_text = f"{title}\n\n{text}".strip()
    ts = info.get("timestamp")
    post_date = datetime.fromtimestamp(int(ts), tz=UTC) if ts else datetime.now(UTC)
    return ParsedItem(
        raw_text=raw_text,
        post_date=post_date,
        source_url=str(info.get("webpage_url") or url),
        author=str(info.get("uploader") or "") or None,
        content_hash=content_hash(raw_text),
    )


async def parse_youtube_channel(
    channel_url: str,
    last_parsed_at: datetime | None,
    *,
    org_id: Any = None,
    preferred_lang: str = "en",
) -> list[ParsedItem]:
    """Channel/playlist → transcripts of the newest videos (bounded by MAX_CHANNEL_VIDEOS)."""
    flat = await asyncio.to_thread(
        _extract_info, channel_url, _ydl_opts({"extract_flat": True, "noplaylist": False, "playlistend": 10})
    )
    entries = flat.get("entries") or []
    # channel pages sometimes nest tab playlists — flatten one level
    if entries and isinstance(entries[0], dict) and entries[0].get("entries"):
        entries = entries[0]["entries"] or []

    out: list[ParsedItem] = []
    for entry in entries[:MAX_CHANNEL_VIDEOS]:
        vid_url = entry.get("url") or entry.get("webpage_url")
        if not vid_url:
            continue
        if not str(vid_url).startswith("http"):
            vid_url = f"https://www.youtube.com/watch?v={vid_url}"
        try:
            item = await parse_youtube_video(str(vid_url), org_id=org_id, preferred_lang=preferred_lang)
        except Exception:  # noqa: BLE001 - one broken video must not kill the batch
            continue
        if item:
            if last_parsed_at:
                cutoff = last_parsed_at if last_parsed_at.tzinfo else last_parsed_at.replace(tzinfo=UTC)
                if item.post_date <= cutoff:
                    continue
            out.append(item)
    return out
