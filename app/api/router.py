from fastapi import APIRouter, File, UploadFile, status

from app.api.service import identify_service
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

    best_match = result.get("results", [{}])[0]
    
    return {
        "best_match": result.get("bestMatch"),
        "score": best_match.get("score"),
        "species": best_match.get("species", {}).get("scientificNameWithoutAuthor"),
        "common_names": best_match.get("species", {}).get("commonNames", []),
        "family": best_match.get("species", {}).get("family", {}).get("scientificNameWithoutAuthor"),
    }