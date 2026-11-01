from typing import Sequence
from uuid import UUID

from fastapi import HTTPException, status
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.chat.models import Chat, ChatMessage
from app.core.config import settings
from app.core.enums import Roles
from app.services.prompts import PLANT_EXPERT_SYSTEM_PROMPT


client = AsyncOpenAI(
    base_url=settings.PROVIDER_URL,
    api_key=settings.PROVIDER_API_KEY,
    default_headers={
        "HTTP-Referer": "https://github.com/botanix-ai",
        "X-Title": "Botanix AI",
    },
)


async def create_chat(
    session: AsyncSession, title: str, plant_context: str | None = None
) -> Chat:
    chat = Chat(title=title, plant_context=plant_context)

    session.add(chat)
    await session.commit()
    await session.refresh(chat)

    return chat


async def create_message(
    session: AsyncSession, chat_id: UUID, role: Roles, content: str
) -> ChatMessage:
    message = ChatMessage(chat_id=chat_id, role=role, content=content)

    session.add(message)
    await session.commit()
    await session.refresh(message)

    return message


async def get_chat_messages(
    session: AsyncSession, chat_id: UUID
) -> Sequence[ChatMessage]:
    query = (
        select(ChatMessage)
        .where(ChatMessage.chat_id == chat_id)
        .order_by(ChatMessage.created_at.asc())
    )

    result = await session.execute(query)
    return result.scalars().all()


async def send_message_flow(session: AsyncSession, chat_id: UUID, user_text: str):
    query = select(Chat).where(Chat.id == chat_id)
    result = await session.execute(query)
    chat_record = result.scalar_one_or_none()

    if chat_record is None:
        raise HTTPException(
            detail="Chat not found", status_code=status.HTTP_404_NOT_FOUND
        )

    await create_message(session, chat_id, Roles.USER, user_text)

    history = await get_chat_messages(session, chat_id)

    ai_reply_text = await generate_expert_reply(
        history=history, plant_context=chat_record.plant_context
    )

    await create_message(session, chat_id, Roles.ASSISTANT, ai_reply_text)

    return ai_reply_text


async def generate_expert_reply(
    history: Sequence[ChatMessage], plant_context: str | None = None
) -> str:
    system_prompt = PLANT_EXPERT_SYSTEM_PROMPT
    if plant_context:
        system_prompt += f"\nТекущее изучаемое растение: {plant_context}"

    llm_messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        llm_messages.append({"role": msg.role, "content": msg.content})

    response = await client.chat.completions.create(
        model=settings.MODEL_NAME, messages=llm_messages, temperature=0.3
    )
    choice = response.choices[0]
    return choice.message.content or "Не удалось получить ответ от модели."
