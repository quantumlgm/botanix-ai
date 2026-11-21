"""add image_urls to chat messages

Revision ID: 9f3c1a7b2d4e
Revises: 860883411b4f
Create Date: 2026-11-21 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "9f3c1a7b2d4e"
down_revision: str | Sequence[str] | None = "860883411b4f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "chat_messages",
        sa.Column(
            "image_urls",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("chat_messages", "image_urls")
