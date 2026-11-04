from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat.service import create_chat
from app.api.identify.service import identify_service
from app.api.users.models import User
from app.api.users.service import get_current_user
from app.services.converstation import send_message_flow
from app.services.images.images import image_validate
from app.services.postgres import get_session
from app.services.prompts import PLANT_ANALYSIS_USER_PROMPT

router = APIRouter(prefix="/plants", tags=["Plants"])


@router.post(
    "/identify", status_code=status.HTTP_201_CREATED, summary="Identify your plant"
)
async def identify_handle(
    question: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    image: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    image_bytes = await image_validate(image=image)
    plant_data = await identify_service(image_bytes=image_bytes)

    if question and question.strip():
        user_message = question.strip()
    else:
        user_message = PLANT_ANALYSIS_USER_PROMPT.format(
            scientific_name=plant_data.scientific_name,
            family=plant_data.family_name,
            common_names=plant_data.common_names_str,
        )

    chat = await create_chat(
        session=session,
        user_id=current_user.id,
        title=plant_data.scientific_name,
        plant_context=plant_data.context_str,
    )

    reply = await send_message_flow(
        session=session, chat_id=chat.id, user_id=current_user.id, message=user_message
    )

    return {"chat_id": chat.id, "plant_data": plant_data.best_result, "reply": reply}
