#!/bin/bash

# ResumeAI 后端启动脚本

cd "$(dirname "$0")"

# 创建上传目录
mkdir -p uploads

# 复制环境变量文件
if [ ! -f .env ]; then
    cp .env.example .env
    echo "已创建 .env 文件，请编辑填写 MINIMAX_API_KEY"
fi

# 安装依赖
echo "安装Python依赖..."
pip install -r requirements.txt -q

# 启动服务
echo "启动 ResumeAI 后端服务..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
