import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.api.chat.models import ChatMessage
from app.core.enums import Roles


class UserMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=700)


class ChatAskRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=700)
    plant_context: str | None = Field(default=None)


class ChatCreateResponse(BaseModel):
    chat_id: UUID
    reply: str


class BotReplyResponse(BaseModel):
    reply: str


class MessageHistoryResponse(BaseModel):
    role: Roles
    content: str

    model_config = ConfigDict(from_attributes=True)


class UserChatResponse(BaseModel):
    id: UUID
    title: str
    plant_context: str | None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)