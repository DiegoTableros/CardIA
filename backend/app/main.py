"""CardIA - API educativa de tarjetas de credito en Mexico."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import router as v1_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.db.seed import seed


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await seed()  # idempotente (D1): en Vercel re-siembra en cada cold start
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="CardIA API",
        version="0.1.0",
        description="Plataforma educativa de perfiles de tarjetas de crédito en México. No es asesoría financiera.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    app.include_router(v1_router)
    return app


app = create_app()
