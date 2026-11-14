from pydantic_settings import BaseSettings, SettingsConfigDict


class BotSettings(BaseSettings):
    BOT_TOKEN: str
    BACKEND_URL: str
    WEB_APP_URL: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = BotSettings() 