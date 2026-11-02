from uuid import UUID
from pydantic import BaseModel, Field


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
