from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid
from sqlalchemy.dialects.postgresql import UUID
from app.core.enums import Roles
from app.services.postgres import Base, UuidId, Timestamp


class Chat(Base, UuidId, Timestamp):
    __tablename__ = "chats"

    title: Mapped[str]
    plant_context: Mapped[str]

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="chat", cascade="all, delete-orphan"
    )


class ChatMessage(Base, UuidId, Timestamp):
    __tablename__ = "chat_messages"

    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chats.id"), nullable=False
    )
    role: Mapped[Roles] = mapped_column(Enum(Roles))
    content: Mapped[str]

    chat: Mapped["Chat"] = relationship(back_populates="messages")
