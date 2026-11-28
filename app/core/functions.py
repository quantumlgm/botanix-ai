from fastapi import HTTPException, Header, status

from app.services.images.exceptions import MegabyteNotLessNull


def mb_to_bytes(mb: float) -> int:
    if mb < 0:
        raise MegabyteNotLessNull()
    return int(mb * 1024 * 1024)


MAX_IDENTIFY_BODY_SIZE = 6 * 1024 * 1024
async def check_content_length(content_length: int | None = Header(default=None)):
    if content_length is not None and content_length > MAX_IDENTIFY_BODY_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Файл слишком большой",
        )
