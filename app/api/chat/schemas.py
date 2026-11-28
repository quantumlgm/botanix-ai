import datetime
from typing import Annotated
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.core.enums import FieldLength, Roles


MAX_MESSAGE_IMAGES = 4
ImageUrl = Annotated[str, Field(max_length=FieldLength.URL)]


class UserMessageRequest(BaseModel):
    message: str = Field(default="", max_length=FieldLength.MESSAGE)
    image_urls: list[ImageUrl] = Field(default_factory=list, max_length=MAX_MESSAGE_IMAGES)

    @model_validator(mode="after")
    def validate_content(self) -> "UserMessageRequest":
        if not self.message.strip() and not self.image_urls:
            raise ValueError("Нужен текст сообщения или изображение")
        return self


class ChatAskRequest(BaseModel):
    message: str = Field(default="", max_length=FieldLength.MESSAGE)
    image_urls: list[ImageUrl] = Field(default_factory=list, max_length=MAX_MESSAGE_IMAGES)
    plant_context: str | None = Field(default=None)

    @model_validator(mode="after")
    def validate_content(self) -> "ChatAskRequest":
        if not self.message.strip() and not self.image_urls:
            raise ValueError("Нужен текст сообщения или изображение")
        return self


class ChatCreateResponse(BaseModel):
    chat_id: UUID
    reply: str


class BotReplyResponse(BaseModel):
    reply: str


class MessageHistoryResponse(BaseModel):
    role: Roles
    content: str
    image_urls: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class UserChatResponse(BaseModel):
    id: UUID
    title: str
    plant_context: str | None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class MediaUploadResponse(BaseModel):
    image_url: str
