# 管理员前端实现说明（G 任务）

> 接口契约以 `doc/api/api-spec.md` 与 `doc/api/openapi.yaml` 为唯一真源（AGENTS §2）。本文只记录前端实现上的取舍、已知限制和对接点，**不另立接口说明**；字段、错误码、校验顺序一律以 api-spec 对应章节为准。规划过程见 `doc/frontend/admin-console-plan.md`。

---

## 1 页面与接口对照

| 页面 | 路由 | 视图文件（`web/src/views/`） | 角色（`meta.roles`） | 用到的接口（api-spec 章节） |
|---|---|---|---|---|
| 审核队列 | `/admin/reviews` | `review/ReviewQueue.vue` | ADMIN | §7.1 审核队列（队列项见 §4.12）、§6.9 计数 |
| 审核详情 | `/admin/reviews/:id` | `review/ReviewDetail.vue` | ADMIN | §6.3 详情（字段见 §4.10）、§7.2 审核标准、§7.3 通过、§7.4 驳回 |
| 全部文章 | `/admin/articles` | `review/ArticleList.vue` | ADMIN | §6.1 列表（列表项见 §4.11）、§7.5 下架 |
| 文章详情 | `/admin/articles/:id` | `review/ArticleDetail.vue` | ADMIN | §6.3 详情、§7.5 下架 |
| 留痕 | `/admin/articles/:id/audit-logs` | `article/AuditLogs.vue`（只读，两个角色共用） | EDITOR、ADMIN | §8.1 留痕（字段见 §4.13） |
| 分类管理 | `/admin/categories` | `taxonomy/CategoryManage.vue` | ADMIN | §9.1～§9.4 |
| 标签管理 | `/admin/tags` | `taxonomy/TagManage.vue` | EDITOR、ADMIN | §9.5～§9.8 |

错误码按 §3.3 处理：409 区分 `40900`（状态已变）、`40901`（轮次已变）、`40904`（被引用）、`40906`（重名）；404 一律按统一响应处理（§3.2）。

---

## 2 技术决策

| 决策 | 理由 |
|---|---|
| 后台共用布局 `AdminLayout`，与 `PublicLayout` 解耦；编辑和管理员共用，菜单按角色切换（方案 A） | architecture §3.2、SRS FR-AUTH-005 |
| 菜单只由 `utils/menu.js` 生成，按路由 `meta.roles` 过滤，未注册的路由自动隐藏 | 权限只在路由表声明一处，F 的编辑端路由注册后菜单自动出现 |
| 状态、留痕动作、驳回类别的中文映射集中在 `utils/status.js` | 枚举取自 api-spec §4.1，多处复用 |
| mock handlers 独立为 `mock/admin_handlers.js` | 与公开接口 mock（`handlers.js`）解耦；mock 的投影按 §4.10～§4.13 输出 |
| 路由守卫只做体验 | `/admin` 父路由 `meta.requiresAuth`，子路由 `meta.roles`；判定在 `router/guard.js` 的 `resolveBackofficeAccess`：未登录跳 `/login?redirect=`，角色不符或未知角色落统一 404，`/admin` 按角色重定向。真正的权限判定在后端（architecture §3.3） |
| 下架用 `ElMessageBox.prompt` 强制输入原因 | §7.5 要求 `reason` 必填 |
| 审核通过前弹二次确认，驳回弹表单 | 驳回必须选择 §4.1 的 8 个类别之一并填写意见（FR-REVIEW-003、§7.4） |
| 不引入图标库 | `@element-plus/icons-vue` 未在 `package.json` 声明（AGENTS §3），提示图标改用文字符号 |

---

## 3 复用关系

| 已有组件/模块 | 复用方式 | 约束 |
|---|---|---|
| `http.js` | `api/article.js`、`review.js`、`audit.js`、`taxonomy.js`、`auth.js` 全部调用它 | 不要新建 axios 实例；一个业务域一个接口模块 |
| `MarkdownView.vue` | 审核详情、文章详情的正文 | 只读，管理员不能编辑内容（BR-007） |
| `format.js::fmtDateTime` | 所有时间展示 | 按字面值显示 `+08:00`，不做时区换算 |
| `stores/auth.js` | 后台读取当前用户、退出调 `logout()`（#4） | 会话 store 由 F 负责；mock 用户只在 `VITE_USE_MOCK=true` 时生效，角色由临时开关 `VITE_MOCK_ROLE`（默认 ADMIN）决定，F 的 auth mock 合入后删除 |

---

## 4 已知限制与对接点

| 项 | 当前状态 | 谁接手 |
|---|---|---|
| `/admin` 路由分区 | 已定方案 A：编辑和管理员共用 `/admin`，F 的编辑端路由（`my-articles` 等，`meta.roles: ['EDITOR']`）注册在 `router/index.js` 的编辑端块 | F |
| 会话与 `fetchMe()` | 未接 §5.5 `GET /api/auth/me`；非 mock 构建下视为未登录 | F |
| 登录页 `/login` | 未合入，守卫跳过去时落统一 404 | F |
| CSRF | `http.js` 还没有 CSRF 拦截器，接真实后端前所有写操作会 403（§2.2） | F |
| 横幅与封面、音频展示 | 详情已返回 `latest_rejection`、`latest_unpublish`、`cover`、`audio`，页面尚未按 §4.11「前端提示横幅规则」展示 | G |
| 按钮显隐 | 仍按 `status` 判断，后续改用 `allowed_actions`（§4.1） | G |

---

## 5 本地运行

```powershell
cd web
npm.cmd ci
npm.cmd run dev
# 打开 http://localhost:5173/admin
# 以编辑身份验收菜单（临时开关）：$env:VITE_MOCK_ROLE='EDITOR'; npm.cmd run dev
```

- `.env.development` 默认 `VITE_USE_MOCK=true`，`/api/**` 由契约 mock 中间件应答
- 内存 mock：写操作只在当前 dev server 生命周期内有效，重启即恢复
- `npm run preview:mock` 可用契约 mock 自验构建产物
