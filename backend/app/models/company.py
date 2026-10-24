import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.organisation import Organisation


class Company(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "companies"
    __table_args__ = (
        UniqueConstraint("org_id", "domain", name="unique_domain_per_org"),
        Index("idx_companies_domain", "org_id", "domain"),
        Index("idx_companies_status", "org_id", "status"),
        Index("idx_companies_score", "org_id", "contact_score"),
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[str | None] = mapped_column(Text, nullable=True)

    industry: Mapped[str | None] = mapped_column(Text, nullable=True)
    sub_industry: Mapped[str | None] = mapped_column(Text, nullable=True)
    size: Mapped[str | None] = mapped_column(Text, nullable=True)
    employee_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    country: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    founded_year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    linkedin_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    twitter_handle: Mapped[str | None] = mapped_column(Text, nullable=True)
    website_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    icp_fit_score: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    contact_score: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    status: Mapped[str] = mapped_column(String(32), default="lead", server_default="lead")
    source: Mapped[str] = mapped_column(String(32), default="manual", server_default="manual")

    last_enriched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organisation: Mapped["Organisation"] = relationship("Organisation", back_populates="companies")
