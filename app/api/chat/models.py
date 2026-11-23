import uuid

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.core.enums import Roles
from app.services.postgres import Base, Timestamp, UuidId


class Chat(Base, UuidId, Timestamp):
    __tablename__ = "chats"

    title: Mapped[str]
    plant_context: Mapped[str | None] = mapped_column(nullable=True, default=None)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="chat", cascade="all, delete-orphan"
    )
    user: Mapped["User"] = relationship(back_populates="chats")


class ChatMessage(Base, UuidId, Timestamp):
    __tablename__ = "chat_messages"

    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chats.id"), nullable=False
    )
    role: Mapped[Roles] = mapped_column(Enum(Roles))
    content: Mapped[str]
    image_urls: Mapped[list[str]] = mapped_column(
        JSONB, default=list, server_default="[]", nullable=False
    )

    chat: Mapped["Chat"] = relationship(back_populates="messages")
