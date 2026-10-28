import secrets

import httpx
from fastapi import HTTPException, status

from app.api.identify.schemas import PlantNetResponse
from app.core.config import settings
from app.core.enums import MimeType


def parse_response(response_content: bytes) -> PlantNetResponse:    
    data = PlantNetResponse.model_validate_json(response_content)
    if not data.results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The plant could not be identified in the photo."
        )
    return data


async def identify_service(image_bytes: bytes) -> PlantNetResponse:
    params = {
        "api-key": settings.IDENTIFIER_API_URL
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
            settings.IDENTIFIER_API_URL, 
            params=params, 
            files=files, 
            data=data
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"PlantNet API error: {response.text}"
            )
        
        parsed_result = parse_response(response.content)
        return parsed_result
    
