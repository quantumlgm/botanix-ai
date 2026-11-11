

import textwrap

from aiogram import Bot, Router, F
from aiogram.filters import CommandStart
from aiogram.types import CallbackQuery, Message

from bot.core.helpers import safe_edit_text
from bot.core.texts import MAIN_MENU_TEXT
from bot.keyboards.basic import back_to_main_keyboard, start_keyboard


router = Router()


@router.message(CommandStart())
async def start_handler(message: Message):
    text = MAIN_MENU_TEXT
    
    await message.answer(
        text=text,
        reply_markup=start_keyboard()
    )


@router.callback_query(F.data == "menu_info")
async def info_handler(callback: CallbackQuery):
    info_text = textwrap.dedent("""
        ℹ️ <b>Информация и команды</b>

        <b>/start</b> — перезапустить бота и вызывать главное меню.
        
        Я использую нейросети для анализа и определения болезней растений в два этапа. Откройте WebApp или выберите режим распознавания.
    """)

    await safe_edit_text(callback, info_text, back_to_main_keyboard())
    await callback.answer()


@router.callback_query(F.data == "menu_main")
async def back_to_main_handler(callback: CallbackQuery):
    await safe_edit_text(callback, MAIN_MENU_TEXT, start_keyboard())
    await callback.answer()