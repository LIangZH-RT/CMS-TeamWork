# 管理员前端实现文档（G 任务）

> 分支 `admin-page`，提交记录见 §1。规划与需求来源：`doc/frontend/admin-console-plan.md`。

---

## 1 提交记录

| # | commit | 说明 |
|---|---|---|
| 1 | `7ac74e0` | 基础设施：AdminLayout / 路由 / 状态映射 / auth store mock |
| 2 | `71d45a1` | API 模块 `admin.js` + mock handlers 全量接入 |
| 3 | `334ac9b` | 分类管理页面（CRUD + 引用/冲突校验） |
| 4 | `580f04d` | 标签管理页面（搜索/分页/CRUD） |
| 5 | `f49cee8` | 审核队列 + 审核详情（通过/驳回 + 状态闸） |
| 6 | `981a8ac` | 全量文章列表/详情/下架 + 留痕时间线 |

---

## 2 技术决策

| 决策 | 理由 |
|---|---|
| 管理员后台独立布局 `AdminLayout`，与 `PublicLayout` 解耦 | 视觉风格不同（深色侧边栏 vs 米色纸质风），职责不同（管理 vs 浏览） |
| 状态用 `status.js` 集中映射 | 6 状态 × 3 种映射（label / Tag type / const），多处复用 |
| mock handlers 独立为 `admin_handlers.js` | 与公开接口 mock（`handlers.js`）解耦，admin 返回完整字段，公开只返回白名单 |
| 路由守卫只做体验层（跳 404） | 真正权限在后端；前端路由守卫不承担安全职责（architecture §3.3） |
| 下架用 `ElMessageBox.prompt` 强制输入原因 | api-spec #18 要求 reason 必填，prompt 比 dialog 更轻量 |
| 审核通过只有一个按钮 | api-spec #16 不弹确认——通过是单动作，且需要 submission_id 从详情拿到 |
| 审核驳回弹 dialog | api-spec #17 需要 reject_category（下拉）+ comment（可选） |
| 留痕用自定义 CSS timeline | Element Plus Timeline 组件的交替布局对窄屏不友好，自定义更可控 |

---

## 3 复用关系

| 已有组件/模块 | 复用方式 | 约束 |
|---|---|---|
| `http.js` | admin.js 全部调用它 | 不要新建 axios 实例 |
| `MarkdownView.vue` | 审核详情 + 文章详情正文 | 只读模式，符合 INV-03 |
| `format.js::fmtDateTime` | 所有时间戳展示 | ISO 8601 + 时区偏移输入 |
| `stores/auth.js` | 扩展为临时 mock（admin 视角） | F 接手后替换 `fetchMe()` / `fetchCsrf()` 真实实现 |
| `handlers.js`（公开接口 mock） | 不修改，admin mock 独立 | `plugin.js` 先试 admin → fallback 公开 |
| Element Plus | 全局已引入 | 覆盖 primary 色为冷钢蓝 `#1e40af` |

---

## 4 后端对接清单

以下是 **admin.js 调用的全部 18 个接口**，按模块分组，列出前端期望的请求体、响应体和错误码。后端实现时请严格对照 `api-spec.md`。

### 4.1 审核 REVIEW

**GET `/api/reviews/queue`（#14）**
- 前端请求参数：`page`, `page_size`, `category_id`(可选), `author_id`(可选), `title`(可选)
- 期望响应：`{ items: AdminArticleSummary[], page, page_size, total }`
- 排序：`submitted_at` 升序
- AdminArticleSummary 字段：id, title, excerpt, category{id,name}, tags[{id,name}], author{id,username}, status, submission_round, submitted_at, created_at, updated_at, cover_url
- 状态筛选：**只返回 PENDING_REVIEW**

**GET `/api/reviews/standard`（#15）**
- 无参数
- 期望响应：`{ version, updated_at, categories: [{ code, name }] }`

**POST `/api/articles/{id}/approve`（#16）**
- 请求体：`{ submission_id: number }`
- 成功响应：`{ id, status: 'PUBLISHED' }`
- 409 状态闸：`{ code: 40901, message: "状态为 xxx，无法进行审核操作" }`（当前状态不是 PENDING_REVIEW）
- 400：submission_id 缺失 → `{ code: 40000, message: '参数校验失败', data: { field_errors: [{ field: 'submission_id', reason: '必填' }] } }`

**POST `/api/articles/{id}/reject`（#17）**
- 请求体：`{ submission_id: number, reject_category: string, comment?: string }`
- 成功响应：`{ id, status: 'REJECTED' }`
- 409 状态闸同上

**POST `/api/articles/{id}/unpublish`（#18）**
- 请求体：`{ reason: string }`（**必填**，trim 后非空）
- 成功响应：`{ id, status: 'UNPUBLISHED' }`
- 409 状态闸：当前状态不是 PUBLISHED

### 4.2 文章 ARTICLE

**GET `/api/articles`（#6，管理员视角）**
- 请求参数：`page`, `page_size`, `status`(可选枚举), `category_id`(可选), `author_id`(可选), `title`(可选), `tag_ids[]`(可选)
- 期望响应：`{ items: AdminArticleSummary[], page, page_size, total }`
- 管理员不传 author_id → **全量文章**（不做归属隔离）
- 排序：`updated_at` 降序（api-spec #16-8 已定）

**GET `/api/articles/counts`（#32）**
- 请求参数：`category_id`(可选), `author_id`(可选), `title`(可选), `tag_ids[]`(可选)
- 期望响应：`{ DRAFT: number, PENDING_REVIEW: number, REJECTED: number, SCHEDULED: number, PUBLISHED: number, UNPUBLISHED: number }`
- 过滤条件与列表接口一致

**GET `/api/articles/{id}`（#8，管理员视角）**
- 期望响应：完整文章对象
- 额外字段（相比列表）：`content`, `published_at`（PUBLISHED 时才返回时间，其他状态 null）
- PENDING_REVIEW 时多返回 `current_submission_id`
- reject_reason（REJECTED 时）/ unpublish_reason（UNPUBLISHED 时）
- **不存在或已被归属隔离 → 404**（INV-09）

**GET `/api/articles/{id}/audit-logs`（#19）**
- 期望响应：`Array<AuditLog>`
- AuditLog 字段：id, article_id, operator_id, operator_role, action, detail, operated_at
- 排序：`operated_at` **升序**（api-spec §4.21）

### 4.3 分类 TAX

**GET `/api/categories`（#20）**
- 无参数
- 期望响应：`Array<{ id, name, in_use: boolean }>`
- in_use = 是否被任何文章引用

**POST `/api/categories`（#21）**
- 请求体：`{ name: string }`
- 400：name 空或 trim 后空
- 409 `{ code: 40902 }`：同类内不区分大小写重名
- 成功：`{ id, name }`

**PUT `/api/categories/{id}`（#22）**
- 请求体：`{ name: string }`
- 404 不存在
- 409 重名（同上）
- 不检查 in_use（api-spec #16-3 已定）

**DELETE `/api/categories/{id}`（#23）**
- 409 `{ code: 40903, message: '分类下还有文章，无法删除', data: { used_count } }`（被文章引用）
- 成功：`{}`

### 4.4 标签 TAG

**GET `/api/tags`（#24）**
- 请求参数：`keyword`(可选), `page`, `page_size`
- 期望响应：`{ items: [{ id, name, in_use }], page, page_size, total }`

**POST `/api/tags`（#25）**
- 请求体：`{ name: string }`
- 同分类重名规则（40902）

**PUT `/api/tags/{id}`（#26）**
- 同分类改名规则

**DELETE `/api/tags/{id}`（#27）**
- 同分类删除规则（被引用 40903）

---

## 5 后端必须保证的不变量（结构级）

| # | 不变量 | 前端依赖 |
|---|---|---|
| INV-09 | 权限闸门拒绝一律 404，响应体逐字节一致 | 前端无法区分「没权限」和「资源不存在」，不显示错误原因 |
| api-spec §3 | CSRF 校验在除 GET/HEAD 外的写请求触发 | 前端 http.js 会自动带 X-XSRF-TOKEN |
| api-spec §4.2 | 时间字段 ISO 8601 + 时区偏移 | fmtDateTime 正确解析 +08:00 |
| api-spec §3.3 | 状态闸失败返回 409 + 40901 | 审核页面会捕获并显示"文章状态已变更" |
| api-spec 字段命名 | snake_case 全部接口一致 | admin.js 不做 camelCase 转换 |
| ID 类型 | 数字字符串（避免 JS int64 精度丢失） | admin.js 用 `encodeURIComponent` 不强制转 Number |

---

## 6 已知限制与后续对接点

| 项 | 当前状态 | 谁接手 | 备注 |
|---|---|---|---|
| **Auth store** | 临时 mock，`user = { id:1, role:'ADMIN' }` 硬编码 | F | `auth.js` 里 TODO 注释已标记 |
| **CSRF** | http.js 假设已有 CSRF 拦截器 | F | GET /api/auth/csrf + X-XSRF-TOKEN header |
| **登录页** | 不存在 | F | 管理员登录成功后 setRole('ADMIN') |
| **文章创建/编辑** | 不在 admin 端（编辑是内容编辑的事） | H | INV-03 管理员不能改内容 |
| **文章搜索（管理员）** | mock 只做 title.includes 简单匹配 | 后端 | api-spec 没定 LIKE 语义，按 §11.1 toLikePattern |
| **分类/标签删除 in_use 检查** | mock 在内存实时计算 | 后端 | 需要关联查询 |
| **审核标准版本管理** | mock 是静态 JSON | 后端 | api-spec #14 说服务端配置项 |
| **乐观锁** | 未实现（api-spec §16-11 未定） | 后端 | 可选 expected_updated_at 方案 |
| **admin_handlers POST body 解析** | mock 已接好 | — | plugin.js 的 readBody() |

---

## 7 本地运行

```powershell
cd web
npm.cmd install
$env:VITE_USE_MOCK="true"
npm.cmd run dev
# 打开 http://localhost:5173/admin/reviews
```

- mock 启用时所有 `/api/**` 请求走 Vite 插件中间件，不打到真实后端
- mock 数据定义在 `web/mock/db.js`（文章、分类、标签、用户、审核标准、留痕）
- 内存 mock：POST/PUT/DELETE 改动只在当前 dev server 生效，重启即丢失
- 真实后端就绪后，移除 `VITE_USE_MOCK` 环境变量即可切换

---

## 8 文件清单

```
web/src/
├── api/admin.js                  # 管理员端 18 个接口函数
├── stores/auth.js                # auth store（临时 mock）
├── utils/status.js               # 6 状态 × 3 种映射（label / TagType / const）
├── layouts/AdminLayout.vue       # 深色侧边栏 + 顶栏骨架
├── views/admin/
│   ├── ReviewQueue.vue           # 审核队列（4 状态统计卡 + 表格）
│   ├── ReviewDetail.vue          # 审核详情（只读正文 + 通过/驳回）
│   ├── ArticleList.vue           # 全量文章（6 状态 Tab + 下架）
│   ├── ArticleDetail.vue         # 管理员视角详情（只读 + 下架）
│   ├── AuditLogs.vue             # 留痕时间线
│   ├── CategoryManage.vue        # 分类 CRUD
│   └── TagManage.vue             # 标签 CRUD + 搜索分页
└── router/index.js               # 追加 /admin 路由组

web/mock/
├── admin_handlers.js             # 管理员端 18 个接口 mock
├── db.js（追加）                  # authors / review_standard / audit_logs / ADMIN_FIELDS
└── plugin.js（修改）              # 先试 admin_handlers → fallback 公开接口
```
