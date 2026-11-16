from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import telegramify_markdown
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, Message

from bot.core.config import settings


def build_web_app_url(chat_id: str | None = None) -> str:
    parts = urlsplit(settings.WEB_APP_URL)
    query = parse_qsl(parts.query, keep_blank_values=True)
    if chat_id:
        query.append(("chat_id", chat_id))
    return urlunsplit(parts._replace(query=urlencode(query)))


async def safe_edit_text(
    callback: CallbackQuery, text: str, reply_markup: InlineKeyboardMarkup | None = None
) -> None:
    if isinstance(callback.message, Message):
        await callback.message.edit_text(text=text, reply_markup=reply_markup)
    elif callback.message:
        await callback.message.answer(text=text, reply_markup=reply_markup)


def build_plant_markdown(result: dict) -> str:
    sci_name = result.get("scientific_name", "Неизвестный вид")
    family = result.get("family_name", "")
    common_names = result.get("common_names", [])
    confidence = result.get("confidence", 0.0) * 100
    raw_reply = result.get("reply", "")

    header_parts = [f"🌿 **{sci_name}**"]
    if common_names:
        header_parts.append(f"*{', '.join(common_names)}*")
    if family:
        header_parts.append(f"🧬 Семейство: {family}")

    header_parts.append(f"🎯 Точность: **{confidence:.0f}%**")

    full_markdown = "\n".join(header_parts) + "\n\n" + raw_reply

    converted = telegramify_markdown.markdownify(full_markdown)

    if len(converted) > 4000:
        converted = (
            converted[:4000] + "\n\n\\.\\.\\. *Полный текст доступен в приложении*"
        )

    return converted
