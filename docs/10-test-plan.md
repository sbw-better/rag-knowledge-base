# 测试方案

## 自动化测试

后端已有核心单元测试：

- JWT 工具。
- Prompt 构造。
- RRF 混合检索预留逻辑。
- 文本切分。

执行：

```powershell
$env:JAVA_HOME="D:\tools\Java\jdk-17.0.19"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
mvn test
```

前端检查：

```powershell
cd frontend
npm run typecheck
npm run build
```

## 手工验收场景

### 认证

- 注册新用户成功。
- 登录成功并进入工作台。
- token 失效后跳转登录或显示重新登录提示。

### 知识库

- 创建知识库。
- 修改知识库名称、描述、chunkSize、chunkOverlap、topK。
- 删除知识库前有确认提示。
- 不同知识库的文档列表互不串数据。

### 文档入库

- 上传 TXT、Markdown、DOCX、PDF。
- 上传后生成任务。
- 任务状态从 `PENDING/RUNNING` 变为 `SUCCEEDED`。
- 不支持文件类型被前端拦截。
- 超过 50MB 文件被前端拦截。

### 检索

- `KEYWORD` 能根据关键词命中文档片段。
- `VECTOR` 在 Embedding 成功后可召回相似片段。
- `HYBRID` 能融合向量和关键词结果。

### 问答

- 提问后返回答案。
- 回答中显示引用来源。
- 引用来源包含文件名、chunkIndex、score、snippet。
- 会话可通过 `GET /api/conversations/{id}` 查询。

## 故障场景

- 后端未启动时前端显示“无法连接后端服务”。
- 模型服务超时时显示模型连接错误。
- API Key 无效时显示 API Key 配置错误。
- 文档解析失败时任务进入 `FAILED` 并展示错误详情。

## 验收标准

- 后端 `mvn test` 通过。
- 前端 `npm run typecheck` 通过。
- 前端 `npm run build` 通过。
- 新人按 README 能完成启动、注册、创建知识库、上传文档、问答。
