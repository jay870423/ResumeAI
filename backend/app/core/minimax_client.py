import httpx
from typing import Optional, Any
from app.core.config import settings


class MiniMaxClient:
    def __init__(self):
        self.api_url = settings.MINIMAX_API_URL
        self.model = settings.MINIMAX_MODEL
        self.timeout = 120.0

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> dict[str, Any]:
        """
        调用MiniMax Chat API
        
        Args:
            messages: 消息列表，格式 [{"role": "user/assistant/system", "content": "..."}]
            temperature: 温度参数
            max_tokens: 最大token数
        
        Returns:
            API响应字典
        """
        headers = {
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                self.api_url,
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    def build_resume_analysis_prompt(
        self, resume_text: str, job_description: Optional[str] = None
    ) -> list[dict[str, str]]:
        """构建简历分析提示词"""
        if job_description:
            prompt = f"""你是一位专业的简历分析顾问。请分析以下简历，并结合岗位描述给出建议。

简历内容：
{resume_text}

岗位描述：
{job_description}

请从以下几个方面进行分析：
1. 简历整体评分（1-10分）
2. 简历与岗位的匹配度分析
3. 优势和亮点
4. 需要改进的地方
5. 具体优化建议

请以JSON格式输出分析结果。"""
        else:
            prompt = f"""你是一位专业的简历分析顾问。请分析以下简历。

简历内容：
{resume_text}

请从以下几个方面进行分析：
1. 简历整体评分（1-10分）
2. 简历结构和完整性
3. 优势和亮点
4. 需要改进的地方
5. 具体优化建议

请以JSON格式输出分析结果。"""

        return [
            {"role": "system", "content": "你是一位专业的简历分析顾问，擅长评估简历质量和提供改进建议。"},
            {"role": "user", "content": prompt},
        ]

    def build_interview_prep_prompt(
        self, resume_text: str, job_description: str
    ) -> list[dict[str, str]]:
        """构建面试准备提示词"""
        prompt = f"""你是一位专业的面试教练。基于以下简历和岗位信息，生成可能的面试问题和回答建议。

简历内容：
{resume_text}

岗位描述：
{job_description}

请生成：
1. 10个最可能的面试问题
2. 每个问题的优秀回答示例
3. 回答技巧和注意事项

请以JSON格式输出。"""

        return [
            {"role": "system", "content": "你是一位专业的面试教练，擅长预测面试问题和提供回答策略。"},
            {"role": "user", "content": prompt},
        ]


minimax_client = MiniMaxClient()
