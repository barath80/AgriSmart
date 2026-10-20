"""Help desk: messages between a farmer and the AgriSmart team.

Revision ID: 7c1e5a9d2b40
Revises: 45a6492c8bb4
Create Date: 2026-10-16 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

import app.core.database

revision: str = "7c1e5a9d2b40"
down_revision: str | None = "45a6492c8bb4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "support_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            app.core.database.UTCDateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            app.core.database.UTCDateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("farmer_id", sa.Uuid(), nullable=False),
        sa.Column("sender", sa.String(length=8), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("admin_user_id", sa.Uuid(), nullable=True),
        sa.Column("read_at", app.core.database.UTCDateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["farmer_id"],
            ["farmers.id"],
            name=op.f("fk_support_messages_farmer_id_farmers"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["admin_user_id"],
            ["users.id"],
            name=op.f("fk_support_messages_admin_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_support_messages")),
    )
    op.create_index(
        op.f("ix_support_messages_created_at"), "support_messages", ["created_at"], unique=False
    )
    op.create_index(
        "ix_support_messages_farmer_created", "support_messages", ["farmer_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_support_messages_created_at"), table_name="support_messages")
    op.drop_index("ix_support_messages_farmer_created", table_name="support_messages")
    op.drop_table("support_messages")
