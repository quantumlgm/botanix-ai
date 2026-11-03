from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.users.models import User


async def get_or_create_user(
    session: AsyncSession,
    payload: dict
) -> User | None:
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

