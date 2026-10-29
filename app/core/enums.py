from enum import StrEnum


class MimeType(StrEnum):
    IMAGE_JPEG = "image/jpeg"
    IMAGE_PNG = "image/png"
    IMAGE_WEBP = "image/webp"


class Roles(StrEnum):
    SYSTEM = "system"
    USER = "user"    