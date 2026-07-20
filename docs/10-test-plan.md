# 测试方案

## 自动化测试

后端测试使用 JUnit 5 + Mockito。当前已覆盖 26 个用例，重点包括：

- JWT token 生成和解析。
- Prompt 构造。
- RRF 混合检索融合逻辑。
- 检索分数阈值过滤。
- 文本切分。
- 空知识库问答不调用模型。
- 无命中问答不调用模型。
- 模型判断资料不足时不返回误导性引用。
- 分页参数清洗和分页响应计算。
- `USER`、`KB_MANAGER`、`ADMIN` 系统角色边界。
- `VIEWER`、`EDITOR`、`MANAGER` 知识库成员权限边界。
- ADMIN 不需要也不能被作为知识库成员授权。
- OWNER 权限不能手动分配。
- 管理员用户角色修改。
- 不允许管理员移除自己的 ADMIN 角色。
- 审计日志查询权限。
- 审计日志写入失败不影响主业务。
- 删除文档时主动清理回答引用、Milvus 向量、MySQL 切片、入库任务、文档元数据和 MinIO 对象。
- RUNNING 入库任务超时后自动重新排队。
- RUNNING 入库任务达到最大尝试次数后自动标记失败。

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

## 端到端冒烟测试

依赖服务和后端启动后，可以执行脚本走完整 HTTP 链路：

```powershell
cd D:\ai-projects\rag-knowledge-base
powershell -ExecutionPolicy Bypass -File .\scripts\e2e-smoke.ps1 -AdminEmail your-admin@example.com
```

覆盖流程：

- 后端健康检查。
- 管理员登录。
- 注册 `manager/viewer/editor` 测试用户。
- 管理员给 manager 分配 `KB_MANAGER`。
- 验证普通 `USER` 不能创建知识库。
- `KB_MANAGER` 创建知识库并成为 `OWNER`。
- 验证未授权用户看不到知识库。
- 授权 `VIEWER` 和 `EDITOR`。
- 验证 `VIEWER` 只能问答，不能维护文档。
- 空知识库问答返回 `EMPTY_KB`。
- 上传 Markdown 文档并等待异步入库成功。
- 查询文档列表、文档切片、HYBRID 检索。
- `VIEWER` 发起问答，验证会话恢复和历史会话搜索。
- 查询审计日志。
- 删除测试文档，验证文档列表清空。
- 默认删除本轮创建的测试知识库。

默认行为会清理本轮创建的文档和知识库。若需要保留现场排查问题，可加 `-KeepData`：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\e2e-smoke.ps1 -AdminEmail your-admin@example.com -KeepData
```

## 手工验收场景

### 认证

- 注册新用户成功。
- 第一个注册用户自动拥有 `ADMIN`。
- 后续注册用户默认只有 `USER`。
- 登录成功并进入工作台。
- token 失效后跳转登录或显示重新登录提示。

### 角色和权限

- `USER` 默认不能创建知识库。
- `KB_MANAGER` 可以创建知识库，并自动成为该知识库负责人。
- `ADMIN` 可以查看租户内全部知识库和用户管理页面。
- 普通 `USER` 没有授权时看不到任何知识库。
- 授权为 `VIEWER` 后只能进入问答页，不能维护文档、成员、配置和索引。
- 授权为 `EDITOR` 后可以维护文档和检索调试，不能管理成员和配置。
- 授权为 `MANAGER` 后可以管理成员、配置和索引。
- 不允许给 `ADMIN` 分配知识库成员权限。
- 不允许手动分配 `OWNER`。
- 只有负责人、`MANAGER` 或 `ADMIN` 可以管理成员。
- 只有负责人或 `ADMIN` 可以删除知识库。

### 知识库

- 创建知识库。
- 修改知识库名称、描述、chunkSize、chunkOverlap、topK、minScore。
- 删除知识库前有确认提示。
- 不同知识库的文档列表互不串数据。
- 知识库列表分页和搜索正常。
- 长名称、长描述在前端不撑破布局。

### 文档入库

- 上传 TXT、Markdown、DOCX、PDF。
- 上传后生成任务。
- 任务状态从 `PENDING/RUNNING` 变为 `SUCCEEDED`。
- 文档列表分页和搜索正常。
- 点击查看切片应在弹窗或独立区域中查看，不应把页面无限拉长。
- 删除文档时会清理引用、切片、入库任务、向量索引和对象存储文件。
- 重新入库会重新生成切片和向量索引。
- 不支持文件类型被前端拦截。
- 超过 50MB 文件被前端拦截。

### 检索

- `KEYWORD` 能根据关键词命中文档片段。
- `VECTOR` 在 Embedding 成功后可召回相似片段。
- `HYBRID` 能融合向量和关键词结果。

### 问答

- 提问后返回答案。
- 空知识库时返回固定提示，不调用模型。
- 有资料但无相关命中时返回固定提示，不展示引用来源。
- 回答中显示本次回答引用来源。
- 切换历史消息后，右侧来源面板展示当前选中回答的来源。
- 引用来源包含文件名、chunkIndex、score、snippet。
- 会话可通过 `GET /api/conversations/{id}` 查询。
- 刷新页面后可以恢复最近会话。
- 历史会话可搜索、切换和删除。
- 流式回答过程中不应出现残留的“正在接收模型输出...”提示。

### 用户、租户和审计

- 只有 `ADMIN` 可以访问用户管理。
- 修改用户角色后前端权限入口同步变化。
- 只有 `ADMIN` 可以访问租户管理。
- 只有 `ADMIN` 可以查看审计日志。
- 创建知识库、授权成员、上传文档、删除文档、重建索引等动作会写入审计日志。

### Mapper XML

- Mapper 接口不再写 SQL 注解，复杂 SQL 统一放到 `src/main/resources/mapper/*.xml`。
- 新增 Mapper 方法时必须同时检查 XML namespace、方法 id、参数名和返回类型。
- 修改 XML 后执行 `mvn test`，保证 MyBatis XML 可以被资源复制和编译流程发现。

## 故障场景

- 后端未启动时前端显示“无法连接后端服务”。
- 模型服务超时时显示模型连接错误。
- API Key 无效时显示 API Key 配置错误。
- 文档解析失败时任务进入 `FAILED` 并展示错误详情。
- Milvus 未启动时入库或检索应返回明确错误，任务进入失败状态。
- MySQL 或 MinIO 未启动时后端启动或文件上传应有明确日志。
- 端口 8080 被占用时需停止占用进程或更换 `server.port`。

## 验收标准

- 后端 `mvn test` 通过。
- 前端 `npm run typecheck` 通过。
- 前端 `npm run build` 通过。
- 新人按 README 能完成启动、注册、创建知识库、上传文档、问答。

## 最近一次自动化测试记录

执行时间：2026-07-20

后端：

```powershell
$env:JAVA_HOME="D:\tools\Java\jdk-17.0.19"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
mvn test
```

结果：通过，`Tests run: 26, Failures: 0, Errors: 0, Skipped: 0`。

说明：`AuditLogServiceTest.recordDoesNotBreakMainBusinessWhenMapperFails` 会故意模拟审计日志写入异常，因此测试日志中会出现一条“审计日志写入失败”的堆栈；这是预期场景，不代表测试失败。
