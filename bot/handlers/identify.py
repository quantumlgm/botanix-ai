import io
import time

import httpx
from aiogram import Bot, F, Router
from aiogram.enums import ChatAction, ParseMode
from aiogram.types import Message
from fastapi import UploadFile
from starlette.datastructures import Headers

from app.core.config import settings
from app.services.images.exceptions import ImageExtensionError, ImageWeightError
from app.services.images.service import MAX_IMAGE_SIZE, image_validate
from bot.core.helpers import build_plant_markdown
from bot.core.texts import GENERATION_WARNING
from bot.keyboards.identify import continue_in_app_keyboard

router = Router(name="identify")

processing_users: set[int] = set()
warning_cooldowns: dict[tuple[int, int], float] = {}
WARNING_COOLDOWN_SECONDS = 5


async def warn_single_photo(message: Message) -> None:
    if not message.from_user:
        return

    now = time.monotonic()
    expired_keys = [
        key for key, sent_at in warning_cooldowns.items()
        if now - sent_at >= WARNING_COOLDOWN_SECONDS
    ]
    for key in expired_keys:
        warning_cooldowns.pop(key, None)

    key = (message.chat.id, message.from_user.id)
    last_warning = warning_cooldowns.get(key)
    if last_warning is not None and now - last_warning < WARNING_COOLDOWN_SECONDS:
        return

    warning_cooldowns[key] = now
    await message.answer("Пожалуйста, отправьте одно фото растения, не альбом и не файлом.")


@router.message(F.document)
async def document_handler(message: Message):
    await warn_single_photo(message)


@router.message(F.photo)
async def photo_handler(message: Message, bot: Bot):
    if not message.from_user or not message.photo:
        return

    if message.media_group_id:
        await warn_single_photo(message)
        return

    user_id = message.from_user.id
    if user_id in processing_users:
        return

    processing_users.add(user_id)
    status_msg: Message | None = None
    try:
        status_msg = await message.answer(GENERATION_WARNING)
        await bot.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)

        headers = {
            "X-Bot-Secret": settings.BOT_INTERNAL_SECRET,
            "X-Telegram-User-Id": str(message.from_user.id),
            "X-Telegram-First-Name": message.from_user.first_name or "",
            "X-Telegram-Username": message.from_user.username or "",
        }
        photo = message.photo[-1]
        filename = f"tg_{photo.file_unique_id}.jpg"
        if photo.file_size and photo.file_size > MAX_IMAGE_SIZE:
            await status_msg.edit_text(
                "❌ Фото слишком большое. Отправьте изображение размером не более 5 МБ."
            )
            return

        file_buffer = io.BytesIO()
        await bot.download(file=photo, destination=file_buffer)
        file_buffer.seek(0)

        uploaded_image = UploadFile(
            file=file_buffer,
            filename=filename,
            headers=Headers({"content-type": "image/jpeg"}),
        )
        try:
            image_bytes = await image_validate(image=uploaded_image)
        except ImageWeightError:
            await status_msg.edit_text(
                "❌ Фото слишком большое. Отправьте изображение размером не более 5 МБ."
            )
            return
        except ImageExtensionError:
            await status_msg.edit_text(
                "❌ Не удалось проверить фото. Отправьте изображение в формате JPG, PNG или WebP."
            )
            return

        files = {"image": (filename, image_bytes, "image/jpeg")}
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

        await status_msg.edit_text(
            text=formatted_text,
            parse_mode=ParseMode.MARKDOWN_V2,
            reply_markup=continue_in_app_keyboard(app_url=app_url),
        )
    except httpx.HTTPStatusError as e:
        detail = "Ошибка сервера при распознавании. Попробуйте позже."
        if e.response.status_code in (400, 422, 429):
            try:
                detail = e.response.json().get("detail", detail)
            except (ValueError, AttributeError, TypeError):
                pass
        if status_msg:
            await status_msg.edit_text(f"❌ {detail}")
    except httpx.TimeoutException:
        if status_msg:
            await status_msg.edit_text(
                "⏳ Сервер слишком долго отвечает (возможно, просыпается). Попробуйте отправить фото ещё раз через минуту."
            )
    except Exception:
        if status_msg:
            await status_msg.edit_text(
                "❌ Не удалось распознать растение. Попробуйте сделать более чёткий снимок."
            )
    finally:
        processing_users.discard(user_id)