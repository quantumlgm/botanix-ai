

import textwrap

from aiogram import Bot, Router
from aiogram.filters import CommandStart
from aiogram.types import Message

from bot.keyboards.basic import start_keyboard


router = Router()


@router.message(CommandStart())
async def start_handler(message: Message, bot: Bot):
    text =textwrap.dedent("""
    🌱 **Добро пожаловать в Botanix AI!**, 
    Я помогу тебе распознать комнатные растения по фото
    и подскажу, как правильно за ними ухаживать.
    Нажми кнопку ниже, чтобы запустить приложение.
    """)
    
    await message.answer(
        text=text,
        reply_markup=start_keyboard()
    )