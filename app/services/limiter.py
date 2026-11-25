import secrets
from app.core.config import settings
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.security import validate_init_data


def get_rate_limit_key(request: Request) -> str:
    bot_secret = request.headers.get("X-Bot-Secret")
    if bot_secret and secrets.compare_digest(
        bot_secret, settings.BOT_INTERNAL_SECRET.get_secret_value()
    ):
        telegram_user_id = request.headers.get("X-Telegram-User-Id")
        if telegram_user_id and telegram_user_id.isdigit():
            return f"tg:{telegram_user_id}"

    init_data = request.headers.get("X-Telegram-Init-Data")
    if init_data:
        try:
            payload = validate_init_data(init_data=init_data)
            return f"tg:{payload.telegram_id}"
        except Exception:
            pass

    return get_remote_address(request)


limiter = Limiter(
    key_func=get_remote_address,
    strategy="moving-window",
    storage_uri=settings.RATE_LIMIT_STORAGE_URI
)
