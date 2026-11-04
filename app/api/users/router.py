
from fastapi import APIRouter, Depends

from app.api.users.models import User
from app.api.users.schemas import UserProfileResponse
from app.api.users.service import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/me", response_model=UserProfileResponse, summary="Get current user profile"
)
async def get_user_profile_handle(
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user
