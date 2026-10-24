import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import decode_supabase_jwt
from app.core.config import settings
from app.core.database import get_db
from app.models.organisation import Organisation
from app.models.user import User

security = HTTPBearer(auto_error=False)


DEV_AUTH_UUID = uuid.UUID("00000000-0000-0000-0000-0000000000de")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    # DEV bypass: no Supabase, return/create a default dev user in the default org.
    if settings.DEV_AUTH:
        result = await db.execute(select(User).where(User.auth_id == DEV_AUTH_UUID))
        user = result.scalar_one_or_none()
        if user:
            return user
        org = await _get_or_create_default_org(db)
        user = User(
            auth_id=DEV_AUTH_UUID,
            org_id=org.id,
            email="dev@apex.local",
            full_name="Dev User",
            role="owner",
            is_active=True,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_supabase_jwt(credentials.credentials, settings.SUPABASE_JWT_SECRET)
    sub = payload["sub"]
    try:
        auth_uuid = uuid.UUID(str(sub))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: subject is not a UUID",
        ) from None

    result = await db.execute(select(User).where(User.auth_id == auth_uuid, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user:
        return user

    org = await _get_or_create_default_org(db)
    email = str(payload.get("email") or f"{sub}@users.supabase.local")
    meta = payload.get("user_metadata") or {}
    full_name = meta.get("full_name") or meta.get("name") or meta.get("given_name")

    user = User(
        auth_id=auth_uuid,
        org_id=org.id,
        email=email,
        full_name=full_name,
        avatar_url=meta.get("avatar_url") or meta.get("picture"),
        role="owner",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def _get_or_create_default_org(db: AsyncSession) -> Organisation:
    slug = settings.DEFAULT_ORG_SLUG
    result = await db.execute(select(Organisation).where(Organisation.slug == slug))
    org = result.scalar_one_or_none()
    if org:
        return org
    org = Organisation(name=settings.DEFAULT_ORG_NAME, slug=slug, plan="free", settings={})
    db.add(org)
    await db.flush()
    await db.refresh(org)
    return org
