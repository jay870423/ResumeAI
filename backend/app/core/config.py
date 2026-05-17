from pydantic_settings import BaseSettings
from typing import Optional
import os


def _get_env(key: str, default: str = "") -> str:
    """读取环境变量，优先从 .env 文件中读取"""
    # 先尝试 os.environ（已被 pydantic 加载）
    return os.environ.get(key, default)


class Settings(BaseSettings):
    # MiniMax API
    minimax_api_key: str = ""
    minimax_model: str = "MiniMax-M2.7-highspeed"
    minimax_endpoint: str = "https://api.minimaxi.com/anthropic/v1/messages"

    # OCR配置
    aliyun_ocr_api_key: str = ""
    aliyun_ocr_api_secret: str = ""

    # 文件存储
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 10

    # 服务器
    host: str = "0.0.0.0"
    port: int = 8877

    # JWT 认证
    jwt_secret: str = "resume-ai-super-secret-key-change-in-production"

    # CORS
    backend_cors_origins: str = "http://localhost:5173,http://localhost:3000,http://81.70.144.73:5173"

    # 项目名
    project_name: str = "ResumeAI"
    api_v1_prefix: str = "/api/v1"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# 手动从 .env 文件读取 API key（解决 pydantic case_insensitive 读取失败问题）
_env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
if os.path.exists(_env_file):
    with open(_env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                if "=" in line:
                    k, v = line.split("=", 1)
                    if k == "MINIMAX_API_KEY" and v:
                        settings.minimax_api_key = v
                    elif k == "MINIMAX_MODEL" and v:
                        settings.minimax_model = v
                    elif k == "MINIMAX_ENDPOINT" and v:
                        settings.minimax_endpoint = v

# 确保上传目录存在
os.makedirs(settings.upload_dir, exist_ok=True)
