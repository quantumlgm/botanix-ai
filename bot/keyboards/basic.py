from aiogram.types import InlineKeyboardMarkup, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

def start_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()

    builder.button(
        text="🔍 Распознать",
        callback_data="menu_identify"
    )
    builder.button(
        text="ℹ️ Информация",
        callback_data="menu_info"
    )
    builder.button(
        text="Запустить Botanix",
        web_app=WebAppInfo(url="https://botanix-frontend.onrender.com")
    )

    builder.adjust(2, 1)
    return builder.as_markup()


def back_to_main_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    
    builder.button(
        text="⬅️ Назад",
        callback_data="menu_main"
    )
    
    return builder.as_markup()