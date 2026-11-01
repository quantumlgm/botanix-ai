from openai import AsyncOpenAI

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


async def generate_expert_reply(
    user_message: str, plant_context: str | None = None
) -> str:
    system_prompt = PLANT_EXPERT_SYSTEM_PROMPT
    if plant_context:
        system_prompt += f"\nТекущее изучаемое растение: {plant_context}"

    messages = [
        {"role": Roles.SYSTEM, "content": system_prompt},
        {"role": Roles.USER, "content": user_message},
    ]

    response = await client.chat.completions.create(
        model=settings.MODEL_NAME, messages=messages, temperature=0.3
    )
    choice = response.choices[0]
    return choice.message.content or "Не удалось получить ответ от модели."
