import logging
import secrets

import httpx
from fastapi import HTTPException, status
from pydantic import ValidationError

from app.api.identify.schemas import PlantNetResponse
from app.core.config import settings
from app.core.enums import MimeType

logger = logging.getLogger(__name__)

NO_PLANT_FOUND_DETAIL = (
    "Не удалось обнаружить растение на снимке. "
    "Пожалуйста, сфокусируйтесь на листе или цветке."
)
IDENTIFICATION_UNAVAILABLE_DETAIL = (
    "Сервис распознавания временно недоступен. Попробуйте позже."
)


def parse_response(response_content: bytes) -> PlantNetResponse:
    data = PlantNetResponse.model_validate_json(response_content)
    if not data.results:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=NO_PLANT_FOUND_DETAIL,
        )
    return data


async def identify_service(image_bytes: bytes) -> PlantNetResponse:
    params = {"api-key": settings.IDENTIFIER_API_KEY}

    file_name = f"scan_{secrets.token_hex(4)}.jpg"

    files = [("images", (file_name, image_bytes, MimeType.IMAGE_JPEG))]

    data = {"organs": ["auto"]}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                settings.IDENTIFIER_API_URL, params=params, files=files, data=data
            )
            if response.status_code == status.HTTP_404_NOT_FOUND:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=NO_PLANT_FOUND_DETAIL,
                )
            if response.status_code != status.HTTP_200_OK:
                logger.warning(
                    "PlantNet returned status %s during plant identification",
                    response.status_code,
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=IDENTIFICATION_UNAVAILABLE_DETAIL,
                )

            return parse_response(response_content=response.content)
    except HTTPException:
        raise
    except (httpx.HTTPError, ValidationError, ValueError):
        logger.exception("PlantNet identification request failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=IDENTIFICATION_UNAVAILABLE_DETAIL,
        ) from None
