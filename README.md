# RAG Knowledge Base MVP

Java + Spring Boot 3 的第一版 RAG 知识库后端，覆盖认证、知识库管理、文档上传、异步解析切分、Embedding、pgvector 检索、LLM 问答、引用来源、Swagger 和 Docker Compose。

## Requirements

- JDK 17+
- Maven 3.9+
- Docker / Docker Compose

当前开发机默认 JDK 是 8，直接 `mvn test` 会因为 Spring Boot 3/Java 17 要求失败。请先切换到 JDK 17 或 21。

## Run

```bash
cd rag-knowledge-base
docker compose up --build
```

Swagger:

```text
http://localhost:8080/swagger-ui.html
```

MinIO Console:

```text
http://localhost:9001
```

默认账号需要先调用 `POST /api/auth/register` 注册。

## Model Configuration

系统使用 OpenAI-compatible API：

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=your-key
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
```

也可配置为兼容 OpenAI 协议的其他模型服务。
