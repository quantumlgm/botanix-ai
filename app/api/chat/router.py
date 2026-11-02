from uuid import UUID

from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.chat.schemas import BotReplyResponse, ChatCreateResponse, UserMessageRequest
from app.core.enums import Roles
from app.services.converstation import create_chat, send_message_flow
from app.services.postgres import get_session


router = APIRouter(prefix="/chats", tags=["Chats"])


@router.post(
    "", 
    response_model=ChatCreateResponse, 
    status_code=status.HTTP_201_CREATED,
    summary="Start a new text chat"
)
async def chat_handle(
    payload: UserMessageRequest, 
    session: AsyncSession = Depends(get_session)
) -> ChatCreateResponse:
    title = payload.message.strip()[:30]

    created_chat = await create_chat(session, title)

    ai_reply = await send_message_flow(session, created_chat.id, payload.message)

    return ChatCreateResponse(
        chat_id=created_chat.id, 
        reply=ai_reply
    )


@router.post(
    "/{chat_id}/messages",
    response_model=..., 
    status_code=status.HTTP_201_CREATED,
    summary="Start a new text chat"
)
async def send_message_handle(
    chat_id: UUID, 
    payload: UserMessageRequest, 
    session: AsyncSession = Depends(get_session)
) -> BotReplyResponse:
    ai_reply = await send_message_flow(session, chat_id, payload.message)    
    return BotReplyResponse(reply=ai_reply)