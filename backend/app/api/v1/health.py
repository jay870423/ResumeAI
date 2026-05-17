from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["系统"])


class HealthResponse(BaseModel):
    status: str
    version: str
    model: str


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        model="abab7",
    )
