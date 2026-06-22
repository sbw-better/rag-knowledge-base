# RAG Knowledge Base MVP

Java + Spring Boot 3 + React 的 RAG 知识库系统第一版，包含认证、知识库管理、文档上传、异步入库、Embedding、pgvector 检索、RAG 问答、引用来源、Swagger、Docker Compose 和前端工作台。

## 环境要求

- JDK 17 或 21
- Maven 3.9+
- Docker / Docker Compose
- Node.js 20+ / npm

当前已验证的 JDK 路径：

```powershell
D:\tools\Java\jdk-17.0.19
```

## 启动后端

开发环境推荐只用 Docker 启动 PostgreSQL/pgvector 和 MinIO，Spring Boot 使用本机 JDK 17 启动：

```powershell
cd D:\ai-projects\rag-knowledge-base
.\scripts\start-dev.ps1
```

停止后端和依赖服务：

```powershell
.\scripts\stop-dev.ps1
```

## 启动前端

```powershell
cd D:\ai-projects\rag-knowledge-base\frontend
npm install
npm run dev
```

也可以使用脚本：

```powershell
cd D:\ai-projects\rag-knowledge-base
.\scripts\start-frontend.ps1
```

## 访问地址

```text
前端工作台: http://localhost:5173
Swagger:    http://localhost:8080/swagger-ui.html
Health:     http://localhost:8080/actuator/health
MinIO:      http://localhost:9001
```

MinIO 默认账号：

```text
minioadmin / minioadmin
```

系统账号需要先注册。第一个注册用户会自动拥有 `ADMIN` 角色。

## 模型配置

系统使用 OpenAI-compatible API。未配置 `OPENAI_API_KEY` 时，Embedding 和 Chat 会使用本地 fallback，便于验证接口链路；配置后会调用真实模型。

```powershell
$env:OPENAI_BASE_URL="https://api.openai.com/v1"
$env:OPENAI_API_KEY="your-key"
$env:OPENAI_CHAT_MODEL="gpt-4o-mini"
$env:OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
$env:OPENAI_EMBEDDING_DIMENSIONS="1536"
```

## 前端说明

前端位于 `frontend/`，使用：

- Vite
- React
- TypeScript
- React Router
- TanStack Query
- Axios
- Tailwind CSS
- lucide-react

开发模式下，Vite 会把 `/api` 代理到 `http://localhost:8080`，因此第一版不需要额外配置后端 CORS。

## 当前限制

- 后端第一版还没有“按知识库列出历史文档”的接口，前端文档页只展示当前浏览器最近上传记录。
- 第一版未实现流式问答、WebSocket 任务推送、复杂权限管理和前端生产 Docker 镜像。

## 完整 Docker 启动

项目保留 `docker-compose.yml` 和 `Dockerfile`。如果 Docker Hub 网络正常，可以尝试：

```powershell
docker compose up --build
```

如果卡在拉取 Maven/JDK 基础镜像，使用上面的 `scripts/start-dev.ps1`。
