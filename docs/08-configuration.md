# 配置说明

配置文件：`src/main/resources/application.yml`。

## Server

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `SERVER_PORT` | `8080` | 后端端口 |

## 数据库

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:5432/ragkb` | PostgreSQL 地址 |
| `DB_USERNAME` | `rag` | 数据库用户名 |
| `DB_PASSWORD` | `rag` | 数据库密码 |

JPA 使用 `ddl-auto=validate`，表结构由 Flyway 管理。

## 上传限制

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `APP_MAX_FILE_SIZE` | `50MB` | 单文件最大大小 |
| `APP_MAX_REQUEST_SIZE` | `50MB` | 单请求最大大小 |

## JWT

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | `change-me-change-me-change-me-change-me` | JWT 签名密钥 |
| `JWT_EXPIRATION_MINUTES` | `1440` | token 有效分钟数 |

生产环境必须替换默认密钥。

## MinIO

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `MINIO_ENDPOINT` | `http://localhost:9000` | MinIO API 地址 |
| `MINIO_ACCESS_KEY` | `minioadmin` | Access Key |
| `MINIO_SECRET_KEY` | `minioadmin` | Secret Key |
| `MINIO_BUCKET` | `rag-documents` | 文档 bucket |

MinIO 用于保存上传原始文件，数据库只保存 object key 和文档元数据。

## 模型服务

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `OPENAI_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI-compatible API 地址 |
| `OPENAI_API_KEY` | 空 | 模型 API Key |
| `OPENAI_CHAT_MODEL` | `qwen3.7-plus` | Chat 模型 |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-v4` | Embedding 模型 |
| `OPENAI_EMBEDDING_DIMENSIONS` | `1536` | 向量维度 |

注意：数据库 `document_chunks.embedding` 当前为 `vector(1536)`，如果调整向量维度，需要同步迁移数据库表结构和索引。

## 入库任务

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `INGESTION_WORKER_ENABLED` | `true` | 是否启用 Worker |
| `INGESTION_FIXED_DELAY_MS` | `5000` | Worker 轮询间隔 |
| `INGESTION_MAX_ATTEMPTS` | `3` | 最大重试次数 |
| `INGESTION_BATCH_SIZE` | `3` | 每批处理数量 |

## 检索权重

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `RETRIEVAL_VECTOR_WEIGHT` | `0.65` | 混合检索向量权重 |
| `RETRIEVAL_KEYWORD_WEIGHT` | `0.35` | 混合检索关键词权重 |

## 前端配置

文件：`frontend/.env.example`

```text
VITE_API_BASE_URL=/api
```

开发环境通过 Vite proxy 将 `/api` 转发到 `http://localhost:8080`。
