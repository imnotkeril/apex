"""forms_support: draft requested formats/translations, user preferences

Revision ID: 003_forms
Revises: 002_content
Create Date: 2026-06-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

revision: str = "003_forms"
down_revision: Union[str, None] = "002_content"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "content_drafts",
        sa.Column("requested_formats", ARRAY(sa.Text()), nullable=True),
    )
    op.add_column(
        "content_drafts",
        sa.Column("translation_targets", ARRAY(sa.Text()), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("preferences", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("users", "preferences")
    op.drop_column("content_drafts", "translation_targets")
    op.drop_column("content_drafts", "requested_formats")
