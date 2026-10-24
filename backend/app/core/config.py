from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # DEV ONLY: bypass Supabase JWT and use a default dev user. Never enable in prod.
    DEV_AUTH: bool = False

    DATABASE_URL: str
    POSTGRES_PASSWORD: str

    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str

    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    PERPLEXITY_API_KEY: str = ""
    GROK_API_KEY: str = ""
    GOOGLE_AI_API_KEY: str = ""

    # Content Engine — Telegram (optional)
    TELEGRAM_API_ID: int = Field(default=0, description="Telethon API id (my.telegram.org)")
    TELEGRAM_API_HASH: str = Field(default="", description="Telethon API hash")
    TELEGRAM_BOT_TOKEN: str = Field(default="", description="Bot token for publishing sendMessage")
    TELEGRAM_CHAT_ID: str = Field(default="", description="Default chat/channel id for publish")

    MAX_AI_COST_PER_DAY_USD: float = 20.0

    DEFAULT_ORG_SLUG: str = Field(default="default", description="Bootstrap org slug for first-time OAuth users")
    DEFAULT_ORG_NAME: str = Field(default="APEX Default", description="Human-readable name for bootstrap org")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
