from uuid import UUID

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat.models import Chat
from app.api.users.models import User
from app.core.security import validate_init_data
from app.services.postgres import get_session


async def get_or_create_user(
    session: AsyncSession,
    payload: dict
) -> User:
    tg_id = payload.get("id")
    
    query = select(User).where(User.telegram_id == tg_id)
    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if user is not None:
        return user

    new_user = User(
        telegram_id=tg_id,
        username=payload.get("username"), 
        first_name=payload.get("first_name")
    )

    session.add(new_user)
    await session.commit()

    return new_user


async def get_current_user(
    x_telegram_init_data: str | None = Header(default=None, alias="X-Telegram-Init-Data"),
    session: AsyncSession = Depends(get_session)
) -> User:
    if not x_telegram_init_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Missing X-Telegram-Init-Data header",
        )

    user_payload = validate_init_data(
        init_data=x_telegram_init_data,     
    )

    user = await get_or_create_user(
        session=session, 
        payload=user_payload
    )

    return user


async def get_user_chat(
    session: AsyncSession, 
    chat_id: UUID,
    user_id: UUID, 
) -> Chat:
    query = select(Chat).where(
        Chat.user_id == user_id, 
        Chat.id == chat_id
    )
    result = await session.execute(query)
    chat_record = result.scalar_one_or_none()

    if chat_record is None:
        raise HTTPException(
            detail="Chat not found", 
            status_code=status.HTTP_404_NOT_FOUND,
        )
    
    return chat_record
