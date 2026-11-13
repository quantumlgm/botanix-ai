from aiogram import Router, F
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, Message

from bot.core.helpers import safe_edit_text
from bot.core.texts import INFO_TEXT, MAIN_MENU_TEXT
from bot.keyboards.basic import back_to_main_keyboard, start_keyboard


router = Router()


@router.message(CommandStart())
async def start_handler(message: Message):    
    await message.answer(
        text=MAIN_MENU_TEXT,
        reply_markup=start_keyboard()
    )


@router.callback_query(F.data == "menu_info")
async def info_handler(callback: CallbackQuery):
    await safe_edit_text(callback, INFO_TEXT, back_to_main_keyboard())
    await callback.answer()


@router.callback_query(F.data == "menu_main")
async def back_to_main_handler(callback: CallbackQuery):
    await safe_edit_text(callback, MAIN_MENU_TEXT, start_keyboard())
    await callback.answer()


@router.message(Command("help"))
async def help_command_handler(message: Message):
    await message.answer(
        text=INFO_TEXT,
        reply_markup=back_to_main_keyboard()
    )


@router.message(~F.photo & ~F.media_group_id)
async def message_handle(message: Message):
    await message.answer("📸 Пришлите фото растения, чтобы я смог его распознать. Текст, стикеры, голосовые и видео я пока не понимаю.")