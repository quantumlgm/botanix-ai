import json
from collections.abc import AsyncGenerator, Sequence
from dataclasses import dataclass
from typing import cast
from uuid import UUID

from openai import AsyncOpenAI, OpenAIError
from openai.types.chat import ChatCompletionMessageParam
from pydantic import ValidationError
from sqlalchemy import func, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat.models import Chat, ChatMessage
from app.api.chat.service import get_chat_messages, get_user_chat
from app.api.identify.schemas import PlantAnalysisResponse, PlantCareInfo
from app.core.config import settings
from app.core.enums import LLMValues, Roles
from app.services.prompts import (
    IMAGE_ANALYSIS_ADDON,
    PLANT_EXPERT_SYSTEM_PROMPT,
    STRUCTURED_ANALYSIS_ADDON,
)
from app.services.s3 import build_image_url

client = AsyncOpenAI(
    base_url=settings.PROVIDER_URL,
    api_key=settings.PROVIDER_API_KEY,
    default_headers={
        "HTTP-Referer": "https://github.com/botanix-ai",
        "X-Title": "Botanix AI",
    },
)

LLM_HISTORY_LIMIT = 10
IMAGE_HISTORY_WINDOW = 3
OLD_IMAGE_MARKER = "[Ранее отправленное фото]"
FALLBACK_REPLY = "Не удалось получить ответ от модели."


@dataclass(slots=True)
class ExpertReply:
    reply: str
    data: PlantCareInfo | None = None


async def create_message(
    session: AsyncSession,
    chat_id: UUID,
    role: Roles,
    content: str,
    image_urls: Sequence[str] | None = None,
) -> ChatMessage:
    message = ChatMessage(
        chat_id=chat_id,
        role=role,
        content=content,
        image_urls=list(image_urls or ()),
    )

    session.add(message)

    await session.execute(
        update(Chat).where(Chat.id == chat_id).values(updated_at=func.now())
    )

    await session.commit()
    await session.refresh(message)

    return message


def has_recent_images(history: Sequence[ChatMessage]) -> bool:
    return any(msg.image_urls for msg in history[-IMAGE_HISTORY_WINDOW:])


def build_system_prompt(plant_context: str | None, include_image_analysis: bool) -> str:
    system_prompt = PLANT_EXPERT_SYSTEM_PROMPT
    if plant_context:
        system_prompt += f"\nТекущее изучаемое растение: {plant_context}"
    if include_image_analysis:
        system_prompt += f"\n\n{IMAGE_ANALYSIS_ADDON}"
    return system_prompt


def select_model_name(structured: bool, has_images: bool) -> str:
    if structured or not has_images:
        return settings.MODEL_NAME
    return settings.MULTIMODAL_MODEL_NAME or settings.MODEL_NAME


def build_llm_messages(
    history: Sequence[ChatMessage], system_prompt: str
) -> list[ChatCompletionMessageParam]:
    llm_messages: list[ChatCompletionMessageParam] = [
        {"role": "system", "content": system_prompt}
    ]
    recent_start = max(len(history) - IMAGE_HISTORY_WINDOW, 0)

    for index, msg in enumerate(history):
        content: str | list[dict[str, object]] = msg.content
        if index >= recent_start and msg.image_urls:
            text = msg.content.strip()
            content = [{"type": "text", "text": text}]
            content.extend(
                {
                    "type": "image_url",
                    "image_url": {"url": build_image_url(image_url)},
                }
                for image_url in msg.image_urls
            )
        elif msg.image_urls:
            content = (
                f"{msg.content}\n\n{OLD_IMAGE_MARKER}"
                if msg.content.strip()
                else OLD_IMAGE_MARKER
            )

        llm_messages.append(
            cast(
                ChatCompletionMessageParam,
                {"role": msg.role.value, "content": content},
            )
        )

    return llm_messages


async def send_message_flow(
    session: AsyncSession,
    chat_id: UUID,
    user_id: UUID,
    message: str,
    image_urls: Sequence[str] | None = None,
    structured: bool = False,
) -> ExpertReply:
    chat_record = await get_user_chat(session=session, chat_id=chat_id, user_id=user_id)

    await create_message(
        session=session,
        chat_id=chat_id,
        role=Roles.USER,
        content=message,
        image_urls=image_urls,
    )

    history = await get_chat_messages(
        session=session, chat_id=chat_id, limit=LLM_HISTORY_LIMIT
    )

    ai_reply = await generate_expert_reply(
        history=history,
        plant_context=chat_record.plant_context,
        structured=structured,
    )

    await create_message(
        session=session, chat_id=chat_id, role=Roles.ASSISTANT, content=ai_reply.reply
    )

    return ai_reply


async def generate_expert_reply(
    history: Sequence[ChatMessage],
    plant_context: str | None = None,
    structured: bool = False,
) -> ExpertReply:
    has_images = has_recent_images(history)
    system_prompt = build_system_prompt(plant_context, has_images)
    model_name = select_model_name(structured=structured, has_images=has_images)

    if structured:
        structured_prompt = f"{system_prompt}\n\n{STRUCTURED_ANALYSIS_ADDON}"
        try:
            response = await client.beta.chat.completions.parse(
                model=model_name,
                messages=build_llm_messages(history, structured_prompt),
                temperature=LLMValues.TEMPERATURE,
                frequency_penalty=LLMValues.FREQUENCY_PENALTY,
                response_format=PlantAnalysisResponse,
            )
            parsed = response.choices[0].message.parsed if response.choices else None
            if parsed is not None and parsed.message.strip():
                return ExpertReply(reply=parsed.message, data=parsed.data)
        except (OpenAIError, ValidationError):
            pass

    response = await client.chat.completions.create(
        model=model_name,
        messages=build_llm_messages(history, system_prompt),
        temperature=LLMValues.TEMPERATURE,
        frequency_penalty=LLMValues.FREQUENCY_PENALTY,
    )
    content = response.choices[0].message.content if response.choices else None
    return ExpertReply(reply=content or FALLBACK_REPLY, data=None)


async def stream_expert_reply(
    history: Sequence[ChatMessage], plant_context: str | None = None
) -> AsyncGenerator[str, None]:
    has_images = has_recent_images(history)
    system_prompt = build_system_prompt(plant_context, has_images)
    model_name = select_model_name(structured=False, has_images=has_images)

    response_stream = await client.chat.completions.create(
        model=model_name,
        messages=build_llm_messages(history, system_prompt),
        temperature=LLMValues.TEMPERATURE,
        stream=True,
        frequency_penalty=LLMValues.FREQUENCY_PENALTY,
    )

    async for chunk in response_stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def send_message_stream_flow(
    session: AsyncSession,
    chat_id: UUID,
    plant_context: str | None,
    message: str,
    image_urls: Sequence[str] | None = None,
) -> AsyncGenerator[str, None]:
    try:
        await create_message(
            session=session,
            chat_id=chat_id,
            role=Roles.USER,
            content=message,
            image_urls=image_urls,
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
