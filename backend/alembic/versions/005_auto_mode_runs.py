"""auto_mode_runs: history of auto-mode cycle decisions (created / skipped + reason)

Revision ID: 005_auto_runs
Revises: 004_auto_flex
Create Date: 2026-10-24

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision: str = "005_auto_runs"
down_revision: Union[str, None] = "004_auto_flex"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auto_mode_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ran_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("mode", sa.Text(), nullable=False, server_default="full_auto"),
        sa.Column("draft_id", UUID(as_uuid=True), sa.ForeignKey("content_drafts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("topic", sa.Text(), nullable=True),
        sa.Column("platforms", ARRAY(sa.Text()), nullable=False, server_default=sa.text("ARRAY[]::text[]")),
    )
    op.create_index("ix_auto_mode_runs_org_id", "auto_mode_runs", ["org_id"])
    op.create_index("ix_auto_mode_runs_ran_at", "auto_mode_runs", ["ran_at"])


def downgrade() -> None:
    op.drop_index("ix_auto_mode_runs_ran_at", table_name="auto_mode_runs")
    op.drop_index("ix_auto_mode_runs_org_id", table_name="auto_mode_runs")
    op.drop_table("auto_mode_runs")
