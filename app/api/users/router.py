
from fastapi import APIRouter, Depends, Request

from app.api.users.models import User
from app.api.users.schemas import UserProfileResponse
from app.api.users.service import get_current_user
from app.core.enums import RateLimit
from app.services.limiter import limiter

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/me", response_model=UserProfileResponse, summary="Get current user profile"
)
@limiter.limit(RateLimit.LOW)
async def get_user_profile_handle(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user
