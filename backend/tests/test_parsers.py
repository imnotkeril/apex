"""Unit tests for content parsers: web article extraction, subtitle parsing, dedup hash."""

from app.modules.content.parsers.base import content_hash
from app.modules.content.parsers.web import _extract_article
from app.modules.content.parsers.youtube import _parse_subtitle_payload, _pick_subtitle_url

_HTML = """
<html><head>
<title>Fallback Title</title>
<meta property="og:title" content="Fed Holds Rates Steady" />
<meta name="author" content="Jane Doe" />
</head><body>
<nav>Home News Markets</nav>
<article>
<h1>Fed Holds Rates Steady</h1>
<p>The Federal Reserve kept interest rates unchanged on Wednesday, citing continued progress on inflation.</p>
<p>Chair Powell said the disinflation process continues and future decisions remain data dependent.</p>
<p>Markets rallied after the announcement with the S&amp;P 500 closing up 1.2 percent on the day.</p>
</article>
<footer>Copyright</footer>
</body></html>
"""


def test_extract_article_prefers_og_title_and_article_tag():
    title, text, author = _extract_article(_HTML)
    assert title == "Fed Holds Rates Steady"
    assert author == "Jane Doe"
    assert "Federal Reserve kept interest rates" in text
    assert "Home News Markets" not in text  # nav stripped
    assert "Copyright" not in text  # footer stripped


def test_content_hash_uses_first_500_chars():
    a = "x" * 500 + "tail-one"
    b = "x" * 500 + "tail-two"
    assert content_hash(a) == content_hash(b)
    assert content_hash("abc") != content_hash("abd")


def test_parse_subtitle_payload_json3():
    payload = '{"events":[{"segs":[{"utf8":"Hello"},{"utf8":" world"}]},{"segs":[{"utf8":"second line"}]}]}'
    text = _parse_subtitle_payload(payload, "application/json")
    assert "Hello" in text and "world" in text and "second line" in text


def test_parse_subtitle_payload_vtt_dedupes_rolling_captions():
    vtt = """WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:02.000
Hello world

00:00:02.000 --> 00:00:04.000
Hello world

00:00:04.000 --> 00:00:06.000
Second line
"""
    text = _parse_subtitle_payload(vtt, "text/vtt")
    assert text == "Hello world Second line"


def test_pick_subtitle_url_prefers_manual_and_language():
    info = {
        "subtitles": {"ru": [{"ext": "vtt", "url": "http://manual-ru"}]},
        "automatic_captions": {"en": [{"ext": "json3", "url": "http://auto-en"}]},
    }
    # preferred language present in manual subs wins
    assert _pick_subtitle_url(info, "ru") == "http://manual-ru"
    # en preferred: manual pool has no en, but manual pool is scanned first for any priority lang
    info2 = {"subtitles": {}, "automatic_captions": {"en": [{"ext": "json3", "url": "http://auto-en"}]}}
    assert _pick_subtitle_url(info2, "en") == "http://auto-en"
    assert _pick_subtitle_url({}, "en") is None
