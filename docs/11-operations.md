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
select id, document_id, status, attempts, error_message from rag_tasks order by created_at desc;
select knowledge_base_id, count(*) from document_chunks group by knowledge_base_id;
```

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

### Swagger 没有 Authorize

开发环境应访问：

```text
http://localhost:8080/swagger-ui.html
```

如果使用 `prod` profile，Swagger 不匿名开放。
