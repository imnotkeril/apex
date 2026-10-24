import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class OrganisationRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    settings: dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrganisationUpdate(BaseModel):
    name: str | None = None
    settings: dict[str, Any] | None = None
