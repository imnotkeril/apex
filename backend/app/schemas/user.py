import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class UserRead(BaseModel):
    id: uuid.UUID
    auth_id: uuid.UUID
    org_id: uuid.UUID
    email: str
    full_name: str | None
    avatar_url: str | None
    role: str
    is_active: bool
    preferences: dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None
    preferences: dict[str, Any] | None = None
