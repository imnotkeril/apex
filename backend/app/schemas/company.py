import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CompanyBase(BaseModel):
    name: str = Field(..., min_length=1)
    domain: str | None = None
    industry: str | None = None
    sub_industry: str | None = None
    size: str | None = None
    employee_count: int | None = None
    location: str | None = None
    country: str | None = None
    description: str | None = None
    founded_year: int | None = None
    linkedin_url: str | None = None
    twitter_handle: str | None = None
    website_url: str | None = None
    status: str = "lead"
    source: str = "manual"


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    industry: str | None = None
    sub_industry: str | None = None
    size: str | None = None
    employee_count: int | None = None
    location: str | None = None
    country: str | None = None
    description: str | None = None
    founded_year: int | None = None
    linkedin_url: str | None = None
    twitter_handle: str | None = None
    website_url: str | None = None
    status: str | None = None
    source: str | None = None


class CompanyRead(CompanyBase):
    id: uuid.UUID
    org_id: uuid.UUID
    icp_fit_score: int
    contact_score: int
    created_at: datetime
    updated_at: datetime
    last_enriched_at: datetime | None
    last_activity_at: datetime | None

    model_config = {"from_attributes": True}
