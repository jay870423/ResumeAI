from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.v1 import api_router
from app.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时初始化数据库
    await init_db()
    yield
    # 关闭时清理


app = FastAPI(
    title="ResumeAI - 简历智能分析服务",
    description="""
## 功能

- **简历上传**: 支持 PDF、Word、图片
- **简历解析**: 自动提取文本内容
- **AI分析**: 评分、优势、劣势、优化建议
- **职场人格画像**: MBTI类型 + 沟通/决策/协作/驱动力分析
- **关键词联想**: 根据行业/学科/兴趣/特长推荐关键词
- **AI优化**: 自动改写、量化表达
- **导出**: PDF / Word

## 接口文档

访问 `/docs` 查看交互式 API 文档
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root():
    return {
        "name": "ResumeAI",
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
