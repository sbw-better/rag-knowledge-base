# 运维手册

## 健康检查

```powershell
Invoke-RestMethod -Uri http://localhost:8080/actuator/health
```

期望结果：

```json
{
  "status": "UP"
}
```

## 查看 Docker 容器

```powershell
docker ps
```

常见容器：

- `ragkb-mysql`
- `ragkb-minio`
- `ragkb-milvus`
- `ragkb-milvus-etcd`
- `ragkb-milvus-minio`
- `ragkb-attu`
- `ragkb-app`

## 查看后端日志

本机启动时，查看启动终端输出或 `logs/` 目录。

Docker 启动时：

```powershell
docker logs ragkb-app
```

如果前端错误提示中出现“错误编号”，可在后端日志中搜索该 requestId。

## 查看数据库

进入 MySQL：

```powershell
docker exec -it ragkb-mysql mysql -urag -prag ragkb
```

常用 SQL：

```sql
select id, email, display_name from users;
select id, name, deleted from knowledge_bases;
select id, file_name, status, knowledge_base_id from documents order by created_at desc;
select id, type, document_id, knowledge_base_id, status, attempts, cancel_requested, error_message from rag_tasks order by created_at desc;
select knowledge_base_id, count(*) from document_chunks group by knowledge_base_id;
```

也可以在前端运维页“任务中心”查看任务统计概览，或直接调用：

```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/tasks/stats?knowledgeBaseId=你的知识库ID" -Headers @{ Authorization = "Bearer 你的JWT" }
```

任务中心支持勾选当前页任务后批量操作：

- 批量重试：只会提交已选中的 `FAILED` 任务。
- 批量取消：只会提交已选中的 `PENDING`、`RUNNING` 且尚未请求取消的任务。
- 后端批量接口按事务执行；如果某个任务不存在、越权或状态不合法，本次批量操作会整体失败。

对应接口：

```text
POST /api/tasks/batch/retry
POST /api/tasks/batch/cancel
```

## 执行端到端冒烟测试

在 Docker 依赖和后端启动后，可以执行：

```powershell
cd D:\ai-projects\rag-knowledge-base
powershell -ExecutionPolicy Bypass -File .\scripts\e2e-smoke.ps1 -AdminEmail your-admin@example.com
```

脚本会自动注册测试用户、创建知识库、授权成员、上传样例文档、等待入库、执行检索和问答、验证会话恢复和审计日志。
默认会删除本轮创建的测试文档和知识库；如需保留现场用于排查，添加 `-KeepData`。

如果历史冒烟测试留下了 `codex-e2e-*` 测试账号，可以先 dry-run 查看命中范围：

```powershell
.\scripts\cleanup-e2e-data.ps1
```

确认后执行清理：

```powershell
.\scripts\cleanup-e2e-data.ps1 -Force
```

或者在冒烟测试前自动清理旧 E2E 数据：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\e2e-smoke.ps1 -CleanupBefore
```

## 文档删除一致性

项目约定 MySQL 不依赖外键，因此删除文档时由业务代码按顺序主动清理：

1. 回答引用 `message_citations`。
2. Milvus 中该文档的向量索引。
3. MySQL 文档切片 `document_chunks`。
4. 入库任务 `rag_tasks`。
5. 文档元数据 `documents`。
6. MinIO 原始文件对象。

如果 Milvus 删除失败，后续 MySQL 删除会被阻止，避免出现“业务数据已删除但向量仍可命中”的状态。

## 重置开发数据

如果需要清空本地开发阶段创建的用户、知识库、文档、任务、会话和授权关系，可执行：

```powershell
cd D:\ai-projects\rag-knowledge-base
.\scripts\reset-dev-data.ps1 -Force
```

注意：

- 该脚本只清理 MySQL 业务数据。
- 不删除 MinIO 文件对象。
- 不删除 Milvus 向量数据。
- 清空后重新注册的第一个用户会成为 `ADMIN`。
- 执行前请确认没有需要保留的本地测试数据。

## 查看 MinIO

浏览器访问：

```text
http://localhost:9001
```

开发账号：

```text
minioadmin / minioadmin
```

检查 bucket：

- `rag-documents`

## 查看 Milvus

Milvus standalone 默认端口：

```text
http://localhost:19530
```

当前项目通过后端启动时的 `MilvusVectorStore.ensureCollection()` 自动检查和创建 collection。

开发环境推荐启动 Attu 查看 Milvus：

```powershell
docker compose up -d attu
```

浏览器访问：

```text
http://localhost:8000
```

如果向量检索异常，优先查看：

- 后端启动日志中 Milvus collection 初始化是否失败。
- `MILVUS_ENDPOINT` 是否指向正确地址。
- Embedding 维度和 collection 维度是否一致。

## 常见问题

### 前端提示无法连接后端

检查：

- Spring Boot 是否启动。
- 端口 `8080` 是否被占用。
- Vite proxy 是否仍指向 `http://localhost:8080`。

### 上传后任务一直 PENDING

检查：

- `INGESTION_WORKER_ENABLED=true`。
- 后端日志中 Worker 是否报错。
- `rag_tasks` 表的 status 和 attempts。

### 文档任务一直 RUNNING

当前 Worker 会按 `INGESTION_RUNNING_TIMEOUT_MS` 自动恢复超时任务，默认 10 分钟：

- 未达到 `INGESTION_MAX_ATTEMPTS` 时，任务会重新置为 `PENDING` 等待下一轮入库。
- 已达到最大尝试次数时，任务会标记为 `FAILED`，文档状态也会改为 `FAILED`。

排查时可以查看：

```sql
select id, document_id, status, attempts, max_attempts, locked_at, error_message
from rag_tasks
order by created_at desc;
```

如果模型接口响应非常慢，可以适当调大 `INGESTION_RUNNING_TIMEOUT_MS`；如果希望更快释放卡住任务，可以调小该值。

运维页“任务中心”支持对 `RUNNING` 任务发起取消请求。取消是协作式的：系统会先设置 `cancel_requested=1`，Worker 在解析、切片、删除旧向量、写入新向量等步骤边界检查到请求后，再把任务标记为 `CANCELLED`。

```sql
select id, type, status, cancel_requested, locked_at, started_at, finished_at, error_message
from rag_tasks
order by created_at desc;
```

### 文档任务 FAILED

常见原因：

- MinIO 无法读取对象。
- 文件格式解析失败。
- 模型 API Key 无效。
- 模型服务网络超时。
- Milvus 不可用。
- Embedding 维度和 Milvus collection 维度不一致。

### 向量检索没有结果，关键词有结果

可能原因：

- 文档切片写入 MySQL 成功，但 Milvus 写入失败。
- 模型服务调用失败，任务未真正完成。
- 查询和文档语义差距大。
- 使用了不同维度或不同模型生成问题向量和文档向量。
- `MILVUS_ENABLED=false`。

处理方式：

- 先确认 MySQL `document_chunks` 是否有切片。
- 再通过 Attu 查看 `rag_document_chunks` collection 是否有 entity。
- 管理员可在知识库“设置”中执行“重建向量索引”。

### Swagger 没有 Authorize

开发环境应访问：

```text
http://localhost:8080/swagger-ui.html
```

如果使用 `prod` profile，Swagger 不匿名开放。
