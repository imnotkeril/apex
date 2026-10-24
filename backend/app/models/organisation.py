from typing import TYPE_CHECKING, Any

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.user import User


class Organisation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organisations"

    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    plan: Mapped[str] = mapped_column(String(32), default="free", server_default="free")
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")

    users: Mapped[list["User"]] = relationship("User", back_populates="organisation")
    companies: Mapped[list["Company"]] = relationship("Company", back_populates="organisation")
