from app.services.images.exceptions import MegabyteNotLessNull


def mb_to_bytes(mb: float) -> int:
    if mb < 0:
        raise MegabyteNotLessNull
    return int(mb * 1024 * 1024)