# RAG Knowledge Base

基于 Java 17、Spring Boot 3、PostgreSQL + pgvector、MinIO、React + Vite 的 RAG 知识库系统。当前版本覆盖认证、知识库管理、文档上传、异步入库、文档解析、文本切分、Embedding、向量检索、关键词检索、混合检索、RAG 问答、引用来源、会话记录、Swagger、Docker Compose 和前端工作台。

## 快速启动

环境要求：

- JDK 17 或 21
- Maven 3.9+
- Docker / Docker Compose
- Node.js 20+ / npm

启动后端依赖和 Spring Boot：

```powershell
cd D:\ai-projects\rag-knowledge-base
.\scripts\start-dev.ps1
```

启动前端：

```powershell
cd D:\ai-projects\rag-knowledge-base\frontend
npm install
npm run dev
```

## 访问地址

| 服务 | 地址 |
| --- | --- |
| 前端工作台 | http://localhost:5173 |
| 后端 API | http://localhost:8080 |
| Swagger | http://localhost:8080/swagger-ui.html |
| Health | http://localhost:8080/actuator/health |
| MinIO Console | http://localhost:9001 |

开发环境 MinIO 默认账号为 `minioadmin / minioadmin`。系统账号需要通过注册接口或前端注册页创建，第一个注册用户会自动拥有 `ADMIN` 角色。

## 文档入口

完整项目文档位于 [docs/00-index.md](docs/00-index.md)。

常用文档：

- [需求规格说明](docs/01-requirements.md)
- [总体架构设计](docs/02-architecture.md)
- [模块设计说明](docs/03-module-design.md)
- [接口文档](docs/04-api-spec.md)
- [数据库设计](docs/05-database-design.md)
- [前端设计说明](docs/06-frontend-design.md)
- [部署说明](docs/07-deployment.md)
- [配置说明](docs/08-configuration.md)
- [安全设计](docs/09-security.md)
- [测试方案](docs/10-test-plan.md)
- [运维手册](docs/11-operations.md)
- [生产级演进路线](docs/12-roadmap.md)

## 技术栈

后端：

- Java 17
- Spring Boot 3.5.x
- Spring Web / Security / Data JPA / Validation / Actuator
- Flyway
- PostgreSQL 16 + pgvector
- MinIO
- Apache Tika
- OpenAI-compatible Chat / Embedding API

前端：

- Vite
- React 19
- TypeScript
- React Router
- TanStack Query
- Axios
- Tailwind CSS
- lucide-react

## 当前能力

- 用户注册、登录、JWT 鉴权、当前用户查询。
- 知识库创建、查询、更新、删除。
- 文档上传到 MinIO，并创建 DB 异步任务。
- PDF、DOCX、TXT、Markdown、HTML 文本抽取。
- 文本清洗、切分、Embedding、pgvector 入库。
- 向量检索、关键词检索、混合检索。
- RAG 问答、引用来源、会话和消息入库。
- 前端工作台，支持知识库、文档任务、检索测试、问答和设置。

## 模型配置

系统使用 OpenAI-compatible API。未配置 `OPENAI_API_KEY` 时，当前实现可使用本地 fallback 便于验证链路；配置后会调用真实模型。

示例：

```powershell
$env:OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
$env:OPENAI_API_KEY="replace-with-your-api-key"
$env:OPENAI_CHAT_MODEL="qwen3.7-plus"
$env:OPENAI_EMBEDDING_MODEL="text-embedding-v4"
$env:OPENAI_EMBEDDING_DIMENSIONS="1536"
```

更多配置说明见 [docs/08-configuration.md](docs/08-configuration.md)。

## 常用命令

```powershell
# 后端测试
$env:JAVA_HOME="D:\tools\Java\jdk-17.0.19"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
mvn test

# 前端类型检查和构建
cd frontend
npm run typecheck
npm run build

# Docker 依赖服务
docker compose up -d postgres minio
docker ps
```

## 生产注意事项

启用 `prod` profile 时，系统会校验关键配置：

- `JWT_SECRET` 不能使用默认值，且长度至少 32 位。
- MinIO 账号密码不能使用默认 `minioadmin`。
- `OPENAI_API_KEY` 必须通过环境变量或密钥管理注入。
- 生产环境不会匿名开放 Swagger 和 `/actuator/info`。

生产部署细节见 [docs/07-deployment.md](docs/07-deployment.md) 和 [docs/09-security.md](docs/09-security.md)。
