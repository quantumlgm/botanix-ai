import datetime
from uuid import UUID

from pydantic import BaseModel


class UserProfileResponse(BaseModel):
    id: UUID
    telegram_id: int
    first_name: str
    username: str | None
    created_at: datetime.datetime


class TelegramUserPayload(BaseModel):
    telegram_id: int
    first_name: str
    username: str | None = None
