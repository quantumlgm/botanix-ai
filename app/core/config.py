

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    API_AI_KEY: str
    API_URL: str = 'https://my-api.plantnet.org/v2/identify/all'

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()