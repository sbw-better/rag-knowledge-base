# 配置说明

配置文件：`src/main/resources/application.yml`。

## Server

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `SERVER_PORT` | `8080` | 后端端口 |

## 数据库

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `DB_URL` | `jdbc:mysql://localhost:3306/ragkb?...` | MySQL 地址 |
| `DB_USERNAME` | `rag` | 数据库用户名 |
| `DB_PASSWORD` | `rag` | 数据库密码 |

表结构由 Flyway 管理，数据访问由 MyBatis-Plus Mapper 完成。

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

## Milvus

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `MILVUS_ENDPOINT` | `http://localhost:19530` | Milvus REST/gRPC 地址 |
| `MILVUS_DATABASE` | `default` | Milvus database |
| `MILVUS_COLLECTION` | `rag_document_chunks` | 文档切片向量 collection |
| `MILVUS_ENABLED` | `true` | 是否启用 Milvus 写入和检索 |

启动时后端会检查并创建 collection。`OPENAI_EMBEDDING_DIMENSIONS` 必须和 collection 向量维度一致；如果维度变化，需要重建 collection。

## 模型服务

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `OPENAI_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI-compatible API 地址 |
| `OPENAI_API_KEY` | 空 | 模型 API Key |
| `OPENAI_CHAT_MODEL` | `qwen3.7-plus` | Chat 模型 |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-v4` | Embedding 模型 |
| `OPENAI_EMBEDDING_DIMENSIONS` | `1536` | 向量维度 |

仓库中不保存真实 API Key。开发环境未配置 key 时，模型调用会走本地 fallback；生产环境必须配置真实 key。

## 入库任务

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `INGESTION_WORKER_ENABLED` | `true` | 是否启用 Worker |
| `INGESTION_FIXED_DELAY_MS` | `5000` | Worker 轮询间隔 |
| `INGESTION_MAX_ATTEMPTS` | `3` | 最大重试次数 |
| `INGESTION_BATCH_SIZE` | `3` | 每批处理数量 |
| `INGESTION_RUNNING_TIMEOUT_MS` | `600000` | RUNNING 任务超时恢复阈值，默认 10 分钟 |

Worker 每次轮询会先检查长时间停留在 `RUNNING` 的任务。未达到最大尝试次数时自动重新置为 `PENDING`，达到上限时标记为 `FAILED`，避免服务重启或模型调用中断后任务永久卡住。

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
