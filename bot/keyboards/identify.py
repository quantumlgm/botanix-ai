        
from aiogram.types import InlineKeyboardMarkup, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

def continue_in_app_keyboard(app_url: str):
    builder = InlineKeyboardBuilder()
     
    builder.button(
        text="💬 Продолжить диалог в приложении",
        web_app=WebAppInfo(url=app_url),
    )

    return builder.as_markup()
