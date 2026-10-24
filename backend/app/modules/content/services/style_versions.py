"""Style-preset prompt version history (M4 TZ §6.9): snapshot on edit, restore on demand."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.modules.content.models import StylePreset

# Fields that define how a preset writes; metadata (name, default flag) is not versioned.
VERSIONED_FIELDS = (
    "display_name",
    "description",
    "language",
    "system_prompt",
    "synthesis_instructions",
    "rewrite_instructions",
    "telegram_instructions",
    "linkedin_instructions",
    "twitter_instructions",
    "temperature",
    "max_length_telegram",
    "max_length_linkedin",
    "max_length_twitter",
    "forbidden_phrases",
    "required_elements",
    "examples",
)
MAX_VERSIONS = 20


def snapshot(preset: StylePreset) -> dict[str, Any]:
    snap: dict[str, Any] = {f: getattr(preset, f, None) for f in VERSIONED_FIELDS}
    snap["version"] = preset.version or 1
    snap["saved_at"] = datetime.now(timezone.utc).isoformat()
    return snap


def apply_update(preset: StylePreset, changes: dict[str, Any]) -> bool:
    """Apply an edit; if a versioned field really changes, archive the old state and bump version."""
    changed = any(f in changes and getattr(preset, f, None) != changes[f] for f in VERSIONED_FIELDS)
    if changed:
        history = list(preset.previous_versions or [])
        history.append(snapshot(preset))
        preset.previous_versions = history[-MAX_VERSIONS:]
        preset.version = (preset.version or 1) + 1
    for k, v in changes.items():
        setattr(preset, k, v)
    return changed


def list_versions(preset: StylePreset) -> list[dict[str, Any]]:
    """Newest first, current version included on top."""
    current = snapshot(preset)
    return [current, *reversed(list(preset.previous_versions or []))]


def restore_version(preset: StylePreset, version: int) -> bool:
    """Roll fields back to `version`; the state being replaced is archived as a new version."""
    target = next((v for v in (preset.previous_versions or []) if v.get("version") == version), None)
    if target is None:
        return False
    history = list(preset.previous_versions or [])
    history.append(snapshot(preset))
    preset.previous_versions = history[-MAX_VERSIONS:]
    for f in VERSIONED_FIELDS:
        if f in target:
            setattr(preset, f, target[f])
    preset.version = (preset.version or 1) + 1
    return True
