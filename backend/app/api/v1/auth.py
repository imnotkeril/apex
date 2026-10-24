from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.user import UserRead

router = APIRouter()


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/logout", response_model=MessageResponse)
async def logout() -> MessageResponse:
    """
    Stateless JWT: client discards the session after Supabase signOut.
    """
    return MessageResponse(message="OK")
