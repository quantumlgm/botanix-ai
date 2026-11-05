from enum import StrEnum


class MimeType(StrEnum):
    IMAGE_JPEG = "image/jpeg"
    IMAGE_PNG = "image/png"
    IMAGE_WEBP = "image/webp"
    MEDIA_EVENT_STREAM = "text/event-stream"


class Roles(StrEnum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class RateLimit(StrEnum):
    LOW = "5/minute"
    MEDIUM = "10/minute"
    HIGH = "60/minute"
    BURST = "120/minute"
