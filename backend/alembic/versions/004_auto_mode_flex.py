"""auto_mode_flex: weekday schedule, topic filter, full-auto vs draft-only mode

Revision ID: 004_auto_flex
Revises: 003_forms
Create Date: 2026-07-11

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision: str = "004_auto_flex"
down_revision: Union[str, None] = "003_forms"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "auto_mode_config",
        sa.Column("publish_days", ARRAY(sa.Text()), nullable=False, server_default=sa.text("ARRAY[]::text[]")),
    )
    op.add_column(
        "auto_mode_config",
        sa.Column("allowed_tags", ARRAY(sa.Text()), nullable=False, server_default=sa.text("ARRAY[]::text[]")),
    )
    op.add_column(
        "auto_mode_config",
        sa.Column("mode", sa.Text(), nullable=False, server_default="full_auto"),
    )


def downgrade() -> None:
    op.drop_column("auto_mode_config", "mode")
    op.drop_column("auto_mode_config", "allowed_tags")
    op.drop_column("auto_mode_config", "publish_days")
