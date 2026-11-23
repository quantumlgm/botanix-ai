import asyncio
import os

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.chat.router import router as chat_router
from app.api.identify.router import router as identify_router
from app.api.users.router import router as user_router
from app.core.config import settings
from app.core.exceptions import AppError
from app.services.limiter import limiter
from bot.main import main as bot_main

app = FastAPI()
app.state.limiter = limiter


@app.exception_handler(AppError)
async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RateLimitExceeded)
async def handle_rate_limit_exceeded(
    request: Request, exc: RateLimitExceeded
) -> Response:
    return _rate_limit_exceeded_handler(request, exc)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.CORS_ALLOWED_ORIGINS
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(identify_router)
app.include_router(chat_router)
app.include_router(user_router)


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
    await asyncio.gather(start_app(), start_bot())


if __name__ == "__main__":
    asyncio.run(main())
