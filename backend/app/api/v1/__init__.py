from fastapi import APIRouter
from .health import router as health_router
from .resume import router as resume_router
from .keywords import router as keywords_router
from .optimize import router as optimize_router
from .auth import router as auth_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(resume_router)
api_router.include_router(keywords_router)
api_router.include_router(optimize_router)
