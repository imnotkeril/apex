from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_router import TaskType, ai_router
from app.models.organisation import Organisation
from app.modules.content.models import ContentDraft, FactCheckResult, RawPost, StylePreset
from app.modules.content.prompts import (
    SUMMARY_SYSTEM,
    fact_check_user,
    format_linkedin_user,
    format_telegram_user,
    format_twitter_user,
    image_prompt_user,
    research_query_user,
    synthesis_and_style_user,
    translation_user,
)

SUPPORTED_TRANSLATION_LANGS = ["en", "ru", "ja", "ko", "zh"]


async def _web_research(draft: ContentDraft, posts: list[RawPost], org_s: str) -> str:
    """Fresh-news lookup via Perplexity before writing. Empty string when unavailable (graceful skip)."""
    tags = ", ".join(draft.tags or [])
    summaries = "\n".join(f"- {p.summary or p.raw_text[:200]}" for p in posts[:10])
    try:
        r = await ai_router.complete(
            TaskType.COMPANY_RESEARCH,  # routes to Perplexity Sonar Pro (web-connected)
            user_prompt=research_query_user(draft.topic, tags, summaries),
            system_prompt="You are a research assistant with live web access. Be factual and concise.",
            max_tokens=1024,
            org_id=org_s,
            module="content",
        )
        content = (r.get("content") or "").strip()
        if not content or "NOTHING_NEW" in content:
            return ""
        return content
    except Exception as e:  # noqa: BLE001 - research is optional enrichment
        logger.info("research_step_skipped draft_id=%s reason=%s", draft.id, e)
        return ""
logger = logging.getLogger(__name__)


def _strip_json_fence(s: str) -> str:
    t = s.strip()
    if t.startswith("```"):
        parts = t.split("\n", 1)
        t = parts[1] if len(parts) > 1 else t
        if "```" in t:
            t = t.rsplit("```", 1)[0]
    return t.strip()


async def _load_style(session: AsyncSession, org_id: uuid.UUID, style_preset_id: uuid.UUID | None) -> StylePreset | None:
    if style_preset_id:
        sp = await session.get(StylePreset, style_preset_id)
        if sp and sp.org_id == org_id and sp.is_active:
            return sp
    res = await session.execute(
        select(StylePreset)
        .where(StylePreset.org_id == org_id, StylePreset.is_active.is_(True))
        .order_by(StylePreset.is_default.desc(), StylePreset.created_at.asc())
        .limit(1)
    )
    return res.scalar_one_or_none()


def plan_steps(steps: set[str] | None, has_text: bool) -> dict[str, bool]:
    """Which pipeline stages run. None = everything. Synthesis and styling are one AI call, and new
    text invalidates everything downstream, so selecting either (or having no text yet) runs all."""
    if steps is None or not has_text or steps & {"synthesis", "styling"}:
        return {"text": True, "formatting": True, "translation": True, "fact_check": True, "image": True}
    return {
        "text": False,
        "formatting": "formatting" in steps,
        "translation": "translation" in steps,
        "fact_check": "fact_check" in steps,
        "image": "image" in steps,
    }


async def run_draft_pipeline(
    session: AsyncSession, draft_id: uuid.UUID, steps: set[str] | None = None
) -> None:
    """Execute M4 draft pipeline (synthesis → style → formats → fact-check → related)."""
    draft = await session.get(ContentDraft, draft_id)
    if not draft:
        return

    org_s = str(draft.org_id)
    org = await session.get(Organisation, draft.org_id)
    draft.pipeline_status = "synthesizing"
    draft.pipeline_error = None
    await session.flush()

    flags = plan_steps(steps, bool(draft.styled_text))
    do_text, do_fmt, do_tr, do_fc, do_img = (
        flags["text"], flags["formatting"], flags["translation"], flags["fact_check"], flags["image"],
    )
    try:
        post_ids = draft.source_post_ids or []
        posts: list[RawPost] = []
        for pid in post_ids:
            p = await session.get(RawPost, pid)
            if p and p.org_id == draft.org_id:
                posts.append(p)
        if do_text and not posts:
            raise ValueError("No source posts found for draft")

        blocks = []
        for p in posts:
            blocks.append(f"--- Post from source {p.source_id} ({p.post_date.isoformat()}):\n{p.raw_text}\n---")
        source_blocks = "\n".join(blocks)

        style = await _load_style(session, draft.org_id, draft.style_preset_id)
        if not style:
            raise ValueError("No style preset configured for organisation")

        if do_text:
            # Optional fresh-web research (Perplexity) — enriches the write-up with news
            # the raw sources don't have yet. Controlled by org settings (default on).
            research_block = ""
            if (org.settings or {}).get("enrich_research", True):
                research_block = await _web_research(draft, posts, org_s)

            # Synthesis + styling in ONE Sonnet call (single pass over sources + research)
            forbidden = ", ".join(style.forbidden_phrases or [])
            combined = await ai_router.complete(
                TaskType.CONTENT_SYNTHESIS,
                user_prompt=synthesis_and_style_user(
                    source_blocks,
                    research_block,
                    draft.language,
                    style.rewrite_instructions,
                    forbidden,
                    style.max_length_telegram,
                ),
                system_prompt=style.system_prompt or SUMMARY_SYSTEM,
                max_tokens=8192,
                org_id=org_s,
                user_id=str(draft.created_by_user_id) if draft.created_by_user_id else None,
                module="content",
            )
            final_text = (combined.get("content") or "").strip()
            draft.synthesized_text = final_text  # kept for UI compatibility (single-pass output)
            draft.styled_text = final_text
            draft.pipeline_status = "formatting"
            await session.flush()

        if do_fmt:
            async def fmt_tg() -> str:
                r = await ai_router.complete(
                    TaskType.TEXT_GENERATION,
                    user_prompt=format_telegram_user(draft.styled_text or "", style.max_length_telegram),
                    system_prompt=SUMMARY_SYSTEM,
                    max_tokens=4096,
                    org_id=org_s,
                    module="content",
                )
                return (r.get("content") or "").strip()

            async def fmt_li() -> str:
                r = await ai_router.complete(
                    TaskType.TEXT_GENERATION,
                    user_prompt=format_linkedin_user(draft.styled_text or ""),
                    system_prompt=SUMMARY_SYSTEM,
                    max_tokens=4096,
                    org_id=org_s,
                    module="content",
                )
                return (r.get("content") or "").strip()

            async def fmt_tw() -> str:
                r = await ai_router.complete(
                    TaskType.TEXT_GENERATION,
                    user_prompt=format_twitter_user(draft.styled_text or ""),
                    system_prompt=SUMMARY_SYSTEM,
                    max_tokens=2048,
                    org_id=org_s,
                    module="content",
                )
                return (r.get("content") or "").strip()

            tg_text, li_text, tw_text = await asyncio.gather(fmt_tg(), fmt_li(), fmt_tw())
            draft.telegram_version = tg_text
            draft.linkedin_post_version = li_text
            draft.twitter_version = tw_text

        if do_tr:
            # Translations (M4 TZ §3.9): parallel per target language, skip source language
            targets = [
                lang for lang in (draft.translation_targets or [])
                if lang in SUPPORTED_TRANSLATION_LANGS and lang != draft.language
            ]
            if targets:
                draft.pipeline_status = "translating"
                await session.flush()

                async def translate(lang: str) -> tuple[str, str]:
                    r = await ai_router.complete(
                        TaskType.SUMMARY,
                        user_prompt=translation_user(draft.styled_text or "", lang),
                        system_prompt=SUMMARY_SYSTEM,
                        max_tokens=8192,
                        org_id=org_s,
                        module="content",
                    )
                    return lang, (r.get("content") or "").strip()

                results = await asyncio.gather(*(translate(lang) for lang in targets), return_exceptions=True)
                translations = dict(draft.translations or {})
                for res in results:
                    if isinstance(res, BaseException):
                        logger.warning("translation_failed draft_id=%s error=%s", draft_id, res)
                        continue
                    lang, text = res
                    if text:
                        translations[lang] = text
                draft.translations = translations

        if do_fc:
            draft.pipeline_status = "fact_checking"
            await session.flush()

            fc = await ai_router.complete(
                TaskType.COMPANY_RESEARCH,
                user_prompt=fact_check_user(draft.styled_text or ""),
                system_prompt="Return only valid JSON as specified.",
                max_tokens=4096,
                org_id=org_s,
                module="content",
            )
            raw_fc = _strip_json_fence(fc.get("content") or "{}")
            try:
                fc_data = json.loads(raw_fc)
            except json.JSONDecodeError:
                fc_data = {"overall_verdict": "failed", "claims": [], "summary": "Could not parse fact-check JSON"}
            draft.fact_check_results = fc_data
            draft.fact_check_status = str(fc_data.get("overall_verdict") or "pending")
            draft.fact_check_completed_at = datetime.now(timezone.utc)
            for c in fc_data.get("claims") or []:
                if not isinstance(c, dict):
                    continue
                session.add(
                    FactCheckResult(
                        draft_id=draft.id,
                        claim=str(c.get("claim") or ""),
                        verdict=str(c.get("verdict") or "unverified"),
                        confidence=int(c["confidence"]) if c.get("confidence") is not None else None,
                        source_url=c.get("source_url"),
                        source_title=c.get("source_title"),
                        explanation=c.get("explanation"),
                    )
                )

        draft.pipeline_status = "generating_image"
        await session.flush()

        # Image generation (TZ Phase 3): opt-in via org settings or requested_formats.
        # Failure must not block the draft from reaching "ready" (TZ §9).
        want_image = bool((org.settings or {}).get("generate_images")) or "image" in (draft.requested_formats or [])
        if do_img and want_image:
            try:
                from app.modules.content.services.images import generate_image

                if not draft.image_prompt:
                    pr = await ai_router.complete(
                        TaskType.SUMMARY,
                        user_prompt=image_prompt_user(draft.styled_text or "", ""),
                        system_prompt=SUMMARY_SYSTEM,
                        max_tokens=256,
                        org_id=org_s,
                        module="content",
                    )
                    draft.image_prompt = (pr.get("content") or "").strip()
                img = await generate_image(
                    draft.org_id,
                    draft.image_prompt or draft.topic,
                    provider_pref=str((org.settings or {}).get("image_provider") or "openai"),
                )
                images = list(draft.generated_images or [])
                images.append(img)
                draft.generated_images = images
                draft.selected_image_url = img["url"]
            except Exception as img_err:  # noqa: BLE001
                logger.warning("image_generation_skipped draft_id=%s error=%s", draft_id, img_err)

        try:
            from app.modules.content.services.related import populate_related

            await populate_related(session, draft)
        except Exception as rel_err:  # noqa: BLE001 - related content is a nicety, never blocks "ready"
            logger.warning("related_content_skipped draft_id=%s error=%s", draft_id, rel_err)
        draft.pipeline_status = "ready"
        # Semantic neighbours via pgvector SQL can be added with bound uuid[]; omitted here for portability.

        draft.status = "ready"
        await session.flush()

        from app.modules.content.notifications import send_notification

        await send_notification(org, "draft_ready", f'APEX: draft "{draft.topic}" is ready for review.')
    except Exception as e:  # noqa: BLE001
        draft.pipeline_status = "failed"
        draft.pipeline_error = str(e)[:4000]
        await session.flush()
        logger.warning("draft_pipeline_failed draft_id=%s error=%s", draft_id, e)

        from app.modules.content.notifications import send_notification

        if org:
            await send_notification(
                org, "pipeline_failed", f'APEX: draft "{draft.topic}" pipeline failed: {draft.pipeline_error}'
            )
