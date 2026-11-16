"""create users table and link chats to user

Revision ID: 860883411b4f
Revises: 367a3d7669ed
Create Date: 2026-11-03 19:20:57.874985

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "860883411b4f"
down_revision: str | Sequence[str] | None = "367a3d7669ed"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "users",
        sa.Column("telegram_id", sa.BigInteger(), nullable=True),
        sa.Column("username", sa.String(), nullable=True),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("telegram_id"),
    )

    op.execute("DELETE FROM chat_messages")
    op.execute("DELETE FROM chats")

    op.add_column("chats", sa.Column("user_id", sa.UUID(), nullable=False))
    op.create_foreign_key(
        "chats_user_id_fkey",
        "chats",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("chats_user_id_fkey", "chats", type_="foreignkey")
    op.drop_column("chats", "user_id")
    op.drop_table("users")
