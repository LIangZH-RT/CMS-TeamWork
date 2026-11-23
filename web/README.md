# web — CMS-TeamWork 前端

Vue 3 + Vite、Element Plus、Pinia、Vue Router、Axios、md-editor-v3。
目录见 `doc/context/architecture.md` §3.2。接口形状以 `doc/api/api-spec.md`（对应 SRS v2.6）为准。

## 运行

需要 Node.js 20.19+ 或 22.12+。

```bash
cd web
npm install
npm run dev            # http://localhost:5173 ，默认契约 mock
npm run lint
npm run build          # 产物在 web/dist/，不要提交
npm run preview:mock   # 用契约 mock 预览构建产物，http://localhost:4173
```

## 契约 mock 与真实后端

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_USE_MOCK` | 开发时 `true`（`.env.development`） | `true`：`/api/**` 由 `mock/` 应答；`false`：代理到真实后端 |
| `VITE_API_TARGET` | `http://localhost:8080` | 关闭 mock 时 `/api` 的代理目标 |

切到真实后端：复制 `.env.example` 为 `.env.development.local`（不入库），设置 `VITE_USE_MOCK=false` 后重启。浏览器只请求同源 `/api/**`，携带 `JSESSIONID`，写请求（登录除外）带 `X-XSRF-TOKEN`。令牌只从 `GET /api/auth/csrf` 的响应体读取，不读 Cookie。

mock 演示账号（仅本地模拟，明文密码不会进入真实后端）：

| 登录名 | 密码 | 角色 |
|---|---|---|
| `admin` | `Admin@12345` | 管理员 |
| `zhangsan` / `lisi` / `wangwu` / `zhaoliu` / `sunqi` | `Editor@12345` | 内容编辑（名下有文章） |
| `chenba` | `Editor@12345` | 内容编辑（名下无文章，可被提升） |

## 页面

| 路由 | 谁能进 | 说明 |
|---|---|---|
| `/`、`/category/:id`、`/search`、`/posts/:id` | 匿名 | 博客前台。分类来自公开列表 facets（扁平）。列表可按发布时间升序 / 降序 |
| `/login`、`/register` | 匿名 | 登录、注册内容编辑。注册不自动登录 |
| `/admin/my-articles` 及新建、详情、编辑 | 内容编辑 | 草稿、提交、撤回、改期、逻辑删除、批量删除（最多 50，逐条结果） |
| `/admin/reviews` | 管理员 | 审核队列、批量通过 |
| `/admin/articles` | 管理员 | 全部文章、下架、批量下架 |
| `/admin/categories` | 管理员 | 两级分类、排序、启停、逻辑删除 |
| `/admin/tags` | 编辑、管理员 | 标签 |
| `/admin/users` | 管理员 | 用户列表、启停、分配角色 |
| `/admin/roles` | 管理员 | 2 个角色与 27 个权限点，只读 |
| `/admin/operation-logs` | 管理员 | 系统操作日志 |
| `/admin/profile` | 已登录 | 当前账号与权限点，只读 |
| 其他 | | 统一 404，不提示「无权限」 |

菜单、路由和 `v-permission` 按 `GET /api/auth/me` 的 `permissions` 显示。守卫只做体验，授权仍由服务端判定。编辑文章若返回 `409 40907`，会提示刷新后重做，不会覆盖对方的保存。

## 接口覆盖（前端会调用的 SRS 编号）

| 编号 | 方法与路径 |
|---|---|
| 1–5 | `/api/auth/csrf`、`register`、`login`、`logout`、`me` |
| 6–13 | `/api/articles` 列表、创建、详情、编辑、删除、提交、撤回、改期 |
| 14–18 | 审核队列、审核标准、通过、驳回、下架 |
| 19 | `/api/articles/{id}/audit-logs` |
| 20–27 | 分类与标签的查询和增删改 |
| 28–29、43 | 上传媒体、在线读取、下载 |
| 30–31 | 公开文章列表与详情 |
| 32 | `/api/articles/counts` |
| 33–37 | 用户列表、启停、分配角色、角色、权限点 |
| 38–39 | 分类启停、同级排序 |
| 40–42 | 批量通过、批量下架、批量删除草稿 |
| 44 | `/api/admin/operation-logs` |

不提供评论、密码找回、改派作者、修改角色权限、删除账号、已删除数据恢复。这些在 SRS 里明确不做。
