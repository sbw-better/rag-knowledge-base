# MySQL/MyBatis-Plus/Milvus 迁移记录

## 背景

项目第一版为了快速跑通 RAG 全链路，曾使用 PostgreSQL + JPA + pgvector + UUID。后续讨论后决定尽早切换到团队更常用的技术栈：

- 业务数据库：MySQL 8.4。
- 数据访问：MyBatis + MyBatis-Plus。
- 主键：BIGINT 雪花 ID。
- 向量数据库：Milvus 2.6.x standalone。

这次处于开发早期，业务数据可以重置，因此不做旧 PostgreSQL 数据迁移。

## 决策原因

- 团队日常使用 MySQL 更多，排查、运维和 SQL 调优成本更低。
- MyBatis-Plus 对复杂 SQL、权限过滤、分页和报表类查询更可控。
- UUID 对人工排查、排序和索引局部性不友好，雪花 ID 更适合业务主键。
- Milvus 是专用向量数据库，后续数据量上来后比把向量混在业务库中更容易扩展。
- MySQL 保存业务事实，Milvus 保存可重建索引，职责边界更清楚。

## 已完成变化

- Maven 依赖切换为 MySQL Connector、MyBatis-Plus、Flyway MySQL。
- Flyway 初始化脚本改为 MySQL 表结构。
- 实体从 JPA Entity 改为 MyBatis-Plus DO。
- Repository 改为 Mapper。
- DTO ID 按字符串返回，前端继续用 `string`。
- `document_chunks` 删除向量字段，只保存文本和元数据。
- Milvus collection 保存 chunk 向量和检索需要的动态字段。
- `VECTOR` 检索走 Milvus。
- `KEYWORD` 检索走 MySQL FULLTEXT + LIKE。
- `HYBRID` 保留 RRF 融合逻辑。
- Docker Compose 替换 PostgreSQL 为 MySQL，并新增 Milvus standalone 依赖。
- 移除配置文件中的默认真实 API Key，只保留环境变量占位。

## 风险和防护

### 旧数据

本次默认重置开发数据，不迁移旧 PostgreSQL 数据。旧 PostgreSQL volume 不主动删除，如需保留应先人工导出。

### ID 精度

后端使用 Long，前端使用 string。禁止在前端把 ID 转成 number。

### MySQL 与 Milvus 一致性

MySQL 是事实库，Milvus 是索引库。入库失败会记录任务错误；后续应增加重建索引接口。

### Embedding 维度

`OPENAI_EMBEDDING_DIMENSIONS` 必须和 Milvus collection 维度一致。维度变化时需要重建 collection。

### 回滚

如果迁移后需要短期回滚：

1. 保留当前分支和 MySQL/Milvus volume。
2. 切回迁移前代码分支。
3. 启动旧 PostgreSQL 依赖。
4. 使用旧 Flyway 脚本和旧配置启动。

当前不建议做双写回滚，因为开发阶段数据可重置，双写会显著增加复杂度。

## 后续待办

- 增加 Milvus 集成测试。
- 已增加按知识库重建索引接口；后续补按文档重建和异步进度。
- 增加任务并发锁和超时恢复。
- 增加 OpenSearch 作为关键词检索升级方案。
- 增加数据库分页接口和更多 Mapper 测试。
