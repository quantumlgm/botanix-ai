from aiogram.types import CallbackQuery, Message, InlineKeyboardMarkup


async def safe_edit_text(
    callback: CallbackQuery, 
    text: str, 
    reply_markup: InlineKeyboardMarkup | None = None
) -> None:
    if isinstance(callback.message, Message):
        await callback.message.edit_text(text=text, reply_markup=reply_markup)
    elif callback.message:
        await callback.message.answer(text=text, reply_markup=reply_markup)
