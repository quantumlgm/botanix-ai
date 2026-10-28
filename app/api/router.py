from fastapi import APIRouter, File, UploadFile, status

from app.api.identify.service import identify_service
from app.services.images.images import image_validate

router = APIRouter(prefix="/plants", tags=["Plants"])


@router.post(
    "/identify", 
    status_code=status.HTTP_201_CREATED,
    summary="Identify your plant"
)
async def identify_handle(image: UploadFile = File(...)):
    image_bytes = await image_validate(image)

    result = await identify_service(image_bytes)
