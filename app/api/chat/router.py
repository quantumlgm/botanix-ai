from collections.abc import Sequence
from pathlib import Path
from uuid import UUID

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat.converstation import (
    send_message_flow,
    send_message_stream_flow,
)
from app.api.chat.models import Chat, ChatMessage
from app.api.chat.schemas import (
    BotReplyResponse,
    ChatAskRequest,
    ChatCreateResponse,
    MediaUploadResponse,
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
from app.core.enums import ImageMimeType, RateLimit, StreamMimeType
from app.core.functions import check_content_length
from app.services.images.service import image_validate
from app.services.limiter import limiter
from app.services.postgres import get_session
from app.services.s3 import build_image_url, upload_image

router = APIRouter(prefix="/chats", tags=["Chats"])


@router.post(
    "",
    response_model=ChatCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new text chat",
)
@limiter.limit(RateLimit.LOW)
async def create_chat_handle(
    request: Request,
    payload: UserMessageRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChatCreateResponse:
    title = payload.message.strip()[:30] or "Фото растения"

    created_chat = await create_chat(
        session=session,
        user_id=current_user.id,
        title=title,
    )

    ai_reply = await send_message_flow(
        session=session,
        chat_id=created_chat.id,
        user_id=current_user.id,
        message=payload.message,
        image_urls=payload.image_urls,
    )

    return ChatCreateResponse(chat_id=created_chat.id, reply=ai_reply.reply)


@router.post(
    "/{chat_id}/messages",
    response_model=BotReplyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new text chat",
)
@limiter.limit(RateLimit.MEDIUM)
async def send_message_handle(
    request: Request,
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
        image_urls=payload.image_urls,
    )
    return BotReplyResponse(reply=ai_reply.reply)


@router.post(
    "/{chat_id}/stream",
    summary="Stream chat message reply",
    response_model=None,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(RateLimit.MEDIUM)
async def send_message_stream_handle(
    request: Request,
    chat_id: UUID,
    payload: ChatAskRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    chat = await get_user_chat(
        session=session, chat_id=chat_id, user_id=current_user.id
    )

    stream_generator = send_message_stream_flow(
        session=session,
        chat_id=chat_id,
        plant_context=chat.plant_context,
        message=payload.message,
        image_urls=payload.image_urls,
    )

    return StreamingResponse(
        stream_generator,
        media_type=StreamMimeType.EVENT_STREAM,
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/upload",
    response_model=MediaUploadResponse,
    summary="Upload an image in chat",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(check_content_length)]
)
@limiter.limit(RateLimit.MEDIUM)
async def upload_chat_image_handle(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> MediaUploadResponse:
    file_bytes = await image_validate(file)
    extension = Path(file.filename or "").suffix.lower().lstrip(".") or "jpg"

    try:
        key = await upload_image(
            file_bytes=file_bytes,
            extension=extension,
            content_type=file.content_type or ImageMimeType.JPEG,
        )
    except (BotoCoreError, ClientError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Сервис хранения файлов временно недоступен",
        )

    return MediaUploadResponse(image_url=build_image_url(key))


@router.get(
    "/{chat_id}/messages",
    response_model=list[MessageHistoryResponse],
    summary="Get messages",
)
async def get_messages_handle(
    chat_id: UUID,
    limit: int | None = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Sequence[ChatMessage]:
    await get_user_chat(session=session, chat_id=chat_id, user_id=current_user.id)
    return await get_chat_messages(
        session=session, chat_id=chat_id, limit=limit, offset=offset
    )


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
