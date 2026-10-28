

import secrets

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.core.enums import MimeType


async def identify_service(image_bytes: bytes):
    params = {
        "api-key": settings.API_AI_KEY
    }

    file_name = f"scan_{secrets.token_hex(4)}.jpg"

    files = [
        ("images", (file_name, image_bytes, MimeType.IMAGE_JPEG))
    ]

    data = {
        "organs": ["auto"]
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            settings.API_URL, 
            params=params, 
            files=files, 
            data=data
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"PlantNet API error: {response.text}"
            )
        return response.json() 