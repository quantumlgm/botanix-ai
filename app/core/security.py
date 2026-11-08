import hashlib
import hmac
import json
import logging
import time
from urllib.parse import parse_qsl

from fastapi import HTTPException, status
from pydantic import ValidationError

from app.api.users.schemas import TelegramUserPayload
from app.core.config import settings

logger = logging.getLogger(__name__)


def _reject_init_data(detail: str) -> HTTPException:
    logger.warning("Rejected Telegram init data: %s", detail)
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
    )


def validate_init_data(
    init_data: str, bot_token: str = settings.BOT_TOKEN
) -> TelegramUserPayload:
    if settings.DEBUG and init_data == "dev_mock":
        return TelegramUserPayload(
            telegram_id=123456789,
            first_name="Developer",
            username="botanix_dev",
        )

    try:
        data_pairs = parse_qsl(
            init_data, keep_blank_values=True, strict_parsing=True
        )
    except ValueError:
        raise _reject_init_data("Malformed Telegram init data.")

    if len({key for key, _ in data_pairs}) != len(data_pairs):
        raise _reject_init_data("Duplicate fields in Telegram init data.")

    parsed_data = dict(data_pairs)
    received_hash = parsed_data.pop("hash", None)

    if not received_hash:
        raise _reject_init_data("Missing hash in Telegram init data.")

    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(parsed_data.items())
    )

    received_auth_date = parsed_data.get("auth_date")
    if not received_auth_date:
        raise _reject_init_data("Missing auth_date in Telegram init data.")

    try:
        auth_date = int(received_auth_date)
    except (ValueError, TypeError):
        raise _reject_init_data("Invalid auth_date format.")

    secret_key = hmac.new(
        key=b"WebAppData", msg=bot_token.encode("utf-8"), digestmod=hashlib.sha256
    ).digest()

    calculated_hash = hmac.new(
        key=secret_key, msg=data_check_string.encode("utf-8"), digestmod=hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise _reject_init_data("The Telegram signature did not match.")

    now = int(time.time())
    if now - auth_date > 86400:
        raise _reject_init_data("Telegram init data is expired.")

    if auth_date > now + 120:
        raise _reject_init_data("Telegram init data auth_date is in the future.")

    user_json_str = parsed_data.get("user")
    if not user_json_str:
        raise _reject_init_data("Telegram init data has no user field.")

    try:
        user_data = json.loads(user_json_str)
        return TelegramUserPayload.model_validate(user_data)
    except (json.JSONDecodeError, ValidationError):
        raise _reject_init_data("Invalid user data in Telegram init data.")
