from pydantic import SecretStr
from pydantic_core import Url
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    IDENTIFIER_API_URL: str = "https://my-api.plantnet.org/v2/identify/all"
    IDENTIFIER_API_KEY: SecretStr 
    PROVIDER_API_KEY: str
    PROVIDER_URL: str = "https://openrouter.ai/api/v1"
    MODEL_NAME: str = "baidu/ernie-5.5-flash-preview:free"
    MULTIMODAL_MODEL_NAME: str = "inclusionai/ling-3.2-flash:free"

    POSTGRES_USER: str
    POSTGRES_DB: str
    POSTGRES_PASSWORD: SecretStr
    POSTGRES_HOST: str
    POSTGRES_PORT: int

    BOT_TOKEN: SecretStr
    BOT_INTERNAL_SECRET: SecretStr

    DEBUG: bool = False
    CORS_ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    S3_ACCESS_KEY: SecretStr
    S3_SECRET_KEY: SecretStr
    S3_BUCKET_NAME: str = "botanix-ai"
    S3_ENDPOINT_URL: str = "https://storage.yandexcloud.net"
    S3_PUBLIC_BASE_URL: str = ""
    S3_REGION: str = "ru-central1"

    def _build_pg_dsn(self, scheme: str) -> str:
        return str(
            Url.build(
                scheme=scheme,
                username=self.POSTGRES_USER,
                password=self.POSTGRES_PASSWORD.get_secret_value(),
                host=self.POSTGRES_HOST,
                port=self.POSTGRES_PORT,
                path=self.POSTGRES_DB,
            )
        )

    @property
    def pg_psycopg_dsn(self) -> str:
        return self._build_pg_dsn("postgresql+psycopg")

    @property
    def pg_asyncpg_dsn(self) -> str:
        return self._build_pg_dsn("postgresql+asyncpg")


    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = AppSettings()
