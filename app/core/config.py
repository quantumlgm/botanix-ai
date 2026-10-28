

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    IDENTIFIER_API_URL: str = 'https://my-api.plantnet.org/v2/identify/all'
    IDENTIFIER_API_KEY: str
    PROVIDER_API_KEY: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()