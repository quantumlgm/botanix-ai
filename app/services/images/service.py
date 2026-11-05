from pathlib import Path

from fastapi import UploadFile
import filetype

from app.core.enums import MimeType
from app.core.functions import mb_to_bytes
from app.services.images.exceptions import ImageExtensionError, ImageWeightError


CHUNK_SIZE = 64 * 1024   
MAX_IMAGE_SIZE = mb_to_bytes(5)
ALLOWED_MIME_TYPES = {item for item in MimeType}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


async def image_validate(
    image: UploadFile
) -> bytes:
    if not image.filename or not image.content_type:
        raise ImageExtensionError()
    
    ext = Path(image.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS or image.content_type not in ALLOWED_MIME_TYPES:
        raise ImageExtensionError()

    buffer = bytearray()
    first_chunk = True

    while chunk := await image.read(CHUNK_SIZE):
        buffer.extend(chunk)

        if len(buffer) > MAX_IMAGE_SIZE:
            raise ImageWeightError()

        if first_chunk:
            kind = filetype.guess(buffer[:512])
            if kind is None or kind.mime not in ALLOWED_MIME_TYPES:
                raise ImageExtensionError()
            first_chunk = False

    if not buffer:
        raise ImageExtensionError()

    return bytes(buffer)
