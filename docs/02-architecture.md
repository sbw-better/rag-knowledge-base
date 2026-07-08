# 总体架构设计

## 架构概览

系统由前端工作台、Spring Boot 后端、MySQL、Milvus、MinIO、OpenAI-compatible 模型服务组成。MySQL 是业务事实库，保存用户、知识库、文档、任务、切片文本、会话和引用；Milvus 是可重建的向量索引库，保存切片向量并提供语义相似性检索。

```mermaid
flowchart LR
  U["用户"] --> FE["React 前端工作台"]
  FE --> API["Spring Boot API"]
  API --> DB["MySQL 8.4"]
  API --> Milvus["Milvus 2.6.x"]
  API --> IO["MinIO 对象存储"]
  API --> LLM["OpenAI-compatible 模型服务"]
  API --> W["DB Scheduler 入库 Worker"]
  W --> IO
  W --> DB
  W --> Milvus
  W --> LLM
```

## RAG 主流程

```mermaid
sequenceDiagram
  participant User as 用户
  participant FE as 前端
  participant API as 后端 API
  participant MinIO as MinIO
  participant DB as MySQL
  participant VDB as Milvus
  participant Worker as 入库 Worker
  participant Model as 模型服务

  User->>FE: 上传文档
  FE->>API: POST /knowledge-bases/{id}/documents
  API->>MinIO: 保存原始文件
  API->>DB: 创建 document 和 rag_task
  API-->>FE: 返回文档和任务
  Worker->>DB: 拉取 PENDING 任务
  Worker->>MinIO: 读取原始文件
  Worker->>Worker: 解析、清洗、切分
  Worker->>Model: Embedding
  Worker->>DB: 写入 chunks 文本和元数据
  Worker->>VDB: 写入 chunk dense vector
  User->>FE: 发起问答
  FE->>API: POST /chat
  API->>Model: 问题 Embedding
  API->>VDB: 向量检索
  API->>DB: 关键词检索和业务数据查询
  API->>Model: 构建 Prompt 并调用 Chat
  API->>DB: 保存会话、消息、引用
  API-->>FE: 返回答案和引用
```

## 后端分层

- Controller：接收 HTTP 请求，做参数校验，返回统一响应。
- Service：承载业务逻辑，如认证、知识库、文档、检索、问答。
- Mapper：MyBatis-Plus 数据访问。
- Domain：实体和枚举。
- Infrastructure：MinIO、模型客户端、OpenAPI、生产安全检查。
- Worker：基于 DB 任务表的异步入库调度。

## 前端架构

- `App.tsx`：路由和登录保护。
- `pages/`：登录、工作台、知识库列表、知识库详情。
- `lib/api.ts`：Axios 实例、token 注入、统一错误处理。
- `components/ui.tsx`：基础 UI 组件。
- TanStack Query：服务端状态、缓存、轮询、重试。

## 部署结构

开发环境推荐：

- Docker Compose 启动 MySQL、Milvus 和 MinIO。
- 本机 JDK 17 启动 Spring Boot。
- Vite 启动前端，代理 `/api` 到后端。

生产环境建议：

- 后端、前端、数据库、对象存储分离部署。
- 使用外部密钥管理注入敏感环境变量。
- 后续可将关键词检索扩展到 OpenSearch，向量索引继续以 Milvus 为主。
