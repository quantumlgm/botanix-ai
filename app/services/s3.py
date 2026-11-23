import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import aioboto3
from botocore.exceptions import ClientError
from types_aiobotocore_s3 import S3Client

from app.core.config import settings

aioboto = aioboto3.Session()


@asynccontextmanager
async def get_s3_client() -> AsyncGenerator[S3Client, None]:
    async with aioboto.client(
        service_name="s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    ) as client:
        yield client


def build_image_url(key: str) -> str:
    if key.startswith(("http://", "https://")):
        return key

    base = settings.S3_PUBLIC_BASE_URL.rstrip("/")
    if not base:
        base = f"{settings.S3_ENDPOINT_URL.rstrip('/')}/{settings.S3_BUCKET_NAME}"

    return f"{base}/{key.lstrip('/')}"


async def upload_image(
    file_bytes: bytes,
    folder: str = "chat_images",
    extension: str = "jpg",
    content_type: str = "image/jpeg",
) -> str:
    filename = f"{uuid.uuid4()}.{extension}"
    key = f"{folder}/{filename}"

    async with get_s3_client() as s3:
        await s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )

    return key


async def delete_image(key: str) -> bool:
    try:
        async with get_s3_client() as s3:
            await s3.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
            return True
    except ClientError:
        return False
