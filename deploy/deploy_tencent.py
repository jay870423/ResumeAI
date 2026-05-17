#!/usr/bin/env python3
"""
腾讯云一键部署脚本
支持：SCF云函数 + API网关 + COS对象存储
"""
import subprocess
import sys
import os
import json
import base64
import zipfile
import io

TENCENT_CLOUD_DEPLOY_SCRIPT = """
# 腾讯云部署配置
# ======================

## 方式一：Docker镜像部署到腾讯云容器服务

1. 构建镜像并推送到腾讯云容器镜像CCR
```bash
# 登录腾讯云容器镜像服务
docker login --username=xxxxx ccr.ccs.tencentyun.com

# 构建镜像
docker build -t resume-ai-backend:latest ./backend

# 标签
docker tag resume-ai-backend:latest ccr.ccs.tencentyun.com/your-namespace/resume-ai-backend:latest

# 推送
docker push ccr.ccs.tencentyun.com/your-namespace/resume-ai-backend:latest
```

2. 在腾讯云容器服务控制台创建部署

---

## 方式二：直接部署到云函数 SCF

1. 安装腾讯云CLI
```bash
pip install tccli
```

2. 配置认证
```bash
tccli configure
```

3. 打包代码
```bash
cd backend
zip -r ../resume-ai-deploy.zip .
```

4. 创建云函数
```bash
tccli scf CreateFunction \\
  --Namespace resume-ai \\
  --FunctionName resume-ai-backend \\
  --Runtime Python3.11 \\
  --Handler app.main.handler \\
  --Timeout 300 \\
  --MemorySize 512 \\
  --Environment '{"Variables": {"PYTHONPATH": "/var/runtime"}}' \\
  --CodeSource 'ZipFile' \\
  --ZipFile <base64编码的zip内容>
```

---

## 方式三：使用 docker-compose 在 CVM 部署

在CVM实例上安装Docker后：
```bash
scp -r ./ResumeAI root@your-cvm-ip:/opt/
ssh root@your-cvm-ip
cd /opt/ResumeAI
docker-compose up -d
```
"""

DOCKERFILE_TENCENT = """\
FROM python:3.11-slim

WORKDIR /app

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \\
    libgl1-mesa-glx \\
    libglib2.0-0 \\
    tesseract-ocr \\
    tesseract-ocr-chi-sim \\
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/uploads

ENV PYTHONPATH=/app
ENV HOST=0.0.0.0
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
"""

def create_tencent_deploy_files():
    """生成腾讯云部署所需文件"""
    project_root = "/mnt/d/ResumeAI"

    # 腾讯云专用Dockerfile
    with open(f"{project_root}/backend/Dockerfile.tencent", "w") as f:
        f.write(DOCKERFILE_TENCENT)

    # 部署说明
    with open(f"{project_root}/deploy/TENCENT_CLOUD.md", "w") as f:
        f.write("# 腾讯云部署指南\n\n")
        f.write(TENCENT_CLOUD_DEPLOY_SCRIPT)

    print("✅ 腾讯云部署文件已生成")
    return True


if __name__ == "__main__":
    create_tencent_deploy_files()
    print("\n部署文件已生成到 /mnt/d/ResumeAI/deploy/ 目录")
