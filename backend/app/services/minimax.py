import httpx
import json
import re
from typing import Any
from app.core.config import settings


class MiniMaxService:
    """MiniMax API 封装服务"""

    def __init__(self, api_key: str = None, model: str = "MiniMax-M2.7-highspeed"):
        self.api_key = api_key or settings.minimax_api_key
        self.model = model or settings.minimax_model
        self.endpoint = settings.minimax_endpoint or "https://api.minimaxi.com/v1/text/chatcompletion_v2"

    def _extract_json(self, text: str) -> str:
        """从Markdown code block中提取JSON，兼容多种格式"""
        # 方法1：Markdown code block
        match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
        if match:
            candidate = match.group(1).strip()
            if self._is_valid_json(candidate):
                return candidate

        # 方法2：直接解析原文本
        if self._is_valid_json(text):
            return text

        # 方法3：找 JSON 对象（从 { 到最后 }）
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            candidate = text[start:end]
            if self._is_valid_json(candidate):
                return candidate

        # 方法4：找到所有 { ... } 块，返回最大的有效 JSON
        best = ""
        text_lower = text.lower()
        # 先尝试找到 JSON 数组或对象的边界
        for s_idx in range(len(text)):
            if text[s_idx] not in ('{', '['):
                continue
            opener = text[s_idx]
            closer = '}' if opener == '{' else ']'
            depth = 0
            in_string = False
            escape_next = False
            for e_idx in range(s_idx, len(text)):
                c = text[e_idx]
                if escape_next:
                    escape_next = False
                    continue
                if c == '\\':
                    escape_next = True
                    continue
                if c == '"':
                    in_string = not in_string
                    continue
                if in_string:
                    continue
                if c == opener:
                    depth += 1
                elif c == closer:
                    depth -= 1
                    if depth == 0:
                        candidate = text[s_idx:e_idx + 1]
                        if self._is_valid_json(candidate) and len(candidate) > len(best):
                            best = candidate
                        break
        if best:
            return best

        raise ValueError(f"无法从响应中提取JSON: {text[:300]}")

    def _is_valid_json(self, s: str) -> bool:
        """检查字符串是否为有效 JSON"""
        try:
            json.loads(s)
            return True
        except Exception:
            return False

    def chat(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        system_prompt: str = "你是一个专业的AI助手。",
    ) -> str:
        """发送对话请求"""
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        headers = {
            "X-Api-Key": self.api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
        }

        with httpx.Client(timeout=120.0) as client:
            response = client.post(self.endpoint, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            # Anthropic API: content is a list of blocks (text, thinking, etc.)
            content_blocks = result.get("content", [])
            if content_blocks and isinstance(content_blocks, list):
                # Find the text block
                for block in content_blocks:
                    if block.get("type") == "text":
                        return block.get("text", "")
                # If no text block found, try first block with text attr
                return content_blocks[0].get("text", "")
            return ""

    def chat_json(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        system_prompt: str = "你是一个专业的AI助手。",
    ) -> dict[str, Any]:
        """发送对话请求并返回解析后的JSON"""
        response_text = self.chat(prompt, temperature, max_tokens, system_prompt)
        json_str = self._extract_json(response_text)
        return json.loads(json_str)

    # ─── 简历分析 ───────────────────────────────────────────────

    def analyze_resume(self, resume_text: str, target_industry: str = None) -> dict[str, Any]:
        """分析简历：评分 + 优劣势 + 建议"""
        industry_context = f"目标行业：{target_industry}" if target_industry else ""

        prompt = f"""你是一个专业的简历分析师。请分析以下简历，{industry_context}，严格按照以下JSON格式输出，不要有任何其他文字：

{{
  "basic_info": {{
    "name": "姓名（未找到填\"未识别\"）",
    "education": "最高学历",
    "major": "专业（未找到填\"未识别\"）",
    "experience_years": 工作年限（数字）,
    "current_industry": "当前/目标行业"
  }},
  "score": {{
    "completeness": 完整度分数（0-10，保留1位小数）,
    "structure": 结构分数（0-10，保留1位小数）,
    "keywords": 关键词分数（0-10，保留1位小数）
  }},
  "strengths": [
    {{"title": "优势标题", "evidence": "具体证据"}}
  ],
  "weaknesses": [
    {{"title": "劣势/风险", "detail": "具体问题", "risk": "潜在风险"}}
  ],
  "optimization_suggestions": [
    {{"section": "涉及章节", "current": "现状描述", "suggestion": "具体优化建议"}}
  ]
}}

简历内容：
{resume_text}

只输出JSON，不要有其他文字。"""

        return self.chat_json(
            prompt,
            temperature=0.2,
            max_tokens=4096,
            system_prompt="你是一个专业的简历分析师，输出格式必须是严格的JSON。",
        )

    # ─── 职场人格画像 ─────────────────────────────────────────

    def generate_persona(self, resume_text: str, target_industry: str = None) -> dict[str, Any]:
        """生成职场人格画像"""
        industry_context = f"目标行业：{target_industry}" if target_industry else ""

        prompt = f"""你是一个专业的职场人格分析师。请根据简历内容，分析简历主人的职场人格特征。

{industry_context}

分析维度：
1. 用词习惯：统计"主导/负责/参与/协助"等词汇的使用频率
2. 项目描述风格：抽象概括型 vs 具体量化型
3. 职业路径：连贯性、跳槽频率、技能广度
4. 技能结构：技术深度 vs 管理广度

请严格按照以下JSON格式输出，不要有任何其他文字：

{{
  "mbti_type": "MBTI四字母（如INTJ）",
  "type_label": "场景化标签（如策略型）",
  "type_description": "2-3句话的人格描述",
  "dimensions": {{
    "communication_style": {{"label": "沟通风格", "value": "类型", "detail": "1句话说明"}},
    "decision_mode": {{"label": "决策模式", "value": "类型", "detail": "1句话说明"}},
    "collaboration": {{"label": "协作倾向", "value": "类型", "detail": "1句话说明"}},
    "motivation": {{"label": "职业驱动力", "value": "类型", "detail": "1句话说明"}}
  }},
  "strengths": ["优势1", "优势2", "优势3"],
  "weaknesses": ["短板1", "短板2", "短板3"],
  "ideal_environment": "理想工作环境描述",
  "career_suggestions": ["建议1", "建议2", "建议3"],
  "summary": "一句话总结",
  "confidence": 0.0到1.0之间的置信度（保留2位小数）
}}

简历内容：
{resume_text}

只输出JSON，不要有其他文字。"""

        return self.chat_json(
            prompt,
            temperature=0.3,
            max_tokens=4096,
            system_prompt="你是一个专业的职场人格分析师，输出格式必须是严格的JSON。",
        )

    # ─── 关键词联想 ─────────────────────────────────────────────

    def generate_keywords(
        self,
        industry: str,
        major: str,
        interests: list[str],
        skills: list[str],
    ) -> dict[str, Any]:
        """关键词发散联想"""
        prompt = f"""你是一个简历关键词专家。根据以下信息，推荐在简历中补充的关键词：

目标行业：{industry}
学科背景：{major}
兴趣爱好：{", ".join(interests)}
个人特长：{", ".join(skills)}

请严格按照以下JSON格式输出，不要有任何其他文字：

{{
  "recommended_keywords": [
    {{"keyword": "关键词", "category": "技能/工具/方法", "priority": "高/中/低", "reason": "推荐原因"}}
  ],
  "experience_suggestions": [
    {{"direction": "项目方向建议", "keywords": ["相关关键词1", "相关关键词2"]}}
  ]
}}

只输出JSON，不要有其他文字。"""

        return self.chat_json(
            prompt,
            temperature=0.5,
            max_tokens=2048,
            system_prompt="你是一个简历关键词专家，输出格式必须是严格的JSON。",
        )

    # ─── 简历优化 ───────────────────────────────────────────────

    def optimize_resume(
        self,
        resume_text: str,
        target_industry: str = None,
        optimize_type: str = "full",
        target_keywords: list[str] = None,
    ) -> dict[str, Any]:
        """AI优化简历"""
        industry_context = f"目标行业：{target_industry}" if target_industry else ""
        keywords_context = (
            f"要融入的关键词：{', '.join(target_keywords)}" if target_keywords else ""
        )

        prompt = f"""你是一个专业的简历优化师。请优化以下简历，{industry_context}，{keywords_context}，严格按照以下JSON格式输出：

{{
  "optimized_text": "优化后的完整简历文本（保持原有结构，只优化表述）",
  "changes": [
    {{"before": "原文", "after": "改后", "reason": "改动原因"}}
  ],
  "summary": "整体优化要点总结"
}}

简历内容：
{resume_text}

只输出JSON，不要有其他文字。"""

        return self.chat_json(
            prompt,
            temperature=0.4,
            max_tokens=8192,
            system_prompt="你是一个专业的简历优化师，输出格式必须是严格的JSON。",
        )
