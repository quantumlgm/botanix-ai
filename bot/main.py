import asyncio

from aiogram import Bot, Dispatcher

from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from bot.core.config import settings
from bot.handlers.basic import router as basic_router


async def main() -> None:
    bot = Bot(
        token=settings.BOT_TOKEN,    
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)   
    )

    dp = Dispatcher()

    dp.include_router(basic_router)

    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    try: 
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Exit")