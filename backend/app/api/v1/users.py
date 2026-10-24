from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate

router = APIRouter()


@router.get("/", response_model=list[UserRead])
async def list_org_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[User]:
    result = await db.execute(
        select(User).where(User.org_id == current_user.org_id, User.is_active.is_(True)).order_by(User.created_at)
    )
    return list(result.scalars().all())


@router.patch("/me", response_model=UserRead)
async def update_me(
    body: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> User:
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url
    if body.preferences is not None:
        current_user.preferences = {**(current_user.preferences or {}), **body.preferences}
    await db.flush()
    await db.refresh(current_user)
    return current_user
