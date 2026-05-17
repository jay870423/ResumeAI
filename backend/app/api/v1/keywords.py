from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.minimax import MiniMaxService
from app.core.config import settings
from app.models.common import ApiResponse

router = APIRouter(prefix="/keywords", tags=["关键词"])


def _error_response(code: int, message: str):
    return ApiResponse(code=code, message=message, data=None)


class KeywordsRequest(BaseModel):
    industry: str = Field(..., description="目标行业")
    major: str = Field(..., description="专业")
    interests: list[str] = Field(default=[], max_length=5, description="兴趣爱好")
    skills: list[str] = Field(default=[], max_length=10, description="个人特长")


@router.post("/generate", response_model=ApiResponse)
async def generate_keywords(body: KeywordsRequest):
    """关键词发散联想"""
    if not body.industry or not body.major:
        return _error_response(4001, "行业和学科不能为空")

    try:
        minimax = MiniMaxService(api_key=settings.minimax_api_key, model=settings.minimax_model)
        result = minimax.generate_keywords(
            body.industry,
            body.major,
            body.interests,
            body.skills,
        )
        return ApiResponse(code=0, message="success", data=result)
    except Exception as e:
        return _error_response(4004, f"关键词生成失败: {str(e)}")
