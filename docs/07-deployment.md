# 部署说明

## 本地开发部署

推荐方式：

1. Docker 启动 PostgreSQL 和 MinIO。
2. 本机 JDK 17 启动 Spring Boot。
3. Vite 启动前端。

```powershell
cd D:\ai-projects\rag-knowledge-base
.\scripts\start-dev.ps1
```

前端：

```powershell
cd D:\ai-projects\rag-knowledge-base\frontend
npm install
npm run dev
```

## Docker Compose

`docker-compose.yml` 包含：

- `postgres`：`pgvector/pgvector:pg16`
- `minio`：MinIO 对象存储
- `app`：Spring Boot 后端镜像

启动：

```powershell
docker compose up --build
```

仅启动依赖：

```powershell
docker compose up -d postgres minio
```

## 端口

| 服务 | 端口 |
| --- | --- |
| 后端 | 8080 |
| 前端 Vite | 5173 |
| PostgreSQL | 5432 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

## 生产环境变量

生产环境必须显式配置：

```text
SPRING_PROFILES_ACTIVE=prod
JWT_SECRET=replace-with-a-long-random-secret
DB_URL=jdbc:postgresql://host:5432/ragkb
DB_USERNAME=replace-with-db-user
DB_PASSWORD=replace-with-db-password
MINIO_ENDPOINT=https://object-storage.example.com
MINIO_ACCESS_KEY=replace-with-access-key
MINIO_SECRET_KEY=replace-with-secret-key
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_API_KEY=replace-with-model-key
```

## 生产 profile 行为

启用 `prod` 后：

- 默认 JWT Secret 会导致启动失败。
- 默认 MinIO 账号密码会导致启动失败。
- 缺少 `OPENAI_API_KEY` 会导致启动失败。
- Swagger 和 `/actuator/info` 不再匿名开放。

## 前端生产部署建议

当前第一版没有提供前端生产 Docker 镜像。建议后续：

1. `npm run build` 生成 `frontend/dist`。
2. 使用 Nginx 托管静态资源。
3. 将 `/api` 反向代理到后端。
4. 配置 HTTPS 和 gzip/br 压缩。
