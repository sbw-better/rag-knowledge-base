# RAG Knowledge Base

基于 Java 17、Spring Boot 3、MySQL + MyBatis-Plus、Milvus、MinIO、React + Vite 的 RAG 知识库系统。当前版本覆盖认证、知识库管理、文档上传、异步入库、文档解析、文本切分、Embedding、向量检索、关键词检索、混合检索、RAG 问答、引用来源、会话记录、Swagger、Docker Compose 和前端工作台。

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
| MySQL | localhost:3306 |
| Milvus | http://localhost:19530 |
| Attu Milvus Console | http://localhost:8000 |

开发环境 MinIO 默认账号为 `minioadmin / minioadmin`。系统账号需要通过注册接口或前端注册页创建，第一个注册用户会自动拥有 `ADMIN` 角色。
当前系统角色分为 `ADMIN`、`KB_MANAGER`、`USER`：`ADMIN` 负责平台、用户和租户管理，`KB_MANAGER` 可创建知识库并成为自己创建知识库的负责人，`USER` 默认只能访问被授权的知识库。

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
- [当前状态与交接记录](docs/14-current-status-handoff.md)

## 技术栈

后端：

- Java 17
- Spring Boot 3.5.x
- Spring Web / Security / Validation / Actuator
- Flyway
- MySQL 8.4
- MyBatis-Plus
- Milvus 2.6.x
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
- `ADMIN` 可管理用户角色和租户；`ADMIN` 和 `KB_MANAGER` 可创建知识库，创建者自动成为知识库负责人。
- 租户列表和租户创建；当前注册仍默认进入 `Default` 租户，指定租户邀请/注册属于后续升级。
- 知识库查询、更新、删除和成员授权；资源权限细分为 `VIEWER`、`EDITOR`、`MANAGER`。
- 文档上传到 MinIO，并创建 DB 异步任务。
- PDF、DOCX、TXT、Markdown、HTML 文本抽取。
- 文本清洗、切分、Embedding、MySQL 切片入库和 Milvus 向量入库。
- Milvus 向量检索、MySQL 关键词检索、RRF 混合检索。
- RAG 问答、引用来源、会话和消息入库。
- 前端工作台，支持知识库、文档任务、检索测试、问答、成员、配置和运维分区。
- `VIEWER` 只使用问答；`EDITOR` 可维护文档和检索调试；`MANAGER` 可维护成员、配置和索引。
- 知识库 owner 或 `ADMIN` 仍保留删除知识库等最高风险操作权限。

## 模型配置

系统使用 OpenAI-compatible API。未配置 `OPENAI_API_KEY` 时，当前实现可使用本地 fallback 便于验证链路；配置后会调用真实模型。

推荐本地开发使用 `.env.local` 保存真实 Key。该文件已被 `.gitignore` 忽略，不会提交到 Git。

```powershell
cd D:\ai-projects\rag-knowledge-base
Copy-Item .env.local.example .env.local
notepad .env.local
.\scripts\start-dev.ps1
```

在 `.env.local` 中填写：

```env
OPENAI_API_KEY=replace-with-your-api-key
```

不要把真实 Key 写入 `application.yml`、`.env.example`、README 或任何会提交到 Git 的文件。

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
cd ..

# 端到端冒烟测试，默认清理本轮创建的测试知识库
powershell -ExecutionPolicy Bypass -File .\scripts\e2e-smoke.ps1 -AdminEmail your-admin@example.com

# 可选：清理历史 codex-e2e-* 测试账号和关联 MySQL 数据
.\scripts\cleanup-e2e-data.ps1 -Force

# Docker 依赖服务
docker compose up -d mysql minio milvus
docker ps

# 可选：启动 Milvus 可视化控制台
docker compose up -d attu

# 清空本地开发业务数据，重新注册第一个 ADMIN
.\scripts\reset-dev-data.ps1 -Force
```

## 生产注意事项

启用 `prod` profile 时，系统会校验关键配置：

- `JWT_SECRET` 不能使用默认值，且长度至少 32 位。
- MinIO 账号密码不能使用默认 `minioadmin`。
- `OPENAI_API_KEY` 必须通过环境变量或密钥管理注入。
- `INGESTION_RUNNING_TIMEOUT_MS` 控制文档入库任务卡在 `RUNNING` 后的自动恢复时间，默认 10 分钟。
- 生产环境不会匿名开放 Swagger 和 `/actuator/info`。

生产部署细节见 [docs/07-deployment.md](docs/07-deployment.md) 和 [docs/09-security.md](docs/09-security.md)。
