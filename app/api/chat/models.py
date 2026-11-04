import uuid

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import Roles
from app.services.postgres import Base, Timestamp, UuidId


class Chat(Base, UuidId, Timestamp):
    __tablename__ = "chats"

    title: Mapped[str]
    plant_context: Mapped[str | None] = mapped_column(nullable=True, default=None)

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="chat", cascade="all, delete-orphan"
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    user: Mapped["User"] = relationship(back_populates="chats")


class ChatMessage(Base, UuidId, Timestamp):
    __tablename__ = "chat_messages"

    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chats.id"), nullable=False
    )
    role: Mapped[Roles] = mapped_column(Enum(Roles))
    content: Mapped[str]

    chat: Mapped["Chat"] = relationship(back_populates="messages")
