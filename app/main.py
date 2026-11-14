import asyncio
import logging
import os
import time

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.chat.router import router as chat_router
from app.api.identify.router import router as identify_router
from app.api.users.router import router as user_router
from app.core.config import settings
from app.services.limiter import limiter
from bot.main import main as bot_main


logger = logging.getLogger("app.request")
api = FastAPI()


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(
        self, scope: Scope, receive: Receive, send: Send
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started_at = time.perf_counter()
        client = scope.get("client")
        client_ip = client[0] if client else "unknown"
        status_code = 500
        state = scope.setdefault("state", {})

        async def log_response(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, log_response)
        except Exception:
            logger.exception(
                "request failed method=%s path=%s status_code=%s client_ip=%s "
                "user_id=%s duration_ms=%.2f",
                scope["method"],
                scope["path"],
                status_code,
                client_ip,
                state.get("user_id", "-"),
                (time.perf_counter() - started_at) * 1000,
            )
            raise

        logger.info(
            "request completed method=%s path=%s status_code=%s client_ip=%s "
            "user_id=%s duration_ms=%.2f",
            scope["method"],
            scope["path"],
            status_code,
            client_ip,
            state.get("user_id", "-"),
            (time.perf_counter() - started_at) * 1000,
        )


api.state.limiter = limiter


api.include_router(identify_router)
api.include_router(chat_router)
api.include_router(user_router)

cors_app = CORSMiddleware(
    app=api,
    allow_origins=[
        origin.strip()
        for origin in settings.CORS_ALLOWED_ORIGINS.split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app = RequestLoggingMiddleware(cors_app)


async def start_app():
    config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        log_level="info",
        proxy_headers=True,
        forwarded_allow_ips="*",
    )
    server = uvicorn.Server(config)
    await server.serve()


async def start_bot():
    await bot_main()


async def main():
    await asyncio.gather(
        start_app(),
        start_bot()
    )


if __name__ == "__main__":
    asyncio.run(main())
