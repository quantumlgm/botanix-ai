from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
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

    @property
    def pg_psycopg_dsn(self) -> str:
        return f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def pg_asyncpg_dsn(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
