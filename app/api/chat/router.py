from collections.abc import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat.models import Chat, ChatMessage
from app.api.chat.schemas import (
    BotReplyResponse,
    ChatAskRequest,
    ChatCreateResponse,
    MessageHistoryResponse,
    UserChatResponse,
    UserMessageRequest,
)
from app.api.chat.service import (
    create_chat,
    delete_chat,
    get_chat_messages,
    get_user_chat,
    get_user_chats,
)
from app.api.users.models import User
from app.api.users.service import get_current_user
from app.core.enums import MimeType
from app.services.converstation import (
    send_message_flow,
    send_message_stream_flow,
)
from app.services.postgres import get_session

router = APIRouter(prefix="/chats", tags=["Chats"])


@router.post(
    "",
    response_model=ChatCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new text chat",
)
async def create_chat_handle(
    payload: UserMessageRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChatCreateResponse:
    title = payload.message.strip()[:30]

    created_chat = await create_chat(session, current_user.id, title)

    ai_reply = await send_message_flow(
        session=session,
        chat_id=created_chat.id,
        user_id=current_user.id,
        message=payload.message,
    )

    return ChatCreateResponse(chat_id=created_chat.id, reply=ai_reply)


@router.post(
    "/{chat_id}/messages",
    response_model=BotReplyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new text chat",
)
async def send_message_handle(
    chat_id: UUID,
    payload: UserMessageRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BotReplyResponse:
    ai_reply = await send_message_flow(
        session=session,
        chat_id=chat_id,
        user_id=current_user.id,
        message=payload.message,
    )
    return BotReplyResponse(reply=ai_reply)


@router.post("/{chat_id}/stream", summary="Stream chat message reply")
async def send_message_stream_handle(
    chat_id: UUID,
    payload: ChatAskRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    stream_generator = send_message_stream_flow(
        session=session,
        user_id=current_user.id,
        chat_id=chat_id,
        message=payload.message,
    )

    return StreamingResponse(stream_generator, media_type=MimeType.MEDIA_EVENT_STREAM)


@router.get(
    "/{chat_id}/messages",
    response_model=list[MessageHistoryResponse],
    summary="Get messages",
)
async def get_messages_handle(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Sequence[ChatMessage]:
    await get_user_chat(session=session, chat_id=chat_id, user_id=current_user.id)
    return await get_chat_messages(session=session, chat_id=chat_id)


@router.get("", response_model=list[UserChatResponse], summary="Get all user chats")
async def get_chats_handle(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Sequence[Chat]:
    user_chats = await get_user_chats(session=session, user_id=current_user.id)
    return user_chats


@router.delete(
    "/{chat_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an existing chat",
)
async def delete_chat_handle(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await delete_chat(session=session, user_id=current_user.id, chat_id=chat_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
