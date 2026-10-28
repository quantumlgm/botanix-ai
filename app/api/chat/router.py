from fastapi import APIRouter, status

from app.api.chat.schemas import ChatAskRequest, ChatAskResponse
from app.api.chat.service import generate_expert_reply

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/ask", response_model=ChatAskResponse, status_code=status.HTTP_200_OK)
async def ask_expert_handler(payload: ChatAskRequest):
    reply = await generate_expert_reply(
        user_message=payload.message, plant_context=payload.plant_context
    )
    return ChatAskResponse(reply=reply)
