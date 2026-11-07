import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from fastapi import HTTPException, status

from app.api.users.schemas import TelegramUserPayload
from app.core.config import settings


def validate_init_data(
    init_data: str, bot_token: str = settings.BOT_TOKEN
) -> TelegramUserPayload:
    if settings.DEBUG and init_data == "dev_mock":
        return TelegramUserPayload(
            telegram_id=123456789,
            first_name="Developer",
            username="botanix_dev",
        )

    parsed_data = dict(parse_qsl(init_data))
    received_hash = parsed_data.pop("hash", None)

    if not received_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing hash in Telegram init data.",
        )

    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(parsed_data.items())
    )

    recieved_auth_date = parsed_data.get("auth_date")
    if not recieved_auth_date:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing auth_date in Telegram init data.",
        )

    try:
        auth_date = int(recieved_auth_date)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid auth_date format.",
        )

    secret_key = hmac.new(
        key=b"WebAppData", msg=bot_token.encode("utf-8"), digestmod=hashlib.sha256
    ).digest()

    calculated_hash = hmac.new(
        key=secret_key, msg=data_check_string.encode("utf-8"), digestmod=hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise HTTPException(
            detail="The Telegram signature did not match.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    now = int(time.time())
    if now - auth_date > 86400:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram init data is expired.",
        )

    if auth_date > now + 120:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram init data auth_date is in the future.",
        )

    user_json_str = parsed_data.get("user")
    if not user_json_str:
        raise HTTPException(
            detail="The data does not contain any information about the user.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    user_data = json.loads(user_json_str)
    return TelegramUserPayload.model_validate(user_data)
