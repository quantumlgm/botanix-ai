import uvicorn
from fastapi import FastAPI

from app.api.identify.router import router as identify_router
from app.api.chat.router import router as chat_router

app = FastAPI()
app.include_router(identify_router)
app.include_router(chat_router)


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
