# 前端设计说明

## 技术栈

- Vite
- React 19
- TypeScript
- React Router
- TanStack Query
- Axios
- Tailwind CSS
- lucide-react

## 页面结构

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/login` | 登录页 | 用户登录 |
| `/register` | 注册页 | 用户注册 |
| `/app` | 工作台布局 | 受保护路由 |
| `/app/knowledge-bases` | 知识库列表 | 创建和进入知识库 |
| `/app/knowledge-bases/:id` | 知识库详情 | 文档、检索、问答、设置 |

## 工作台布局

- 左侧：知识库导航、创建入口、用户信息、退出。
- 顶部：当前系统标题、知识库入口、退出。
- 主区域：根据路由显示列表或详情。

## 知识库详情页

详情页使用 Tabs：

- 文档：上传文件、查看当前知识库文档任务。
- 检索：选择 `VECTOR`、`KEYWORD`、`HYBRID` 模式测试召回。
- 问答：基于当前知识库进行 RAG 对话，展示引用来源。
- 设置：修改知识库名称、描述、切片参数、TopK，支持删除。

## 状态管理

- JWT 和用户信息保存在 localStorage。
- 服务端数据使用 TanStack Query。
- 表单使用 React 受控组件。
- 文档任务通过 Query refetchInterval 轮询。

## API 层

`src/lib/api.ts` 统一处理：

- `VITE_API_BASE_URL`。
- JWT 自动注入。
- 401 自动清理登录态并跳转登录。
- 网络错误、超时、模型错误、服务端错误的友好提示。
- 解包后端统一响应 `{ success, data, error }`。

## 错误处理

- `ErrorBoundary` 防止前端未捕获异常导致白屏。
- `ErrorMessage` 展示友好错误、错误编号和原始错误详情。
- 上传、检索、问答均展示局部错误，不影响整页使用。

## 上传交互

当前前端支持：

- 点击选择文件。
- 拖拽上传。
- 前端校验文件类型。
- 前端限制 50MB。
- 上传成功后刷新当前知识库文档列表。

## 生产化注意事项

- 当前前端仍使用独立 Vite 开发服务。
- 生产环境建议构建静态资源后通过 Nginx 或对象存储 + CDN 部署。
- 后续可增加前端 Dockerfile、Nginx 配置、运行时配置注入和监控埋点。
