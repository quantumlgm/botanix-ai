from pathlib import Path

from fastapi import UploadFile

from app.core.enums import MimeType
from app.core.functions import mb_to_bytes
from app.services.images.exceptions import ImageExtensionError, ImageWeightError


async def image_validate(image: UploadFile) -> bytes:
    image_bytes = await image.read()

    if image.content_type not in MimeType:
        raise ImageExtensionError()

    if not image.filename:
        raise ImageExtensionError()

    ext = Path(image.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise ImageExtensionError()

    if len(image_bytes) > mb_to_bytes(5):
        raise ImageWeightError()

    return image_bytes