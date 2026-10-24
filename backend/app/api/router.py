from fastapi import APIRouter

from app.api.v1 import auth, companies, orgs, users
from app.modules.content import router as content_router

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(orgs.router, prefix="/orgs", tags=["orgs"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(content_router.router, prefix="/content", tags=["content"])
