from aiogram import Bot
from aiogram.types import BotCommand, BotCommandScopeDefault


async def set_bot_commands(bot: Bot) -> None:
    commands = [
        BotCommand(
            command="start",
            description="🌿 Главное меню"
        ),
        BotCommand(
            command="help",
            description="ℹ️ Информация и помощь"
        ),
    ]
    
    await bot.set_my_commands(commands=commands, scope=BotCommandScopeDefault())
