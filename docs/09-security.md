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
- `USER`

第一版主要通过知识库 owner 和 tenant 做资源隔离，`knowledge_base_members` 已预留用于后续细粒度协作权限。

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
- 管理员用户管理页面。
- 文件病毒扫描和更严格 MIME 校验。
- 前端 XSS 防护策略和 CSP。
