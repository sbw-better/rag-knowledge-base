# 当前状态与交接记录

更新时间：2026-07-30

本文档用于新开会话、交接开发或阶段复盘。内容基于当前可运行代码和最近一次完整测试结果整理。

## 一句话现状

当前项目已经从最初的 Spring Boot RAG MVP 演进为一个可本地运行的“企业知识库增强问答工作台”：

- 后端使用 `Spring Boot 3 + Spring Security + MyBatis-Plus + MySQL + Milvus + MinIO`。
- 前端使用 `Vite + React + TypeScript`。
- 支持系统角色、知识库成员权限、文档上传入库、向量检索、关键词检索、混合检索、问答引用、会话历史、审计日志、租户预留、Docker 本地依赖和 E2E 冒烟测试。

当前阶段仍是开发/准生产演进版本，不建议直接用于正式生产。

## 当前已实现功能

### 认证与用户

- 用户注册、登录、JWT 鉴权、当前用户信息。
- 第一个注册用户自动成为 `ADMIN`。
- 系统角色：
  - `ADMIN`：平台管理员，可管理用户、租户、所有知识库。
  - `KB_MANAGER`：知识库管理员，可创建知识库，并自动成为自己创建知识库的负责人。
  - `USER`：普通用户，只能访问被授权的知识库。
- 用户管理页面可给用户分配/取消 `KB_MANAGER`、`ADMIN` 等系统角色。
- `ADMIN` 不是知识库成员，不需要被分配到某个知识库；管理员天然拥有平台级访问能力。

### 知识库与权限

- 支持创建、列表、详情、更新、删除知识库。
- 知识库成员权限：
  - `OWNER`：创建者自动拥有，不允许手动分配。
  - `MANAGER`：可管理成员、配置和索引维护。
  - `EDITOR`：可维护资料。
  - `VIEWER`：只允许问答。
- 普通用户不能创建知识库。
- 未授权用户看不到对应知识库，也不能通过接口访问。
- 当前仍是一个前端应用，通过权限控制展示管理功能和普通问答功能，不拆管理端/用户端。

### 文档入库

- 支持上传 `PDF`、`DOCX`、`TXT`、`Markdown`、`HTML`。
- 原始文件保存到 MinIO。
- MySQL 保存文档元数据、任务、切片文本。
- Milvus 保存向量索引。
- 入库流程：
  1. 上传文件。
  2. 创建 `documents` 记录。
  3. 创建 `rag_tasks` 异步任务。
  4. Worker 解析文档。
  5. 清洗和切片。
  6. 调用 Embedding。
  7. 写入 MySQL 切片和 Milvus 向量。
  8. 更新任务和文档状态。
- 支持重入库。
- 支持删除文档，并主动清理引用、Milvus 向量、MySQL 切片、任务、文档记录和 MinIO 文件。
- 入库任务支持超时恢复：长时间停留 `RUNNING` 的任务会自动重新排队或标记失败。
- 运维任务中心支持按知识库查看文档入库/索引重建任务，支持任务统计、失败重试、批量重试、等待任务取消、批量取消、运行中任务请求取消和任务详情抽屉。

### 检索与问答

- 检索模式：
  - 语义向量检索：Milvus。
  - 关键词检索：MySQL FULLTEXT/LIKE 兜底。
  - 混合检索：向量 + 关键词 + RRF 融合。
- 问答流程：
  1. 用户选择知识库。
  2. 提交问题。
  3. 系统检索当前知识库。
  4. 根据命中片段构建 Prompt。
  5. 调用 OpenAI-compatible Chat 模型。
  6. 保存会话、消息和引用来源。
  7. 前端展示回答和当前回答对应的引用。
- 空知识库、无命中、资料不足时会给出明确回答，避免胡编。
- 明显闲聊或问候（例如“哈哈”“你好”“谢谢”）会直接自然回应，不再硬走知识库检索。
- Prompt 已要求回答少用机械套话、不要输出 Markdown 粗体/表格，尽量先给结论再补必要步骤。
- 会话支持创建、历史列表、搜索、切换查看。

### 前端工作台

- 登录/注册页。
- 工作台布局，支持侧边栏收缩。
- 知识库列表页。
- 知识库详情页：
  - 文档
  - 检索
  - 问答
  - 成员
  - 配置
  - 运维
- 用户管理页。
- 租户管理页。
- 审计日志页。
- 文档切片查看已从页面底部展开优化为抽屉/弹窗式查看。
- 运维页提供任务中心、任务统计概览、批量操作栏和任务详情抽屉，可查看完整任务 ID、状态、尝试次数、取消请求、时间线、耗时和错误信息。
- 页面已做基础响应式适配，但移动端仍是“可用优先”，不是完整移动 App 体验。

### 运维与测试

- Docker Compose 启动 MySQL、MinIO、Milvus、Attu。
- `scripts/start-dev.ps1` 可启动依赖并打包运行后端。
- `scripts/e2e-smoke.ps1` 可执行端到端冒烟测试。
- `scripts/reset-dev-data.ps1` 可重置开发业务数据。
- 后端自动化测试当前为 39 个用例。
- 最近一次完整验证：
  - `mvn test`：通过，`Tests run: 39, Failures: 0, Errors: 0, Skipped: 0`。
  - `npm run typecheck`：通过。
  - `npm run build`：通过。
  - E2E 冒烟测试：通过。

## 当前项目结构

### 后端核心目录

```text
src/main/java/com/example/rag
├─ auth              认证、JWT、当前用户、用户管理、Spring Security 配置
├─ audit             审计日志记录和查询
├─ chat              RAG 问答、会话、消息、引用来源
├─ common            通用响应、分页、异常、工具类
├─ config            应用配置、基础设施 Bean、生产安全检查
├─ document          文档上传、任务查询、切片查看、删除、重入库
├─ domain            MyBatis-Plus 实体和枚举
├─ ingestion         文档异步入库 Worker
├─ knowledge         知识库、成员授权、权限判断、索引维护入口
├─ mapper            MyBatis Mapper 接口
├─ model             OpenAI-compatible Chat/Embedding 客户端
├─ parser            文档解析、清洗、切片
├─ retrieval         Milvus、检索、混合融合、异步索引重建
├─ storage           MinIO 对象存储
└─ tenant            租户管理预留和基础管理能力
```

### SQL 与数据库迁移

```text
src/main/resources
├─ db/migration      Flyway MySQL 迁移脚本
├─ mapper            MyBatis XML SQL
└─ application.yml   默认配置和环境变量映射
```

当前已经把大量 Mapper 注解 SQL 迁移到 XML 文件中，后续新增复杂 SQL 应继续放到 `src/main/resources/mapper`。

### 前端核心目录

```text
frontend/src
├─ components        轻量通用 UI 组件
├─ lib               API Client、认证状态、工具函数
├─ pages             登录、工作台、知识库、用户、租户、审计等页面
├─ types.ts          前端类型定义
├─ App.tsx           路由和 Query Client
└─ styles.css        全局样式
```

## 当前主要缺陷与风险

### 生产能力不足

- 目前使用 DB 任务表 + Scheduler，不是 MQ。可用，但高并发和多实例下还不够稳。
- 当前任务系统仍是 DB 轮询模型；已支持单个/批量重试、单个/批量取消请求、详情查看和基础统计，但缺少失败分类统计和精细进度。
- Milvus 是外部索引，可异步重建，但索引重建的 chunk 级进度、失败 chunk 记录和恢复策略仍需加强。
- 没有完整接入监控体系，例如 Prometheus、Grafana、集中日志、告警。

### 权限与租户仍需深化

- 租户目前以默认租户为主，已有字段和基础页面，但没有完整租户创建、邀请、切换、租户管理员隔离流程。
- 管理员能看到所有知识库，这是当前设计；后续如果引入多租户平台，需要区分平台超级管理员和租户管理员。
- 成员权限已经可用，但更细粒度的操作权限、审计追踪、权限变更历史还不完整。

### 检索与回答质量仍是基础版

- 关键词检索目前用 MySQL FULLTEXT/LIKE 兜底，生产级中文检索建议接 OpenSearch/Elasticsearch。
- 没有接入专业 Rerank 模型。
- Prompt 和答案质量已经做了防幻觉处理，但仍需基于真实业务文档持续调优。
- 目前没有完整的离线评测集、命中率评测、回答准确率评测。

### 文档处理能力有限

- Apache Tika 可解析常见文档，但复杂 PDF、扫描件、图片表格、版式还原能力有限。
- 未接 OCR。
- 未做文档去重、版本管理、增量更新、批量上传、目录层级管理。
- 大文档入库的进度展示还比较粗。

### 前端体验仍有优化空间

- 问答历史、引用来源和会话管理已可用，但还可以进一步接近成熟产品体验。
- 移动端当前是基础自适应，不是深度移动端交互。
- 文档任务、切片、索引维护、审计日志等管理页面还可以继续提升信息层级和操作效率。
- E2E 脚本会留下测试用户，避免误删真实账号；后续可以增加带前缀的测试账号清理工具。

### 技术债与工程问题

- Flyway 对 MySQL 8.4 会提示版本支持 warning，目前不影响运行，但后续可以升级 Flyway/Spring Boot 版本确认。
- 当前测试大部分是单元测试和脚本级 E2E，缺少 Testcontainers 或真实 MySQL/Milvus 的集成测试套件。
- 部分前后端文案和日志已经中文化，但仍可继续统一术语。

## 推荐下一步升级路线

### P0：先补可靠性和可维护性

1. 任务管理继续增强
   - 增加失败分类统计和更细的耗时分位统计。
   - 增加批量操作结果摘要和部分失败提示。
   - 增加索引重建进度、失败 chunk 明细和恢复建议。
   - 将运行中取消进一步细化为更明确的“可安全停止点”提示。

2. 索引维护深化
   - 支持按文档重建。
   - 展示重建进度、失败 chunk、耗时。
   - 增加索引版本或重建批次，降低取消/失败导致部分索引不一致的风险。

3. E2E 测试数据清理
   - 新增脚本清理 `codex-e2e-*` 测试账号及其关联数据。
   - 避免手工测试数据越来越多。

4. 权限测试补强
   - 覆盖每个接口在 `ADMIN/KB_MANAGER/OWNER/MANAGER/EDITOR/VIEWER/USER` 下的允许/拒绝场景。
   - 补充前端权限菜单展示测试。

### P1：提升 RAG 效果

1. 接入 Rerank
   - 推荐先接 DashScope/Qwen rerank 或 BGE reranker。
   - 检索流程改为：粗召回 -> rerank -> prompt 构造。

2. 中文关键词检索升级
   - 引入 OpenSearch/Elasticsearch。
   - MySQL 只保留业务事实数据。
   - 关键词检索、混合检索、过滤条件统一封装。

3. 检索评测
   - 建立测试问题集。
   - 记录命中片段、回答状态、引用准确性。
   - 输出简单评测报告。

### P2：完善企业生产能力

1. 多租户正式化
   - 平台管理员、租户管理员、租户用户分层。
   - 租户创建、禁用、切换、邀请用户。
   - 租户级资源配额。

2. 审计与监控
   - 审计日志增加导出。
   - 接入指标监控：接口耗时、模型耗时、Embedding 耗时、检索耗时、任务失败率。
   - 接入集中日志和 requestId 链路追踪。

3. 文档能力升级
   - OCR。
   - 批量上传。
   - 文档版本。
   - 文档目录。
   - 文档去重。

4. 部署生产化
   - 前端生产部署。
   - 后端 Docker 镜像构建优化。
   - 环境变量和密钥管理。
   - MySQL、Milvus、MinIO 的备份和恢复方案。

## 常用验证命令

### 启动后端依赖和服务

```powershell
cd D:\ai-projects\rag-knowledge-base
.\scripts\start-dev.ps1
```

### 启动前端

```powershell
cd D:\ai-projects\rag-knowledge-base\frontend
npm install
npm run dev
```

### 后端测试

```powershell
cd D:\ai-projects\rag-knowledge-base
$env:JAVA_HOME="D:\tools\Java\jdk-17.0.19"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
mvn test
```

### 前端检查

```powershell
cd D:\ai-projects\rag-knowledge-base\frontend
npm run typecheck
npm run build
```

### E2E 冒烟测试

```powershell
cd D:\ai-projects\rag-knowledge-base
powershell -ExecutionPolicy Bypass -File .\scripts\e2e-smoke.ps1 -AdminEmail your-admin@example.com
```

### 查看健康状态

```powershell
Invoke-RestMethod -Uri http://localhost:8080/actuator/health
```

## 新会话继续工作建议

新开会话时，可以直接说明：

```text
请先阅读 D:\ai-projects\rag-knowledge-base\docs\14-current-status-handoff.md，
基于当前项目状态继续开发。优先处理 P0 中的任务失败原因聚合、索引维护进度和失败恢复能力。
修改后必须执行 mvn test、npm run typecheck、npm run build，并尽量跑 e2e-smoke。
```

推荐下一步实际开发任务：

1. 给任务中心增加失败原因聚合、耗时分位统计和批量操作结果摘要。
2. 给索引重建任务增加 chunk 级进度、失败 chunk 记录和按文档重建入口。
3. 增加真实 MySQL/Milvus 集成测试或 Testcontainers 测试。
4. 扩展 E2E 覆盖任务详情、运行中取消请求和索引重建任务列表。
