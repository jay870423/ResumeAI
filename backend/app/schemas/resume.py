from pydantic import BaseModel, Field
from typing import Optional


class ResumeAnalysisRequest(BaseModel):
    """简历分析请求"""
    resume_text: str = Field(..., description="简历文本内容", min_length=10)
    job_description: Optional[str] = Field(None, description="岗位描述（可选）")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="温度参数")
    max_tokens: int = Field(2048, ge=100, le=4096, description="最大token数")


class InterviewPrepRequest(BaseModel):
    """面试准备请求"""
    resume_text: str = Field(..., description="简历文本内容", min_length=10)
    job_description: str = Field(..., description="岗位描述", min_length=10)
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="温度参数")
    max_tokens: int = Field(4096, ge=100, le=8192, description="最大token数")


class ChatMessage(BaseModel):
    """聊天消息"""
    role: str = Field(..., description="角色: system/user/assistant")
    content: str = Field(..., description="消息内容")


class ChatRequest(BaseModel):
    """通用聊天请求"""
    messages: list[ChatMessage] = Field(..., description="消息列表", min_items=1)
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="温度参数")
    max_tokens: int = Field(2048, ge=100, le=4096, description="最大token数")


class ChatResponse(BaseModel):
    """聊天响应"""
    reply: str
    model: str
    usage: dict


class ResumeAnalysisResponse(BaseModel):
    """简历分析响应"""
    analysis: dict
    model: str
    usage: dict


class InterviewPrepResponse(BaseModel):
    """面试准备响应"""
    questions: list[dict]
    model: str
    usage: dict


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    version: str
    model: str
