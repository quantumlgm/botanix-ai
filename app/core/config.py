

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    pass


    model_config = SettingsConfigDict(env_file=".env")