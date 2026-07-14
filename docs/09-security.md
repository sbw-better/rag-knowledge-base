# 安全设计

## 认证

系统使用 JWT 鉴权：

- 登录和注册成功后返回 token。
- 前端将 token 保存在 localStorage。
- 请求受保护接口时添加 `Authorization: Bearer <token>`。
- 后端通过 `JwtAuthenticationFilter` 解析 token 并设置认证上下文。

## 授权

当前版本包含角色：

- `ADMIN`
- `KB_MANAGER`
- `USER`

系统角色和知识库资源身份分开处理：

- `ADMIN` 是平台管理员，可管理用户角色，并可管理租户内所有知识库。
- `KB_MANAGER` 是知识库创建权限，可创建知识库；创建后自动成为该知识库 owner。
- `USER` 是基础用户，默认只能访问被授权的知识库。
- owner 不是系统角色，而是某个知识库上的负责人身份，由 `knowledge_bases.owner_id` 表达。
- `knowledge_base_members` 表达知识库成员授权，例如把某个知识库开放给普通用户问答。

当前管理动作限制：

- 用户角色配置：仅 `ADMIN`。
- 创建知识库：`ADMIN` 或 `KB_MANAGER`。
- 修改、删除知识库：知识库 owner 或 `ADMIN`。
- 上传文档、查看入库任务、检索调试、重建向量索引：前端仅对可管理用户展示，后端继续校验 owner 或 `ADMIN`。
- 成员授权：知识库 owner 或 `ADMIN` 可添加、更新、移除成员。
- 普通用户侧重问答使用，不展示 TopK、Chunk、索引重建等技术维护信息。

## 数据隔离

数据表保留 `tenant_id`，当前默认单租户。知识库相关查询需要校验当前用户访问权限，文档列表、检索和问答都应限定在当前知识库内。

## 生产启动检查

`ProductionSafetyConfig` 在 `prod` profile 下执行安全检查：

- 禁止默认 JWT Secret。
- 禁止默认 MinIO 账号密码。
- 要求配置 `OPENAI_API_KEY`。

检查失败时应用直接启动失败，避免默认配置上线。

## Swagger 暴露策略

开发环境：

- Swagger 匿名可访问，便于调试。

生产环境：

- Swagger 不匿名开放。
- `/actuator/info` 不匿名开放。
- `/actuator/health` 保持可访问，便于健康检查。

## 密钥管理

要求：

- 不在 Git 中提交真实 API Key、数据库密码、JWT Secret。
- 使用环境变量或密钥管理系统注入敏感配置。
- 若密钥曾出现在截图、提交记录或聊天中，应立即在供应商控制台重置。

## 当前风险和后续加固

当前仍需后续增强：

- Refresh Token 和 token 撤销。
- 登录失败次数限制。
- 密码复杂度策略。
- 审计日志写入业务操作。
- 更完整的管理员用户管理页面，例如禁用账号、重置密码、审计授权历史。
- 文件病毒扫描和更严格 MIME 校验。
- 前端 XSS 防护策略和 CSP。
