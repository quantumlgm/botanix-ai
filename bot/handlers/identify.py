from aiogram.enums import ParseMode

from app.core.config import settings

import io
from aiogram import Bot, Router
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo
import httpx

from bot.core.helpers import build_plant_markdown


router = Router(name="identify")


@router.message(F.photo)
async def photo_handler(message: Message, bot: Bot):
    if not message.from_user or not message.photo:
        return

    status_msg = await message.answer("🔍 Определение растения...")
    headers = {
        "X-Bot-Secret": settings.BOT_INTERNAL_SECRET,
        "X-Telegram-User-Id": str(message.from_user.id),
        "X-Telegram-First-Name": message.from_user.first_name or "",
        "X-Telegram-Username": message.from_user.username or "",
    }
    try:
        photo = message.photo[-1]
        file_buffer = io.BytesIO()
        await bot.download(file=photo, destination=file_buffer)
        file_buffer.seek(0)

        files = {
            "image": (f"tg_{photo.file_unique_id}.jpg", file_buffer, "image/jpeg")
        }
        data = {"question": message.caption} if message.caption else {}

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://botanix-ai-95rv.onrender.com/plants/identify",
                files=files,
                data=data,
                headers=headers,
            )
            response.raise_for_status()
            result = response.json()

    formatted_text = build_plant_markdown(result)
    chat_id = result.get("chat_id", "")

    app_url = (
        f"https://botanix-frontend.onrender.com?chat_id={chat_id}"
        if chat_id
        else "https://botanix-frontend.onrender.com"
    )

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="💬 Продолжить диалог в приложении",
                    web_app=WebAppInfo(url=app_url),
                )
            ]
        ]
    )

    await status_msg.edit_text(
        text=formatted_text,
        parse_mode=ParseMode.MARKDOWN_V2,
        reply_markup=keyboard,
    )