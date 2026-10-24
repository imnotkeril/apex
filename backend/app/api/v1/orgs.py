import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import PermissionDeniedException, ResourceNotFoundException
from app.core.org_secrets import (
    PROVIDERS,
    SETTINGS_KEY,
    decrypt_secret,
    encrypt_secret,
    env_fallback,
    mask_secret,
)
from app.models.organisation import Organisation
from app.models.user import User
from app.modules.content.services.publish import publish_to_telegram
from app.schemas.organisation import OrganisationRead, OrganisationUpdate
from app.schemas.user import UserRead

router = APIRouter()

# "owner" is the highest role (the org-creating/dev-bypass user) and is always
# allowed to manage the team, even though it isn't one of the settable roles
# (admin/editor/viewer) exposed on the PATCH endpoint below.
_ADMIN_ROLES = {"admin", "owner"}


class IntegrationStatus(BaseModel):
    key: str
    label: str
    group: str
    secret: bool
    configured: bool          # org-level value present
    masked: str | None = None  # masked org value (or full value for non-secret fields)
    env_fallback: bool = False  # an environment fallback exists


class IntegrationsUpdate(BaseModel):
    # key -> new value; empty string or null clears the org-level value
    values: dict[str, str | None]


def _integration_statuses(org: Organisation) -> list[IntegrationStatus]:
    stored: dict = (org.settings or {}).get(SETTINGS_KEY) or {}
    out: list[IntegrationStatus] = []
    for spec in PROVIDERS:
        token = stored.get(spec.key)
        value = decrypt_secret(token) if isinstance(token, str) else None
        out.append(
            IntegrationStatus(
                key=spec.key,
                label=spec.label,
                group=spec.group,
                secret=spec.secret,
                configured=bool(value),
                masked=(mask_secret(value) if spec.secret else value) if value else None,
                env_fallback=bool(env_fallback(spec.key)),
            )
        )
    return out


async def _current_org(db: AsyncSession, user: User) -> Organisation:
    r = await db.execute(select(Organisation).where(Organisation.id == user.org_id))
    org = r.scalar_one_or_none()
    if not org:
        raise ResourceNotFoundException("Organisation", str(user.org_id))
    return org


@router.get("/current", response_model=OrganisationRead)
async def get_current_org(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Organisation:
    return await _current_org(db, current_user)


@router.patch("/current", response_model=OrganisationRead)
async def update_current_org(
    body: OrganisationUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Organisation:
    org = await _current_org(db, current_user)
    if body.name is not None:
        org.name = body.name
    if body.settings is not None:
        # Integrations are managed via /current/integrations only — never through raw settings.
        merged = {**(org.settings or {}), **body.settings}
        merged[SETTINGS_KEY] = (org.settings or {}).get(SETTINGS_KEY) or {}
        org.settings = merged
    await db.flush()
    await db.refresh(org)
    return org


@router.get("/current/integrations", response_model=list[IntegrationStatus])
async def get_integrations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[IntegrationStatus]:
    org = await _current_org(db, current_user)
    return _integration_statuses(org)


@router.put("/current/integrations", response_model=list[IntegrationStatus])
async def update_integrations(
    body: IntegrationsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[IntegrationStatus]:
    org = await _current_org(db, current_user)
    known = {p.key for p in PROVIDERS}
    stored: dict = dict((org.settings or {}).get(SETTINGS_KEY) or {})
    for key, value in body.values.items():
        if key not in known:
            continue
        if value:
            stored[key] = encrypt_secret(value.strip())
        else:
            stored.pop(key, None)
    org.settings = {**(org.settings or {}), SETTINGS_KEY: stored}
    flag_modified(org, "settings")
    await db.flush()
    await db.refresh(org)
    return _integration_statuses(org)


# ════════════════════════════════════════════════════════════════════
# Team & Access
# ════════════════════════════════════════════════════════════════════
class TeamMemberUpdate(BaseModel):
    role: Literal["admin", "editor", "viewer"] | None = None
    is_active: bool | None = None


@router.get("/current/users", response_model=list[UserRead])
async def list_org_team(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[User]:
    r = await db.execute(
        select(User).where(User.org_id == current_user.org_id).order_by(User.created_at)
    )
    return list(r.scalars().all())


@router.patch("/current/users/{user_id}", response_model=UserRead)
async def update_org_team_member(
    user_id: uuid.UUID,
    body: TeamMemberUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role not in _ADMIN_ROLES:
        raise PermissionDeniedException("team management")

    r = await db.execute(
        select(User).where(User.id == user_id, User.org_id == current_user.org_id)
    )
    target = r.scalar_one_or_none()
    if not target:
        raise ResourceNotFoundException("User", str(user_id))

    is_self = target.id == current_user.id
    if is_self and body.role is not None and body.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot demote your own account")
    if is_self and body.is_active is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own account")

    if body.role is not None:
        target.role = body.role
    if body.is_active is not None:
        target.is_active = body.is_active
    await db.flush()
    await db.refresh(target)
    return target


# ════════════════════════════════════════════════════════════════════
# Notifications
# ════════════════════════════════════════════════════════════════════
@router.post("/current/notifications/test")
async def send_test_notification(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    org = await _current_org(db, current_user)
    try:
        await publish_to_telegram("APEX test notification", org_id=org.id)
    except Exception as e:  # noqa: BLE001 - surfaced to the client as a clear 400
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from None
    return {"ok": True}
