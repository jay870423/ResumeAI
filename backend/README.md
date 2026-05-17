# ResumeAI Backend

FastAPI后端服务 - 简历智能分析与面试准备

## 功能特性

- 📄 **简历分析**: 智能分析简历质量，评估与岗位匹配度
- 🎯 **面试准备**: 基于简历和岗位生成面试问题和回答建议
- 💬 **智能聊天**: 关于简历和职业发展的AI对话

## 技术栈

- FastAPI - 高性能Web框架
- Uvicorn - ASGI服务器
- Pydantic - 数据验证
- httpx - 异步HTTP客户端

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置必要的环境变量
```

### 3. 启动服务

```bash
# 开发模式
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 4. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口

### 健康检查
```
GET /api/v1/health
```

### 简历分析
```
POST /api/v1/resume/analyze
{
    "resume_text": "简历内容...",
    "job_description": "岗位描述（可选）",
    "temperature": 0.7,
    "max_tokens": 2048
}
```

### 面试准备
```
POST /api/v1/resume/interview-prep
{
    "resume_text": "简历内容...",
    "job_description": "岗位描述...",
    "temperature": 0.7,
    "max_tokens": 4096
}
```

### 智能聊天
```
POST /api/v1/resume/chat
{
    "messages": [
        {"role": "user", "content": "问题内容"}
    ],
    "temperature": 0.7,
    "max_tokens": 2048
}
```

## 项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # 应用入口
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── resume.py    # 简历相关接口
│   │       └── health.py    # 健康检查接口
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py        # 配置管理
│   │   └── minimax_client.py # MiniMax API客户端
│   ├── schemas/
│   │   └── resume.py        # Pydantic模型
│   └── services/
├── requirements.txt
├── .env.example
└── README.md
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| MINIMAX_API_URL | MiniMax API地址 | https://api.minimaxi.com/v1/text/chatcompletion_v2 |
| MINIMAX_MODEL | 模型名称 | abab7 |
| DEBUG | 调试模式 | true |
| BACKEND_CORS_ORIGINS | CORS允许的源 | * |

## License

MIT
