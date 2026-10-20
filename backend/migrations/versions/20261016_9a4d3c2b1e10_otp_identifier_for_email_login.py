"""Login codes can be addressed to an e-mail address as well as a phone number.

Revision ID: 9a4d3c2b1e10
Revises: 7c1e5a9d2b40
Create Date: 2026-10-16 15:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9a4d3c2b1e10"
down_revision: str | None = "7c1e5a9d2b40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "otp_codes", "phone", existing_type=sa.String(length=16), type_=sa.String(length=254)
    )


def downgrade() -> None:
    op.alter_column(
        "otp_codes", "phone", existing_type=sa.String(length=254), type_=sa.String(length=16)
    )
