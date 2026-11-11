from pydantic_settings import BaseSettings, SettingsConfigDict


class BotSettings(BaseSettings):
    BOT_TOKEN: str
    BACKEND_URL: str = "https://botanix-ai-95rv.onrender.com"
    WEB_APP_URL: str = "https://botanix-frontend.onrender.com"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = BotSettings()