from collections.abc import Sequence
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat.models import Chat, ChatMessage
from app.api.chat.schemas import UserChatResponse


async def create_chat(
    session: AsyncSession, 
    user_id: UUID, 
    title: str, 
    plant_context: str | None = None
) -> Chat:
    chat = Chat(
        title=title, 
        user_id=user_id, 
        plant_context=plant_context
    )

    session.add(chat)
    await session.commit()
    await session.refresh(chat)

    return chat


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


async def get_user_chats(
    session: AsyncSession, user_id: UUID
) -> Sequence[Chat]:
    query = (
        select(Chat)
        .where(Chat.user_id == user_id)
        .order_by(Chat.created_at.desc())
    )
    result = await session.execute(query)
    return result.scalars().all()


async def get_chat_messages(
    session: AsyncSession, chat_id: UUID, limit: int = 10
) -> Sequence[ChatMessage]:
    query = (
        select(ChatMessage)
        .where(ChatMessage.chat_id == chat_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )

    result = await session.execute(query)
    messages = result.scalars().all()

    return list(reversed(messages))


async def delete_chat(session: AsyncSession, user_id: UUID, chat_id: UUID):
    query = delete(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
    await session.execute(query)
    await session.commit()
