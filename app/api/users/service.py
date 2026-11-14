import logging
import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.users.models import User
from app.api.users.schemas import TelegramUserPayload
from app.core.security import validate_init_data
from app.services.postgres import get_session
from app.core.config import settings


logger = logging.getLogger(__name__)


async def get_or_create_user(
    session: AsyncSession, payload: TelegramUserPayload
) -> User:
    tg_id = payload.telegram_id

    query = (
        insert(User)
        .values(
            telegram_id=tg_id,
            username=payload.username,
            first_name=payload.first_name,
        )
        .on_conflict_do_nothing(index_elements=[User.telegram_id])
        .returning(User)
    )
    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if user is None:
        result = await session.execute(
            select(User).where(User.telegram_id == tg_id)
        )
        user = result.scalar_one()

    await session.commit()
    return user


async def get_current_user(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_telegram_init_data: Annotated[
        str | None, Header(alias="X-Telegram-Init-Data")
    ] = None,
    x_bot_secret: Annotated[
        str | None, Header(alias="X-Bot-Secret")
    ] = None,
    x_telegram_user_id: Annotated[
        int | None, Header(alias="X-Telegram-User-Id")
    ] = None,
) -> User:
    if x_bot_secret is not None:
        if not secrets.compare_digest(
            x_bot_secret, settings.BOT_INTERNAL_SECRET
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid bot secret",
            )

        if not x_telegram_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing X-Telegram-User-Id header",
            )

        user_payload = TelegramUserPayload(
            telegram_id=x_telegram_user_id,
            first_name=request.headers.get("X-Telegram-First-Name", "Telegram User"),
            username=request.headers.get("X-Telegram-Username"),
        )
        user = await get_or_create_user(session=session, payload=user_payload)
        request.state.user_id = str(user.id)
        return user

    
    if not x_telegram_init_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Telegram-Init-Data header",
        )

    user_payload = validate_init_data(
        init_data=x_telegram_init_data,
    )

    user = await get_or_create_user(session=session, payload=user_payload)
    request.state.user_id = str(user.id)

    return user
