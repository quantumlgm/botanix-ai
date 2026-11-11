from aiogram.types import InlineKeyboardMarkup, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

def start_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()

    builder.button(
        text="Запустить Botanix",
        web_app=WebAppInfo(url="https://botanix-frontend.onrender.com")
    )

    return builder.as_markup()