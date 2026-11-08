import datetime
from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field


class UserProfileResponse(BaseModel):
    id: UUID
    telegram_id: int
    first_name: str
    username: str | None
    created_at: datetime.datetime


class TelegramUserPayload(BaseModel):
    telegram_id: int = Field(validation_alias=AliasChoices("id", "telegram_id"))
    first_name: str
    username: str | None = None
