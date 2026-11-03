from collections.abc import Sequence
from typing import Any
from uuid import UUID

from collections.abc import AsyncGenerator
from fastapi import HTTPException, status
from openai import AsyncOpenAI
from sqlalchemy import delete, select
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


async def create_message(
    session: AsyncSession, chat_id: UUID, role: Roles, content: str
) -> ChatMessage:
    message = ChatMessage(chat_id=chat_id, role=role, content=content)

    session.add(message)
    await session.commit()
    await session.refresh(message)

    return message


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


async def send_message_flow(session: AsyncSession, chat_id: UUID, message: str) -> str:
    query = select(Chat).where(Chat.id == chat_id)
    result = await session.execute(query)
    chat_record = result.scalar_one_or_none()

    if chat_record is None:
        raise HTTPException(
            detail="Chat not found", status_code=status.HTTP_404_NOT_FOUND
        )

    await create_message(
        session=session, chat_id=chat_id, role=Roles.USER, content=message
    )

    history = await get_chat_messages(session=session, chat_id=chat_id)

    ai_reply = await generate_expert_reply(
        history=history, plant_context=chat_record.plant_context
    )

    await create_message(
        session=session, chat_id=chat_id, role=Roles.ASSISTANT, content=ai_reply
    )

    return ai_reply


async def generate_expert_reply(
    history: Sequence[ChatMessage], plant_context: str | None = None
) -> str:
    system_prompt = PLANT_EXPERT_SYSTEM_PROMPT
    if plant_context:
        system_prompt += f"\nТекущее изучаемое растение: {plant_context}"

    llm_messages: Any = [{"role": "system", "content": system_prompt}]

    for msg in history:
        llm_messages.append({"role": msg.role, "content": msg.content})

    response = await client.chat.completions.create(
        model=settings.MODEL_NAME, messages=llm_messages, temperature=0.3
    )
    choice = response.choices[0]
    return choice.message.content or "Не удалось получить ответ от модели."


async def delete_chat(session: AsyncSession, chat_id: UUID):
    query = delete(Chat).where(Chat.id == chat_id)
    await session.execute(query)
    await session.commit()


async def stream_expert_reply(    
    history: Sequence[ChatMessage],
    plant_context: str | None = None
) -> AsyncGenerator[str, None]:
    system_prompt = PLANT_EXPERT_SYSTEM_PROMPT
    if plant_context:
        system_prompt += f"\nТекущее изучаемое растение: {plant_context}."

    llm_messages: Any = [{"role": "system", "content": system_prompt}]

    for msg in history:
        llm_messages.append({
            "role": msg.role,
            "content": msg.content
        })

    response_stream = await client.chat.completions.create(
        model=settings.MODEL_NAME,
        messages=llm_messages,
        temperature=0.3,
        stream=True, 
    )
    
    async for chunk in response_stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def send_message_stream_flow(
    session: AsyncSession,
    chat_id: UUID,
    message: str
) -> AsyncGenerator[str, None]:
    query = select(Chat).where(Chat.id == chat_id)
    result = await session.execute(query)
    chat_record = result.scalar_one_or_none()

    if chat_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )

    await create_message(
        session=session,
        chat_id=chat_id,
        role=Roles.USER,
        content=message
    )

    history = await get_chat_messages(session=session, chat_id=chat_id)

    full_response_parts: list[str] = []

    async for token in stream_expert_reply(
        history=history, 
        plant_context=chat_record.plant_context
    ):
        full_response_parts.append(token)
        yield f"data: {token}\n\n"

    full_reply = "".join(full_response_parts)
    if full_reply:
        await create_message(
            session=session,
            chat_id=chat_id,
            role=Roles.ASSISTANT,
            content=full_reply
        )