from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from app.models.common import ApiResponse
from app.services.auth import create_token, verify_token
import uuid

router = APIRouter(prefix="/auth", tags=["登录认证"])

# 模拟用户库（正式环境替换为数据库）
DEMO_USERS = {
    "admin": {"password": "resume2025", "name": "管理员"},
    "user": {"password": "user2025", "name": "普通用户"},
}


class RegisterRequest(BaseModel):
    username: str
    password: str
    name: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str
    name: str


@router.post("/register", response_model=ApiResponse)
async def register(req: RegisterRequest):
    """
    用户注册
    - username: 用户名（唯一）
    - password: 密码（sha256 加密存储）
    - name: 昵称（可选）
    """
    import hashlib
    import sqlite3

    db_path = "/home/ubuntu/ResumeAI/backend/app/db/resume.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 检查用户是否已存在
    cur.execute("SELECT user_id FROM users WHERE username = ?", (req.username,))
    if cur.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="用户名已存在")

    # 加密密码
    password_hash = hashlib.sha256(req.password.encode()).hexdigest()
    user_id = f"u_{uuid.uuid4().hex[:12]}"

    cur.execute(
        "INSERT INTO users (user_id, username, password_hash, name) VALUES (?, ?, ?, ?)",
        (user_id, req.username, password_hash, req.name or req.username)
    )
    conn.commit()
    conn.close()

    token = create_token(user_id=user_id, username=req.username)
    return ApiResponse(
        code=0,
        message="注册成功",
        data={"token": token, "username": req.username, "name": req.name or req.username},
    )


@router.post("/login", response_model=ApiResponse)
async def login(req: LoginRequest):
    """
    用户登录
    - 验证用户名密码
    - 返回 JWT token（有效期 7 天）
    """
    user = DEMO_USERS.get(req.username)
    if not user or user["password"] != req.password:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_token(user_id=str(uuid.uuid4()), username=req.username)
    return ApiResponse(
        code=200,
        message="登录成功",
        data={"token": token, "username": req.username, "name": user["name"]},
    )


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """依赖注入：验证 token 并返回当前用户"""
    if not authorization:
        raise HTTPException(status_code=401, detail="未登录，请先登录")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token 格式错误")

    token = authorization[7:]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token 已过期，请重新登录")

    return payload
