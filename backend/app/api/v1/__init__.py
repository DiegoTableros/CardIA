from fastapi import APIRouter

from app.api.v1 import admin, auth, bi, cards, chat, compare, meta, recommend

router = APIRouter(prefix="/api/v1")
for module in (meta, auth, cards, compare, recommend, chat, bi, admin):
    router.include_router(module.router)
