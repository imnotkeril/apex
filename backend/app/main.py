from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.router import api_router
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.models.user import User

logger = get_logger(__name__)

APP_VERSION = "1.0.0"

_LLMS_TXT_PATH = Path(__file__).resolve().parent.parent / "llms.txt"


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.core import redis as redis_mod

        await redis_mod.redis_ping()
        logger.info("redis_ping_ok")
    except Exception:
        logger.warning("redis_ping_failed", exc_info=True)
    yield


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        title="APEX API",
        version=APP_VERSION,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")
    register_exception_handlers(app)

    @app.get("/health")
    async def health():
        return {"status": "ok", "version": APP_VERSION}

    @app.get("/llms.txt", response_class=PlainTextResponse)
    async def llms_txt() -> str:
        try:
            return _LLMS_TXT_PATH.read_text(encoding="utf-8")
        except FileNotFoundError:
            logger.warning("llms_txt_missing path=%s", _LLMS_TXT_PATH)
            return "APEX API\n\nSee /docs for the interactive API reference.\n"

    @app.get("/api/content/export")
    async def api_content_export(
        response: Response,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: User = Depends(get_current_user),
    ) -> dict:
        """Frozen-contract alias for GET /api/v1/content/export (Settings -> Advanced export)."""
        from app.modules.content.router import build_org_export

        payload = await build_org_export(db, current_user)
        response.headers["Content-Disposition"] = 'attachment; filename="apex-export.json"'
        return payload

    return app


app = create_app()
