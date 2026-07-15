# 接口文档

## 通用约定

Base URL：

```text
http://localhost:8080/api
```

认证方式：

```http
Authorization: Bearer <jwt-token>
```

统一响应：

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

失败响应：

```json
{
  "success": false,
  "data": null,
  "error": "错误说明"
}
```

## 认证

### POST /api/auth/register

注册用户。第一个注册用户会成为 `ADMIN`。

请求：

```json
{
  "email": "user@example.com",
  "password": "password",
  "displayName": "张三"
}
```

响应：

```json
{
  "token": "jwt-token",
  "user": {
    "id": "1900000000000000000",
    "email": "user@example.com",
    "displayName": "张三",
    "roles": ["ADMIN"]
  }
}
```

### POST /api/auth/login

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

### GET /api/auth/me

返回当前登录用户。

## 管理用户

### GET /api/admin/users

返回当前租户下用户列表，仅 `ADMIN` 可访问。用于平台用户角色配置。

响应数据项：

```json
{
  "id": "1900000000000000000",
  "email": "user@example.com",
  "displayName": "张三",
  "enabled": true,
  "roles": ["USER"],
  "createdAt": "2026-07-13T08:00:00Z"
}
```

### PATCH /api/admin/users/{id}/roles

更新用户系统角色，仅 `ADMIN` 可访问。`USER` 是基础角色，后端会自动保留；不要把知识库负责人 owner 当成系统角色分配，owner 会在创建知识库时自动产生。

请求：

```json
{
  "roles": ["USER", "KB_MANAGER"]
}
```

说明：

- `ADMIN`：平台管理员，可管理用户和租户内知识库。
- `KB_MANAGER`：知识库管理员，可创建知识库，并管理自己创建的知识库。
- `USER`：基础用户，只能访问被授权的知识库。
- 当前登录管理员不能移除自己的 `ADMIN` 角色。

## 管理租户

### GET /api/admin/tenants

返回平台租户列表，仅 `ADMIN` 可访问。当前响应包含租户基础信息、用户数量和知识库数量。

响应数据项：

```json
{
  "id": "1900000000000000000",
  "name": "Default",
  "userCount": 3,
  "knowledgeBaseCount": 2,
  "createdAt": "2026-07-15T02:00:00Z"
}
```

### POST /api/admin/tenants

创建租户，仅 `ADMIN` 可访问。

```json
{
  "name": "华东业务部"
}
```

说明：

- 当前版本只开放租户创建和查看。
- 注册用户仍默认进入 `Default` 租户。
- 用户邀请到指定租户、跨租户迁移、租户级模型配置属于后续升级。

## 知识库

### POST /api/knowledge-bases

创建知识库，仅 `ADMIN` 或 `KB_MANAGER` 可调用。创建成功后，创建者会成为该知识库的 owner，后续可上传文档、维护设置、授权成员。

```json
{
  "name": "客服知识库",
  "description": "解答客户常见问题",
  "chunkSize": 800,
  "chunkOverlap": 120,
  "topK": 5
}
```

### GET /api/knowledge-bases

返回当前用户可访问的知识库列表。

知识库响应中的 `manageable` 表示当前用户是否拥有任意维护能力。更细粒度的页面入口应优先使用能力字段：

- `permission`：当前用户对该知识库的有效权限，可能为 `ADMIN`、`OWNER`、`MANAGER`、`EDITOR`、`VIEWER`。
- `canManageDocuments`：可上传文档、查看文档任务、使用检索调试。
- `canManageMembers`：可授权或移除成员。
- `canManageConfig`：可修改名称、描述、切片参数和默认 TopK。
- `canManageOperations`：可重建 Milvus 索引。
- `canDelete`：可删除知识库，仅 owner 或 `ADMIN` 为 true。

### GET /api/knowledge-bases/{id}

返回知识库详情。

### GET /api/knowledge-bases/{id}/documents

返回当前知识库下的文档和每个文档最近一次入库任务。

仅 `EDITOR`、`MANAGER`、owner 或 `ADMIN` 可访问，普通 `VIEWER` 不需要查看入库任务。

响应数据项：

```json
{
  "document": {
    "id": "1900000000000000001",
    "knowledgeBaseId": "1900000000000000000",
    "fileName": "example.docx",
    "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "sizeBytes": 1024,
    "status": "INDEXED",
    "errorMessage": null,
    "createdAt": "2026-06-23T10:00:00Z"
  },
  "task": {
    "id": "1900000000000000002",
    "documentId": "1900000000000000001",
    "type": "INGEST_DOCUMENT",
    "status": "SUCCEEDED",
    "attempts": 1,
    "errorMessage": null,
    "createdAt": "2026-06-23T10:00:00Z",
    "finishedAt": "2026-06-23T10:01:00Z"
  }
}
```

### PATCH /api/knowledge-bases/{id}

更新名称、描述、切片参数和默认 TopK，仅知识库 owner 或 `ADMIN` 可调用。

### DELETE /api/knowledge-bases/{id}

软删除知识库，仅知识库 owner 或 `ADMIN` 可调用。

### GET /api/knowledge-bases/{id}/members

查询知识库授权成员，仅 `MANAGER`、owner 或 `ADMIN` 可访问。

### GET /api/knowledge-bases/{id}/member-candidates

查询当前知识库可授权的租户用户，仅 `MANAGER`、owner 或 `ADMIN` 可访问。前端成员授权页面使用该接口加载候选用户；它不会授予平台级角色。

返回规则：

- 排除当前知识库 owner，因为 owner 已拥有完整管理权限。
- 排除 `ADMIN` 用户，因为平台管理员天然可访问租户内知识库，不需要知识库成员授权。

### POST /api/knowledge-bases/{id}/members

添加或更新知识库成员授权。

不能把当前知识库 owner 或 `ADMIN` 用户添加为知识库成员。

请求：

```json
{
  "userId": "1900000000000000007",
  "permission": "VIEWER"
}
```

`permission` 当前支持：

- `VIEWER`：普通问答用户。
- `EDITOR`：可维护文档和使用检索调试。
- `MANAGER`：拥有 `EDITOR` 能力，并可维护成员、配置和重建索引。

### DELETE /api/knowledge-bases/{id}/members/{userId}

移除知识库成员授权。

### POST /api/knowledge-bases/{id}/rebuild-index

从 MySQL `document_chunks` 重新生成 Embedding，并重写当前知识库在 Milvus 中的向量索引。

权限：

- 仅 `MANAGER`、owner 或 `ADMIN` 可调用。
- 普通用户不应在前端看到该入口。

响应：

```json
{
  "knowledgeBaseId": "1900000000000000000",
  "chunkCount": 12,
  "rebuiltCount": 12
}
```

## 文档

### POST /api/knowledge-bases/{id}/documents

上传文档，`multipart/form-data` 字段名固定为 `file`。

支持类型：

- PDF
- DOCX
- TXT
- Markdown
- HTML

### GET /api/documents/{id}

查询文档详情。

### GET /api/tasks/{id}

查询异步任务状态。

任务状态包括：

- `PENDING`
- `RUNNING`
- `SUCCEEDED`
- `FAILED`

## 检索

### POST /api/search

请求：

```json
{
  "knowledgeBaseId": "1900000000000000000",
  "query": "参数还原接口怎么用",
  "mode": "HYBRID",
  "topK": 5
}
```

`mode` 可选：

- `VECTOR`
- `KEYWORD`
- `HYBRID`

响应：

```json
{
  "hits": [
    {
      "chunkId": "1900000000000000003",
      "documentId": "1900000000000000001",
      "fileName": "接口说明.docx",
      "chunkIndex": 3,
      "content": "命中的片段内容",
      "score": 0.82,
      "source": "VECTOR"
    }
  ]
}
```

## 问答

### POST /api/chat

请求：

```json
{
  "knowledgeBaseId": "1900000000000000000",
  "conversationId": null,
  "question": "参数还原接口怎么调用？",
  "topK": 5
}
```

响应：

```json
{
  "conversationId": "1900000000000000004",
  "userMessageId": "1900000000000000005",
  "assistantMessageId": "1900000000000000006",
  "answer": "回答内容",
  "answerStatus": "ANSWERED",
  "citations": [
    {
      "documentId": "1900000000000000001",
      "chunkId": "1900000000000000003",
      "fileName": "接口说明.docx",
      "chunkIndex": 3,
      "score": 0.82,
      "snippet": "引用片段"
    }
  ]
}
```

`answerStatus` 表示本次问答是否真正基于知识库上下文完成：

- `ANSWERED`：检索到可用片段，并基于上下文生成回答。
- `EMPTY_KB`：当前知识库还没有任何可用文档切片，后端不会调用大模型，会返回固定提示。
- `NO_CONTEXT`：知识库有资料，但本次问题没有检索到相关片段，后端不会调用大模型，会返回固定提示。

当 `answerStatus` 为 `EMPTY_KB` 或 `NO_CONTEXT` 时，`citations` 为空。这样可以避免知识库证据不足时模型自由发挥。

### GET /api/conversations/{id}

查询会话消息和引用。

## 调用流程建议

1. 注册或登录，保存 token。
2. 创建知识库。
3. 在知识库设置中把知识库授权给普通用户。
4. 上传文档。
5. 轮询任务状态。
6. 任务成功后执行检索或问答。

说明：系统允许先创建空知识库并授权成员，但空知识库问答会返回 `EMPTY_KB`，不会让模型编造答案。
