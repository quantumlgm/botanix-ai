import logging
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.users.models import User
from app.api.users.schemas import TelegramUserPayload
from app.core.security import validate_init_data
from app.services.postgres import get_session

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
) -> User:
    if not x_telegram_init_data:
        logger.warning("Authentication rejected: missing X-Telegram-Init-Data")
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
