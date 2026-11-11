from pydantic_core import Url
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    IDENTIFIER_API_URL: str = "https://my-api.plantnet.org/v2/identify/all"
    IDENTIFIER_API_KEY: str
    PROVIDER_API_KEY: str
    PROVIDER_URL: str = "https://openrouter.ai/api/v1"
    MODEL_NAME: str = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"

    POSTGRES_USER: str
    POSTGRES_DB: str
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int

    BOT_TOKEN: str

    DEBUG: bool = False
    CORS_ALLOWED_ORIGINS: str = (
        "http://localhost:5173,http://127.0.0.1:5173"
    )

    @property
    def pg_psycopg_dsn(self) -> str:
        return str(
            Url.build(
                scheme="postgresql+psycopg",
                username=self.POSTGRES_USER,
                password=self.POSTGRES_PASSWORD,
                host=self.POSTGRES_HOST,
                port=self.POSTGRES_PORT,
                path=self.POSTGRES_DB,
            )
        )
    
    @property
    def pg_asyncpg_dsn(self) -> str:        
        return str(
            Url.build(
                scheme="postgresql+asyncpg",
                username=self.POSTGRES_USER,
                password=self.POSTGRES_PASSWORD,
                host=self.POSTGRES_HOST,
                port=self.POSTGRES_PORT,
                path=self.POSTGRES_DB,
            )
        )
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = AppSettings()
