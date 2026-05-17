from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime


class ApiResponse(BaseModel):
    """通用API响应"""
    code: int = 0
    message: str = "success"
    data: Any = None


class ResumeUploadResponse(BaseModel):
    """简历上传响应"""
    resume_id: str
    file_name: str
    file_type: str
    file_size: int
    page_count: Optional[int] = None


class ResumeParseResponse(BaseModel):
    """简历解析响应"""
    resume_id: str
    raw_text: str
    word_count: int
    page_count: int


class BasicInfo(BaseModel):
    name: str
    education: str
    major: Optional[str] = None
    experience_years: int
    current_industry: Optional[str] = None


class Score(BaseModel):
    completeness: float
    structure: float
    keywords: float


class Strength(BaseModel):
    title: str
    evidence: str


class Weakness(BaseModel):
    title: str
    detail: str
    risk: str


class Suggestion(BaseModel):
    section: str
    current: str
    suggestion: str


class AnalyzeResponse(BaseModel):
    """简历分析响应"""
    resume_id: str
    basic_info: BasicInfo
    score: Score
    strengths: list[Strength]
    weaknesses: list[Weakness]
    optimization_suggestions: list[Suggestion]
    analyzed_at: datetime


class PersonaDimension(BaseModel):
    label: str
    value: str
    detail: str
    icon: Optional[str] = None


class PersonaDimensions(BaseModel):
    communication_style: PersonaDimension
    decision_mode: PersonaDimension
    collaboration: PersonaDimension
    motivation: PersonaDimension


class PersonaResponse(BaseModel):
    """职场人格画像响应"""
    resume_id: str
    mbti_type: str
    type_label: str
    type_description: str
    dimensions: PersonaDimensions
    strengths: list[str]
    weaknesses: list[str]
    ideal_environment: str
    career_suggestions: list[str]
    summary: str
    confidence: float
    generated_at: datetime


class KeywordItem(BaseModel):
    keyword: str
    category: str
    priority: str
    reason: str


class ExperienceSuggestion(BaseModel):
    direction: str
    keywords: list[str]


class KeywordsResponse(BaseModel):
    """关键词联想响应"""
    recommended_keywords: list[KeywordItem]
    experience_suggestions: list[ExperienceSuggestion]


class OptimizedChange(BaseModel):
    before: str
    after: str
    reason: str


class OptimizeResponse(BaseModel):
    """AI优化响应"""
    resume_id: str
    optimized_text: str
    changes: list[OptimizedChange]
    summary: str


class ResumeStatusResponse(BaseModel):
    """简历状态响应"""
    resume_id: str
    file_name: str
    status: str
    has_optimized: bool
    created_at: datetime
    analyzed_at: Optional[datetime] = None
