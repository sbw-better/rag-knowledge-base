# 当前状态与交接记录

更新时间：2026-09-04

本文档用于新开会话、交接开发或阶段复盘。内容基于当前可运行代码和最近一次完整测试结果整理。

## 一句话现状

当前项目已经从最初的 Spring Boot RAG MVP 演进为一个可本地运行的“企业知识库增强问答工作台”：

- 后端使用 `Spring Boot 3 + Spring Security + MyBatis-Plus + MySQL + Milvus + MinIO`。
- 前端使用 `Vite + React + TypeScript`。
- 支持系统角色、知识库成员权限、文档上传入库、向量检索、关键词检索、混合检索、问答引用、会话历史、答案反馈、知识缺口池、售后工单业务场景、审计日志、租户预留、Docker 本地依赖和 E2E 冒烟测试。

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

### 售后工单知识助手

- 新增售后工单业务模块，定位为“AI 售后工单辅助处理系统”的第一版业务场景。
- 支持工单分页列表、关键词搜索、状态筛选、优先级筛选、详情查看和新建工单。
- 工单包含模拟客户、订单、商品、渠道、分类、优先级、客户原问题和处理状态。
- 支持一键生成示例工单，便于无外部 CRM/电商系统接入时演示完整业务流程。
- 工单详情页内置 AI 回复工作区，可以带着当前工单上下文调用知识库问答，生成可编辑客服回复。
- 工单沟通流已区分客户补充消息、客服外发回复和内部备注；外发回复前会显示二次确认弹窗，展示客户、工单、状态变化和完整回复内容，确认后记录到时间线并把未关闭工单推进到待客户。
- 工单支持独立关闭/重开动作；关闭、重开和关闭状态下继续处理会按知识库管理/内容维护权限控制，前端会根据 `canWork`、`canClose`、`canReopen` 和 `allowedStatuses` 禁用不可用操作。
- AI 回复会显示引用来源；若知识库为空或没有命中资料，会沿用知识缺口机制沉淀问题。
- 工单详情已接入知识闭环面板，可查看该工单关联的知识缺口和回答反馈；知识缺口可在工单详情内标记已处理，已处理缺口可触发复检生成客服回复。
- ChatRequest 已扩展 `businessModule`、`businessEntityId` 和 `businessContext`，当前工单场景使用 `SUPPORT_TICKET + 工单 ID` 关联反馈和知识缺口。

### 答案反馈与知识缺口

- 问答回答支持“有用 / 需补充”反馈。
- 负反馈会自动创建知识缺口，记录原因、备注、原问题、回答摘要和业务对象。
- 空知识库、无命中、资料不足场景会自动创建知识缺口。
- 知识库详情页可查看知识缺口列表，并支持将缺口标记为已解决。

### 前端工作台

- 登录/注册页。
- 工作台布局支持桌面侧边栏收缩、移动端底部服务导航，导航定义集中在 `workspace-navigation.tsx`。
- 工作台首页已从入口页调整为概览页，展示工单摘要、售后运营看板、知识库状态和管理员最近管理动作。
- 售后运营看板由 `/api/support-tickets/stats` 聚合提供，支持今日/近 7 天/近 30 天窗口，展示工单状态、环比变化、趋势对比、坐席维度、平均首响、SLA 达成率、AI 辅助回复数、客服外发数、知识命中率估算、待补知识数、无答案排行、分类/渠道/优先级分布。
- 知识库目录页已调整为目录行结构，展示名称、描述、权限、创建时间和核心检索参数。
- 知识库详情页：
  - 文档
  - 检索
  - 问答
  - 成员
  - 配置
  - 运维
- 用户管理、租户管理、审计日志页复用 `pages/admin` 的管理页容器、筛选栏、记录卡片和审计中文标签。
- 售后工单页已调整为三段式工作台：工单队列、客户问题/业务信息/AI 回复草稿、处理动作/时间线。
- 售后工单页支持负责人、状态流转、关闭/重开、内部备注、客户补充消息、客服外发回复、分流沟通记录、知识闭环联动、流转历史、SLA 标识、队列多选、批量接手、批量状态流转、批量生成回复、批量结果摘要和示例工单生成。
- 文档切片查看已从页面底部展开优化为抽屉/弹窗式查看。
- 运维页提供任务中心、任务统计概览、批量操作栏和任务详情抽屉，可查看完整任务 ID、状态、尝试次数、取消请求、时间线、耗时和错误信息。
- 已做一次桌面 `1440x900` 和移动约 `390x844` 的视觉 QA，覆盖首页、工单、知识库、用户、租户、审计页面；售后运营看板已补充移动端窗口切换、指标卡、趋势图和坐席维度目视检查；未发现横向溢出或控件裁切。

### 运维与测试

- Docker Compose 启动 MySQL、MinIO、Milvus、Attu。
- `scripts/start-dev.ps1` 可启动依赖并打包运行后端。
- `scripts/e2e-smoke.ps1` 可执行端到端冒烟测试。
- `scripts/reset-dev-data.ps1` 可重置开发业务数据。
- 后端自动化测试当前为 39 个用例。
- 最近一次验证：
  - `mvn test`：通过，`Tests run: 39, Failures: 0, Errors: 0, Skipped: 0`（2026-09-06，JDK 17）。
  - `npm run typecheck`：通过（2026-09-06）。
  - `npm run build`：通过（2026-09-06；Vite 仍提示单个 chunk 超过 500 kB，不影响构建结果）。
  - `/api/support-tickets/stats?days=7`：通过，返回 7 天窗口、趋势数据、坐席维度、平均首响和 SLA 字段。
  - E2E 冒烟测试：上次已通过；本轮未重新执行。

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
├─ support           售后工单、示例数据、工单 AI 回复生成
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
├─ pages             登录、工作台、工单、知识库、用户、租户、审计等页面
│  ├─ admin          管理页共享组件、审计中文标签
│  ├─ knowledge-base 知识库详情页各 Tab 面板
│  ├─ knowledge-bases 知识库目录页组件
│  ├─ support-tickets 售后工单队列、详情、侧栏、弹窗组件
│  └─ workspace-home 工作台首页概览组件
├─ types.ts          前端类型定义
├─ App.tsx           路由和 Query Client
└─ styles.css        全局样式
```

### 当前未提交改动分组

截至 2026-09-04，本地工作区存在一组连续开发改动，提交前建议按主题拆分：

1. 前端信息架构与页面拆分
   - `frontend/src/pages/WorkspaceLayout.tsx`
   - `frontend/src/pages/workspace-navigation.tsx`
   - `frontend/src/pages/WorkspaceHomePage.tsx`
   - `frontend/src/pages/workspace-home/`
   - `frontend/src/pages/admin/`
   - `frontend/src/pages/KnowledgeBasesPage.tsx`
   - `frontend/src/pages/knowledge-bases/`
   - `frontend/src/pages/KnowledgeBasePage.tsx`
   - `frontend/src/pages/knowledge-base/`
   - `frontend/src/pages/SupportTicketsPage.tsx`
   - `frontend/src/pages/support-tickets/`
   - `frontend/src/components/ui.tsx`

2. 前端 API 和类型扩展
   - `frontend/src/lib/api.ts`
   - `frontend/src/types.ts`
   - `frontend/src/App.tsx`

3. 售后工单流程后端扩展
   - `src/main/java/com/example/rag/domain/SupportTicket.java`
   - `src/main/java/com/example/rag/domain/SupportTicketEvent.java`
   - `src/main/java/com/example/rag/domain/SupportTicketEventType.java`
   - `src/main/java/com/example/rag/mapper/SupportTicketMapper.java`
   - `src/main/java/com/example/rag/mapper/SupportTicketEventMapper.java`
   - `src/main/java/com/example/rag/support/`
   - `src/main/resources/db/migration/V11__add_support_ticket_workflow.sql`
   - `src/main/resources/mapper/SupportTicketMapper.xml`
   - `src/main/resources/mapper/SupportTicketEventMapper.xml`

4. 视觉 QA 临时数据
   - 本地开发库中创建了 `codex-visual-20260904164436@example.com` 测试账号、`视觉 QA 知识库` 和 3 条示例工单。
   - 清理前需确认不会影响手工验收；如果要清理，优先写脚本按 `codex-visual-*` 前缀删除，而不是手工删表。

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
- 售后工单已经支持负责人、SLA、流转历史、内部备注、客户补充消息、客服外发回复、外发确认、关闭/重开、状态流转权限、队列多选、批量接手、批量状态流转、批量生成回复和批量结果摘要，但真实外部系统同步仍未实现。
- 移动端当前可用且无明显溢出，但工单详情仍是“队列在前、详情在后”的长滚动模式，不是深度移动端分屏/切换交互。
- 文档任务、切片、索引维护等管理页面还可以继续提升信息层级和操作效率。
- E2E 脚本会留下测试用户，避免误删真实账号；后续可以增加带前缀的测试账号清理工具。

### 技术债与工程问题

- Flyway 对 MySQL 8.4 会提示版本支持 warning，目前不影响运行，但后续可以升级 Flyway/Spring Boot 版本确认。
- 当前测试大部分是单元测试和脚本级 E2E，缺少 Testcontainers 或真实 MySQL/Milvus 的集成测试套件。
- 部分前后端文案和日志已经中文化，但仍可继续统一术语。

## 推荐下一步升级路线

### P0：继续打磨售后业务闭环

1. 工单沟通与批处理
   - 增加真实客服/电商系统消息同步。
   - 批量操作后续可改为后端批处理接口，减少多请求并发和长耗时操作的前端等待。

2. 反馈闭环深化
   - 增加知识缺口处理后的自动复检记录和复检结果摘要。
   - 将复检生成结果与原知识缺口建立更明确的审计/时间线关联。

### P1：补可靠性和可维护性

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

### P2：提升 RAG 效果

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

### P3：完善企业生产能力

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
基于当前项目状态继续开发。优先处理售后工单业务闭环，例如负责人/SLA、工单流转历史、业务看板和工单关联知识缺口复检。
修改后必须执行 mvn test、npm run typecheck、npm run build，并尽量跑 e2e-smoke。
```

推荐下一步实际开发任务：

2026-09-07 补充：知识缺口复检闭环已实现。
- 首次处理缺口后自动检索原问题；手动 `POST /api/knowledge-feedback/issues/{id}/recheck` 可再次复检。
- V12 新增复检历史表，保存操作人、时间、命中数量和摘要；列表及工单关联数据返回最近 10 条记录。
- 结果区分 CONTEXT_FOUND、NO_CONTEXT、FAILED，召回资料不代表回答质量已通过；未命中或失败不会撤销人工处理状态。
- 关联工单写入 KNOWLEDGE_RECHECK 时间线事件；只读知识库成员不可通过 business-links 获取工单反馈数据。
- 知识运营页和工单页共用复检摘要/历史组件，支持重新复检；原“复检生成”改为“生成新回复”以区分功能。
- 已在临时 8081 实例执行真实 MySQL 迁移及 `scripts/recheck-smoke.ps1`，验证自动复检、重试历史、重复处理幂等、关联查询、工单事件和统计。
- 保留测试数据供检查：知识库 2096763605823975426，工单 2096763606016913409，缺口 2096763606276960261；名称前缀 Recheck smoke 20260907085253。
- 当前复检同步执行检索，后续可任务化；生产规模下需批量加载历史以减少列表额外查询。
- 本轮后端 52 个测试通过，前端 typecheck/build 通过；临时 8081 验证实例已停止，8080 原实例需重启后加载新代码。

2026-09-06 补充：工单列表、总数、详情、事件时间线及运营看板已统一按当前用户可维护的知识库限制访问。
复用知识库权限：owner、EDITOR、MANAGER 可查看对应工单，ADMIN 可查看本租户未删除知识库的工单，VIEWER 不可查看。
统计过滤覆盖环比、分类/渠道/优先级、趋势、坐席外发、知识缺口和无答案排行；空权限范围在 SQL 中返回空数据。
新增权限服务测试和 MyBatis 动态 SQL 测试，后端 `mvn -o test` 共 44 个测试通过。
尚未针对真实数据库执行本轮权限场景的端到端验证。

1. 将复检和工单批量操作任务化，增加进度与失败重试；增强复检引用详情和人工质量确认。
2. 接入真实客服/电商系统消息同步。
3. 将批量操作升级为后端批处理接口，并增加任务化进度。
