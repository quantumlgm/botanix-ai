import json
from collections.abc import AsyncGenerator, Sequence
from typing import Any
from uuid import UUID

from openai import AsyncOpenAI, OpenAIError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat.models import ChatMessage
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

LLM_HISTORY_LIMIT = 10


async def create_message(
    session: AsyncSession, chat_id: UUID, role: Roles, content: str
) -> ChatMessage:
    message = ChatMessage(chat_id=chat_id, role=role, content=content)

    session.add(message)
    await session.commit()
    await session.refresh(message)

    return message


async def send_message_flow(
    session: AsyncSession, chat_id: UUID, user_id: UUID, message: str
) -> str:
    chat_record = await get_user_chat(session=session, chat_id=chat_id, user_id=user_id)

    await create_message(
        session=session, chat_id=chat_id, role=Roles.USER, content=message
    )

    history = await get_chat_messages(
        session=session, chat_id=chat_id, limit=LLM_HISTORY_LIMIT
    )

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
        model=settings.MODEL_NAME, 
        messages=llm_messages, 
        temperature=0.3,
        frequency_penalty=0.2
    )
    choice = response.choices[0]
    return choice.message.content or "Не удалось получить ответ от модели."


async def stream_expert_reply(
    history: Sequence[ChatMessage], plant_context: str | None = None
) -> AsyncGenerator[str, None]:
    system_prompt = PLANT_EXPERT_SYSTEM_PROMPT
    if plant_context:
        system_prompt += f"\nТекущее изучаемое растение: {plant_context}."

    llm_messages: Any = [{"role": "system", "content": system_prompt}]

    for msg in history:
        llm_messages.append({"role": msg.role, "content": msg.content})

    response_stream = await client.chat.completions.create(
        model=settings.MODEL_NAME,
        messages=llm_messages,
        temperature=0.3,
        stream=True,
        frequency_penalty=0.2
    )

    async for chunk in response_stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def send_message_stream_flow(
    session: AsyncSession,
    chat_id: UUID,
    plant_context: str | None,
    message: str,
) -> AsyncGenerator[str, None]:
    try:
        await create_message(
            session=session, chat_id=chat_id, role=Roles.USER, content=message
        )

        history = await get_chat_messages(
            session=session, chat_id=chat_id, limit=LLM_HISTORY_LIMIT
        )

        full_response_parts: list[str] = []

        async for token in stream_expert_reply(
            history=history, plant_context=plant_context
        ):
            full_response_parts.append(token)
            yield f"data: {json.dumps(token, ensure_ascii=False)}\n\n"

        full_reply = "".join(full_response_parts)
        if full_reply:
            await create_message(
                session=session,
                chat_id=chat_id,
                role=Roles.ASSISTANT,
                content=full_reply,
            )

        yield "data: [DONE]\n\n"
    except (OpenAIError, SQLAlchemyError):
        error_payload = json.dumps(
            {
                "detail": (
                    "Не удалось получить ответ. Попробуйте отправить сообщение ещё раз."
                )
            },
            ensure_ascii=False,
        )
        yield f"event: error\ndata: {error_payload}\n\n"
