# 部署说明

## 本地开发部署

推荐方式：

1. Docker 启动 MySQL、Milvus 和 MinIO。
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

- `mysql`：MySQL 8.4 业务数据库。
- `minio`：业务对象存储，用于保存上传原始文件。
- `milvus`：Milvus standalone 向量数据库。
- `milvus-etcd`、`milvus-minio`：Milvus standalone 依赖服务。
- `attu`：Milvus 可视化控制台，开发排查用。
- `app`：Spring Boot 后端镜像。

启动全部服务：

```powershell
docker compose up --build
```

仅启动本地开发依赖：

```powershell
docker compose up -d mysql minio milvus
```

启动 Milvus 可视化控制台：

```powershell
docker compose up -d attu
```

## 端口

| 服务 | 端口 |
| --- | --- |
| 后端 | 8080 |
| 前端 Vite | 5173 |
| MySQL | 3306 |
| Milvus REST/gRPC | 19530 |
| Attu Console | 8000 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

## 生产环境变量

生产环境必须显式配置：

```text
SPRING_PROFILES_ACTIVE=prod
JWT_SECRET=replace-with-a-long-random-secret
DB_URL=jdbc:mysql://mysql-host:3306/ragkb?useUnicode=true&characterEncoding=utf8&useSSL=true&serverTimezone=UTC
DB_USERNAME=replace-with-db-user
DB_PASSWORD=replace-with-db-password
MINIO_ENDPOINT=https://object-storage.example.com
MINIO_ACCESS_KEY=replace-with-access-key
MINIO_SECRET_KEY=replace-with-secret-key
MILVUS_ENDPOINT=http://milvus-host:19530
MILVUS_DATABASE=default
MILVUS_COLLECTION=rag_document_chunks
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
