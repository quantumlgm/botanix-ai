from enum import StrEnum


class ImageMimeType(StrEnum):
    JPEG = "image/jpeg"
    PNG = "image/png"
    WEBP = "image/webp"


class StreamMimeType(StrEnum):
    EVENT_STREAM = "text/event-stream"


class Roles(StrEnum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class RateLimit(StrEnum):
    LOW = "5/minute"
    MEDIUM = "10/minute"
    HIGH = "60/minute"
    BURST = "120/minute"
