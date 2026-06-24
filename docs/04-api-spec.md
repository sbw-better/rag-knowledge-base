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
    "id": "uuid",
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

## 知识库

### POST /api/knowledge-bases

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

### GET /api/knowledge-bases/{id}

返回知识库详情。

### GET /api/knowledge-bases/{id}/documents

返回当前知识库下的文档和每个文档最近一次入库任务。

响应数据项：

```json
{
  "document": {
    "id": "uuid",
    "knowledgeBaseId": "uuid",
    "fileName": "example.docx",
    "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "sizeBytes": 1024,
    "status": "INDEXED",
    "errorMessage": null,
    "createdAt": "2026-06-23T10:00:00Z"
  },
  "task": {
    "id": "uuid",
    "documentId": "uuid",
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

更新名称、描述、切片参数和默认 TopK。

### DELETE /api/knowledge-bases/{id}

软删除知识库。

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
  "knowledgeBaseId": "uuid",
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
      "chunkId": "uuid",
      "documentId": "uuid",
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
  "knowledgeBaseId": "uuid",
  "conversationId": null,
  "question": "参数还原接口怎么调用？",
  "topK": 5
}
```

响应：

```json
{
  "conversationId": "uuid",
  "userMessageId": "uuid",
  "assistantMessageId": "uuid",
  "answer": "回答内容",
  "citations": [
    {
      "documentId": "uuid",
      "chunkId": "uuid",
      "fileName": "接口说明.docx",
      "chunkIndex": 3,
      "score": 0.82,
      "snippet": "引用片段"
    }
  ]
}
```

### GET /api/conversations/{id}

查询会话消息和引用。

## 调用流程建议

1. 注册或登录，保存 token。
2. 创建知识库。
3. 上传文档。
4. 轮询任务状态。
5. 任务成功后执行检索或问答。
