"""Minimum elevation for hill crops (coffee, apple).

Revision ID: 45a6492c8bb4
Revises: ddb28b62b8e7
Create Date: 2026-10-02 14:45:08.666256
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "45a6492c8bb4"
down_revision: str | None = "ddb28b62b8e7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("crops", sa.Column("min_elevation_m", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("crops", "min_elevation_m")
