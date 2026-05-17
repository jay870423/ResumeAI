import os
import uuid
import json
import fitz
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.parser import ParserFactory
from app.core.ocr import OCRFactory
from app.services.minimax import MiniMaxService
from app.db import database
from app.models.common import (
    ApiResponse,
    ResumeUploadResponse,
    ResumeParseResponse,
    AnalyzeResponse,
    BasicInfo,
    Score,
    Strength,
    Weakness,
    Suggestion,
    PersonaResponse,
    PersonaDimension,
    PersonaDimensions,
    KeywordsResponse,
    OptimizeResponse,
    ResumeStatusResponse,
)

router = APIRouter(prefix="/resume", tags=["简历"])

# 全局服务实例
_minimax_service: MiniMaxService = None
_parser_factory: ParserFactory = None
_ocr_factory: OCRFactory = None


def get_minimax() -> MiniMaxService:
    global _minimax_service
    if _minimax_service is None:
        _minimax_service = MiniMaxService(
            api_key=settings.minimax_api_key,
            model=settings.minimax_model,
        )
    return _minimax_service


def get_parser() -> ParserFactory:
    global _parser_factory
    if _parser_factory is None:
        _parser_factory = ParserFactory()
    return _parser_factory


def get_ocr() -> OCRFactory:
    global _ocr_factory
    if _ocr_factory is None:
        _ocr_factory = OCRFactory()
    return _ocr_factory


# ─── 辅助函数 ───────────────────────────────────────────────


def _get_page_count(file_path: str) -> int:
    """获取PDF页数"""
    try:
        doc = fitz.open(file_path)
        count = len(doc)
        doc.close()
        return count
    except Exception:
        return 1


def _generate_resume_id() -> str:
    """生成简历ID"""
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    uid = uuid.uuid4().hex[:8]
    return f"rs_{ts}_{uid}"


def _error_response(code: int, message: str):
    return ApiResponse(code=code, message=message, data=None)


# ─── API 接口 ───────────────────────────────────────────────


@router.post("/upload", response_model=ApiResponse)
async def upload_resume(file: UploadFile = File(...)):
    """上传并解析简历"""
    try:
        os.makedirs(settings.upload_dir, exist_ok=True)
        ext = os.path.splitext(file.filename)[1].lower() or ".docx"
        resume_id = f"rs_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
        file_path = os.path.join(settings.upload_dir, f"{resume_id}{ext}")
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        # 保存到数据库
        file_type = ext.lstrip(".")
        page_count = 1  # 非PDF默认1页
        await database.save_resume(
            resume_id=resume_id,
            file_name=file.filename or "resume",
            file_type=file_type,
            file_path=file_path,
            file_size=len(content),
            page_count=page_count,
        )

        return ApiResponse(
            code=0,
            message="上传成功",
            data={"resume_id": resume_id, "filename": file.filename},
        )
    except Exception as e:
        return _error_response(1001, f"上传失败: {str(e)}")


# 前端兼容路由：/resume/{resume_id}/parse（路径参数，与前端对齐）
@router.post("/{resume_id}/parse", response_model=ApiResponse)
async def parse_resume_by_path(resume_id: str):
    return await parse_resume(resume_id)


@router.post("/parse", response_model=ApiResponse)
async def parse_resume(resume_id: str):
    """解析简历，提取文本"""
    resume = await database.get_resume(resume_id)
    if not resume:
        return _error_response(2001, "简历不存在")

    try:
        file_path = resume["file_path"]
        ext = os.path.splitext(file_path)[1].lower()

        if ext in {".png", ".jpg", ".jpeg"}:
            # 图片走OCR
            ocr = get_ocr()
            raw_text = ocr.extract_text(file_path)
        else:
            # 文档走解析器
            parser = get_parser()
            raw_text = parser.extract_text(file_path)

        if not raw_text or len(raw_text.strip()) < 10:
            return _error_response(2002, "简历内容过少或无法解析")

        word_count = len(raw_text)
        page_count = resume["page_count"] or 1

        # 更新数据库
        await database.update_resume_text(resume_id, raw_text)

        return ApiResponse(
            code=0,
            message="success",
            data=ResumeParseResponse(
                resume_id=resume_id,
                raw_text=raw_text,
                word_count=word_count,
                page_count=page_count,
            ).model_dump(),
        )
    except Exception as e:
        return _error_response(2002, f"简历解析失败: {str(e)}")


@router.post("/analyze", response_model=ApiResponse)
async def analyze_resume(request: Request):
    """AI分析简历"""
    body = await request.json()
    rid = body.get("resume_id") or request.query_params.get("resume_id")
    industry = body.get("target_industry") or request.query_params.get("target_industry")

    resume = await database.get_resume(rid)
    if not resume:
        return _error_response(2001, "简历不存在")

    if not resume.get("raw_text"):
        return _error_response(2002, "简历未解析，请先调用parse接口")

    try:
        minimax = get_minimax()
        result = minimax.analyze_resume(resume["raw_text"], industry)

        # 保存分析结果
        await database.update_resume_analysis(
            rid,
            json.dumps(result, ensure_ascii=False),
            "",  # persona后续单独更新
        )

        # 构造响应
        basic = result.get("basic_info", {})
        score = result.get("score", {})
        analyzed_at = datetime.now()

        return ApiResponse(
            code=0,
            message="success",
            data={
                "resume_id": rid,
                "basic_info": basic,
                "score": score,
                "strengths": result.get("strengths", []),
                "weaknesses": result.get("weaknesses", []),
                "optimization_suggestions": result.get("optimization_suggestions", []),
                "analyzed_at": analyzed_at.isoformat(),
            },
        )
    except Exception as e:
        return _error_response(2004, f"MiniMax API错误: {str(e)}")


@router.post("/persona", response_model=ApiResponse)
async def generate_persona(resume_id: str, target_industry: str = None):
    """生成职场人格画像"""
    resume = await database.get_resume(resume_id)
    if not resume:
        return _error_response(2001, "简历不存在")

    if not resume.get("raw_text"):
        return _error_response(2002, "简历未解析，请先调用parse接口")

    try:
        minimax = get_minimax()
        result = minimax.generate_persona(resume["raw_text"], target_industry)

        # 更新persona到数据库（使用update_resume_analysis，保留现有analysis数据）
        existing = await database.get_resume(resume_id)
        current_persona = json.loads(existing.get("persona_json") or "{}")
        current_persona.update(result)
        current_analysis = existing.get("analysis_json") or "{}"
        await database.update_resume_analysis(
            resume_id,
            current_analysis,
            json.dumps(current_persona, ensure_ascii=False),
        )

        dims = result.get("dimensions", {})
        generated_at = datetime.now()

        return ApiResponse(
            code=0,
            message="success",
            data={
                "resume_id": resume_id,
                "mbti_type": result.get("mbti_type", ""),
                "type_label": result.get("type_label", ""),
                "type_description": result.get("type_description", ""),
                "dimensions": {
                    "communication_style": dims.get("communication_style", {}),
                    "decision_mode": dims.get("decision_mode", {}),
                    "collaboration": dims.get("collaboration", {}),
                    "motivation": dims.get("motivation", {}),
                },
                "strengths": result.get("strengths", []),
                "weaknesses": result.get("weaknesses", []),
                "ideal_environment": result.get("ideal_environment", ""),
                "career_suggestions": result.get("career_suggestions", []),
                "summary": result.get("summary", ""),
                "confidence": result.get("confidence", 0.0),
                "generated_at": generated_at.isoformat(),
            },
        )
    except Exception as e:
        return _error_response(2004, f"MiniMax API错误: {str(e)}")


@router.get("/list", response_model=ApiResponse)
async def list_resumes_handler(page: int = 1, page_size: int = 20):
    """简历列表（分页）"""
    items, total = await database.list_resumes(page, page_size)
    return ApiResponse(
        code=0,
        message="success",
        data={
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        },
    )


@router.get("/{resume_id}", response_model=ApiResponse)
async def get_resume_status(resume_id: str):
    """获取简历状态"""
    resume = await database.get_resume(resume_id)
    if not resume:
        return _error_response(2001, "简历不存在")

    return ApiResponse(
        code=0,
        message="success",
        data=ResumeStatusResponse(
            resume_id=resume_id,
            file_name=resume["file_name"],
            status=resume["status"],
            has_optimized=bool(resume.get("optimized_text")),
            created_at=datetime.fromisoformat(resume["created_at"]),
            analyzed_at=datetime.fromisoformat(resume["analyzed_at"]) if resume.get("analyzed_at") else None,
        ).model_dump(),
    )
