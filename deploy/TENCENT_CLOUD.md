# 腾讯云部署指南

## 方式一：CVM + Docker 部署（推荐，最简单）

### 1. 上传代码到 CVM
```bash
scp -r ./ResumeAI root@你的CVM公网IP:/opt/
```

### 2. SSH 登录并启动
```bash
ssh root@你的CVM公网IP
cd /opt/ResumeAI

# 复制并编辑环境变量
cp backend/.env.example backend/.env
vi backend/.env  # 填入 MINIMAX_API_KEY

# 启动服务（Docker方式）
docker-compose up -d --build
```

服务地址：`http://CVM公网IP:8000`

---

## 方式二：Docker镜像推送到腾讯云容器CCR

### 1. 构建镜像
```bash
cd ResumeAI
docker build -f backend/Dockerfile.tencent -t resume-ai:latest ./backend
```

### 2. 推送到腾讯云容器镜像
```bash
# 登录CCR
docker login --username=你的账号ID ccr.ccs.tencentyun.com

# 打标签
docker tag resume-ai:latest ccr.ccs.tencentyun.com/你的命名空间/resume-ai:latest

# 推送
docker push ccr.ccs.tencentyun.com/你的命名空间/resume-ai:latest
```

### 3. 在腾讯云容器服务控制台部署
- 创建部署
- 镜像选择刚才推送的镜像
- 端口映射：8000 → 8000
- 环境变量：填入 `MINIMAX_API_KEY`

---

## 方式三：云函数 SCF 部署

### 1. 打包代码
```bash
cd ResumeAI/backend
zip -r ../deploy/scf.zip .
```

### 2. 安装腾讯云CLI
```bash
pip install tccli
tccli configure
```

### 3. 创建云函数
```bash
tccli scf CreateFunction \
  --Namespace resume-ai \
  --FunctionName resume-ai-backend \
  --Runtime Python3.11 \
  --Handler app.main.handler \
  --Timeout 300 \
  --MemorySize 512 \
  --CodeSource ZipFile \
  --ZipFile <base64编码的zip内容>
```

### 4. 配置API网关触发器
```bash
tccli apigateway CreateApi \
  --ServiceId your-service-id \
  --ApiName resume-ai \
  --Method POST \
  --Path /api/v1/resume/upload \
  --BackendType PUBLIC
```

---

## 前端部署：静态网站托管

前端构建产物在 `frontend/dist/`，可部署到：

### 方案A：腾讯云 COS 静态网站托管
```bash
# 上传dist到COS bucket
coscli sync ./frontend/dist/ cos://your-bucket-1300000000/ --doc-format markdown

# 配置静态网站访问
# 在COS控制台 → 基础配置 → 静态网站 → 开启
```

### 方案B：腾讯云 ECDN/CDN
- 将 `VITE_API_BASE_URL` 改为你的 API 网关地址
- 重新 `npm run build`
- 上传到 COS

---

## 环境变量配置

在所有部署方式中，需要配置以下环境变量：

| 变量 | 必填 | 说明 |
|------|------|------|
| `MINIMAX_API_KEY` | ✅ | MiniMax API密钥 |
| `MINIMAX_MODEL` | ❌ | 默认为 abab7 |
| `ALIYUN_OCR_API_KEY` | ❌ | 阿里云OCR密钥（可选） |
| `UPLOAD_DIR` | ❌ | 文件存储路径 |
| `MAX_FILE_SIZE_MB` | ❌ | 最大文件MB，默认10 |
| `BACKEND_CORS_ORIGINS` | ❌ | 允许的跨域前端地址 |
