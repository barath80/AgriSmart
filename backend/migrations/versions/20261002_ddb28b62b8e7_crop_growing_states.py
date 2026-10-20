"""Main producing states per crop, for the regional recommendation rule.

Revision ID: ddb28b62b8e7
Revises: 2b26bccf623c
Create Date: 2026-10-02 14:36:28.536571
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "ddb28b62b8e7"
down_revision: str | None = "2b26bccf623c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crops",
        sa.Column(
            "growing_states",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            server_default="[]",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("crops", "growing_states")
