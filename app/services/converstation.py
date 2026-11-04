from collections.abc import Sequence
from typing import Any
from uuid import UUID

from collections.abc import AsyncGenerator
from fastapi import HTTPException, status
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat.models import Chat, ChatMessage
from app.api.chat.service import get_chat_messages, get_user_chat
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


async def create_message(
    session: AsyncSession, chat_id: UUID, role: Roles, content: str
) -> ChatMessage:
    message = ChatMessage(chat_id=chat_id, role=role, content=content)

    session.add(message)
    await session.commit()
    await session.refresh(message)

    return message


async def send_message_flow(session: AsyncSession, chat_id: UUID, user_id: UUID, message: str) -> str:
    chat_record = await get_user_chat(session=session, chat_id=chat_id, user_id=user_id)
    
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
    user_id: UUID,
    chat_id: UUID,
    message: str
) -> AsyncGenerator[str, None]:
    chat_record = await get_user_chat(session=session, user_id=user_id, chat_id=chat_id)

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