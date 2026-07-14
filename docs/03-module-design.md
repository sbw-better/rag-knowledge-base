# 模块设计说明

## 认证模块

核心类：`auth` 包。

- `AuthController`：注册、登录、当前用户接口。
- `AuthService`：用户创建、密码校验、角色初始化、JWT 颁发。
- `JwtAuthenticationFilter`：解析 `Authorization: Bearer <token>`。
- `SecurityConfig`：配置 Spring Security 放行规则和认证过滤器。

当前规则：

- `/api/auth/**` 和 `/actuator/health` 匿名可访问。
- 开发环境 Swagger 匿名可访问。
- 其他接口需要 JWT。

## 知识库模块

核心类：`knowledge` 包。

- 支持创建、列表、详情、更新、删除。
- 数据按 `tenant_id` 和知识库所有者隔离。
- `knowledge_base_members` 表用于知识库成员授权。系统允许先创建空知识库并分配成员，后续再上传资料。
- 知识库资源权限分为 `VIEWER`、`EDITOR`、`MANAGER`：`VIEWER` 只问答，`EDITOR` 可维护文档和检索调试，`MANAGER` 可维护成员、配置和索引；owner 和 `ADMIN` 拥有完整管理权限。

## 文档模块

核心类：`document`、`parser`、`storage`、`ingestion` 包。

入库过程：

1. 接收上传文件。
2. 写入 MinIO。
3. 创建 `documents` 记录。
4. 创建 `rag_tasks` 记录。
5. Worker 拉取任务，解析文件文本。
6. 清洗和切分文本。
7. 调用 Embedding。
8. 写入 MySQL `document_chunks`。
9. 将 embedding 写入 Milvus collection。
9. 更新文档和任务状态。

## 检索模块

核心类：`retrieval` 包。

- `SearchService`：统一检索入口。
- `VectorIndexService`：向量写入和向量检索。
- `RetrievalFusionService`：混合检索融合逻辑。
- `SearchCandidate`：检索候选片段。

当前支持：

- `VECTOR`：基于问题 Embedding 和 Milvus 相似度检索。
- `KEYWORD`：基于 MySQL FULLTEXT + LIKE 的简化关键词检索。
- `HYBRID`：融合向量和关键词结果。

## 问答模块

核心类：`chat` 包。

- `ChatService`：执行权限校验、空库判断、检索、Prompt 构建、模型调用、消息保存。
- `PromptBuilder`：将用户问题和召回片段组装为 Prompt。
- `ConversationController`：查询会话详情。

问答保护逻辑：

- 空知识库：如果当前知识库还没有任何 `document_chunks`，返回 `EMPTY_KB` 固定提示，不调用大模型。
- 无命中：如果知识库有资料但本次检索没有命中，返回 `NO_CONTEXT` 固定提示，不调用大模型。
- 正常命中：只有存在检索片段时才构建 Prompt 并调用大模型，返回 `ANSWERED` 和引用来源。

回答结果包括：

- answer
- answerStatus
- conversationId
- userMessageId
- assistantMessageId
- citations

## 模型模块

核心类：`model` 包。

- `EmbeddingClient`：Embedding 抽象。
- `LlmClient`：Chat 抽象。
- `OpenAiCompatibleClient`：OpenAI-compatible 实现。

后续可增加百炼、智谱、火山、Ollama、本地模型等实现，只要适配这两个接口。

## 异常和日志

- `GlobalExceptionHandler` 统一处理业务异常和系统异常。
- 响应统一为 `ApiResponse<T>`。
- 系统异常会记录日志并返回 requestId，便于前后端联动排查。

## DTO 模块

请求和响应 DTO 已按业务模块拆分到各自包内：

- `auth.dto`：注册、登录、认证响应、当前用户。
- `knowledge.dto`：知识库创建/更新请求和详情响应。
- `document.dto`：文档、上传结果、任务、文档列表项。
- `retrieval.dto`：检索请求、模式、命中片段和响应。
- `chat.dto`：问答、会话、消息和引用来源。

这种结构让 DTO 跟随业务模块演进，避免所有接口模型堆在一个聚合类中。

## 前端模块

- 登录注册：`AuthPage`。
- 工作台布局：`WorkspaceLayout`。
- 知识库列表：`KnowledgeBasesPage`。
- 知识库详情：`KnowledgeBasePage`。
- 统一 API：`lib/api.ts`。
- 页面兜底：`ErrorBoundary`。
