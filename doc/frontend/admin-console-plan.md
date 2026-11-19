# 管理员前端页面规划（G 任务）

| 项 | 内容 |
|---|---|
| 负责人 | G |
| 前置 | `CMS-SRS.md` v2.5（冻结）、`doc/api/api-spec.md` v0.1、`doc/context/architecture.md` |
| 复用基线 | `web/` 已有的博客前台（Vue 3 + Vite + Element Plus + Pinia + Axios） |
| 不做的事 | 文章内容编辑（BR-007）、独立发布动作（BR-010）、编辑端页面（F 任务） |
| 协作方 | F（登录/注册页、会话 store）、后端（接口实现） |

> **本文是规划文档，不是实现文档。** 先把边界、页面清单、交互细节和禁止行为说清楚，写完代码后同步更新进度追踪。

---

## 1 管理员的职责与边界（从 SRS 提炼）

### 1.1 管理员**要做**的事

| 领域 | 具体动作 | 对应 SRS 规则 | 对应接口 |
|---|---|---|---|
| 审核 | 查看待审核队列、审核文章完整内容（只读）、审核通过、驳回（必须填类别+意见） | BR-003/004/007、FR-REVIEW-001~003 | #14 队列、#8 详情、#16 通过、#17 驳回 |
| 下架 | 下架已发布文章（必须填原因） | BR-008、FR-REVIEW-004 | #18 下架 |
| 文章查看 | 查看全部文章（按状态/分类/标签/编辑筛选、标题模糊匹配、分页、计数） | FR-ARTICLE-006、BR-SEARCH-001~003 | #6 列表、#32 计数 |
| 留痕 | 查看任意文章的全部操作留痕 | FR-AUDIT-002、BR-AUDIT-002 | #19 |
| 分类管理 | 创建、修改名称、删除分类 | FR-TAX-001、BR-TAX-003/005 | #20~#23 |
| 标签管理 | 创建、修改名称、删除标签 | FR-TAX-002、BR-TAX-003/005 | #24~#27 |
| 审核标准 | 查看当前审核标准版本和驳回类别字典 | BR-CONTENT-005 | #15 |

### 1.2 管理员**绝对不能做**的事（必须在页面层体现结构约束）

| # | 禁止行为 | SRS 规则 | 页面层怎么防 |
|---|---|---|---|
| ❌1 | 编辑/润色/改写文章任何内容字段 | BR-007 | 审核页、文章详情页的 `views/review/` 下**没有任何可写表单**；正文用 MarkdownView 只读渲染组件，无保存按钮 |
| ❌2 | 手动发布文章（独立发布按钮或接口） | BR-PUB-001、BR-010 | 管理员端**不存在发布按钮**；审核通过时由后端自动决定是立即发布还是进待发布（§4.1） |
| ❌3 | 把已下架文章直接恢复为已发布 | BR-011、BR-010 | 下架后恢复必须由编辑端重新提交审核，管理员端没有"重新上线"接口或按钮 |
| ❌4 | 删除任何文章（包括草稿） | BR-DEL-003 | 管理员端文章列表**没有删除按钮**；删除是编辑专属权限 |
| ❌5 | 通过写请求状态字段改变文章状态 | X-STATE-01 | 整个管理员端不构造任何携带 `status` 字段的请求 |
| ❌6 | 审核页与编辑页共享可写组件 | architecture §3.3 | `views/review/` 与 `views/article/` 是两个独立目录，除了 MarkdownView 这个纯展示组件外**不共享任何可写组件** |
| ❌7 | 通过 URL 拼接绕过前端守卫直接访问管理员专属动作接口 | — | 前端守卫只做体验（不显示按钮）；后端三道闸门统一返回 404，这是后端的事 |

---

## 2 技术栈与复用约束

### 2.1 完全复用已有前端的基础设施

| 层 | 复用的东西 | 位置 | 说明 |
|---|---|---|---|
| 运行时 | Vue 3 Composition API + Vite | `web/package.json` | 不引入新依赖 |
| 组件库 | Element Plus（中文 locale） | `web/src/main.js` | 前台已配置 `zh-cn` |
| HTTP | `http.js` 单例 | `web/src/api/http.js` | **全前端共用，G 不要再建**；已配置同源、会话 Cookie、数组参数序列化 |
| Mock | `web/mock/` + `VITE_USE_MOCK` | `web/vite.config.js` | 管理员接口也走同一套契约 mock，需要 G 追加 mock handlers（§8） |
| CSS 变量 | `base.css` 里的 `--ink`、`--accent`、`--paper` 等 | `web/src/styles/base.css` | 但管理员后台的视觉风格应该和博客前台**明显区分**（见 §3） |
| 路由 | `web/src/router/index.js` 里预留的 `/admin/**` 分区 | 已写注释"AdminLayout（后台，F/G）" | 见 §5 |
| 路由守卫 | 不承担权限职责（architecture §3.3） | — | 只做体验（未登录跳登录、非管理员跳 404） |

### 2.2 需要新建的模块

| 模块 | 路径 | 说明 |
|---|---|---|
| AdminLayout | `web/src/layouts/AdminLayout.vue` | 管理员后台独立布局：侧边栏 + 顶栏（当前用户、登出） |
| auth store | `web/src/stores/auth.js` | **F 先做基础版**，G 追加管理员需要的部分（当前角色、是否管理员） |
| admin API 模块 | `web/src/api/admin.js` | 管理员端所有后端接口的调用封装，按 api-spec 组织 |
| taxonomy 管理 store | 可复用前台的 `taxonomy.js`，或管理员专属的只读+写 store | 创建/修改分类标签需要管理员权限 |
| 管理员 views | `web/src/views/admin/` | 见 §4 |

### 2.3 CSRF 令牌处理

`http.js` 已关闭 axios 默认的 Cookie 读 CSRF。G 需要在登录（F 实现）后处理：
1. 登录成功 → 会话更换 → 重新调用 `GET /api/auth/csrf`（#1）取新令牌
2. 写请求（审核通过、驳回、下架、分类/标签写操作）在请求拦截器里自动注入 `X-XSRF-TOKEN`
3. 收到 `403 CSRF_INVALID` → 重取令牌 → 对**幂等**请求（如分类创建）重试一次
4. **非幂等请求（审核通过、驳回）不能自动重试**，提示用户重新操作

> CSRF 拦截器在 http.js 层面统一做，不分散在各 API 调用里。但 F 要先写好拦截器骨架，G 接入时只需调用 `http.post`。

---

## 3 视觉风格

博客前台是**温暖的米色纸质风**（`--paper: #faf8f4`、`--accent: #c2410c`、衬线字体标题）。管理员后台应该有**明显区分**——更冷峻、更专业的深色侧边栏 + 浅色工作区，避免管理员在后台操作时混淆于前台。

| 元素 | 博客前台 | 管理员后台 |
|---|---|---|
| 主色调 | 温暖橙 `#c2410c` | 冷钢蓝 `#1e40af` 或 slate `#1e293b` |
| 背景 | 米白 `#faf8f4` | 侧边栏深色 `#1f2937`、工作区浅灰 `#f3f4f6` |
| 字体 | 衬线标题 + 无衬线正文 | 统一无衬线 |
| 布局 | 顶栏导航 + 页脚 | 左侧固定侧边栏 + 右侧内容区 |
| Element Plus 主题 | 通过 `--el-color-primary: #c2410c` 覆盖 | 通过 `--el-color-primary: #1e40af` 覆盖 |

实现方式：在 AdminLayout 的 scoped style 里用 CSS 变量覆盖 Element Plus 的主题变量（`--el-color-primary` 等），不修改全局 `base.css`。

---

## 4 页面清单与规划

### 4.1 路由结构（追加到现有 router/index.js）

```
/admin                              → AdminLayout 重定向到 /admin/reviews
/admin/reviews                      → 审核队列（默认页）
/admin/reviews/:id                  → 审核详情（只读内容 + 通过/驳回动作）
/admin/articles                     → 全量文章列表（管理员视角）
/admin/articles/:id                 → 文章详情（管理员视角，只读 + 下架动作）
/admin/articles/:id/audit-logs      → 留痕时间线
/admin/categories                   → 分类管理（Table + Drawer 编辑）
/admin/tags                         → 标签管理
/admin                              → 侧边栏可折叠；顶栏显示当前用户、登出
```

**权限守卫**（只做体验）：
- `admin` 路由组前置守卫：`authStore.role === 'ADMIN'`，否则跳 `/login` 或前台 404
- 非管理员角色（EDITOR）访问 `/admin/**` → 跳 `/admin` 也会因 `role !== 'ADMIN'` 被拦截

### 4.2 页面 1：AdminLayout（侧边栏骨架）

**什么**：侧边栏 + 顶栏的后台骨架。所有 `/admin/**` 路由的父布局。

**侧边栏菜单**：
| 菜单项 | 图标（el-icon） | 路由 | 说明 |
|---|---|---|---|
| 待审核 | DocumentChecked | `/admin/reviews` | 默认进入，带角标（待审核数量） |
| 全部文章 | Reading | `/admin/articles` | 所有状态 |
| 分类管理 | Menu | `/admin/categories` | |
| 标签管理 | PriceTag | `/admin/tags` | |

**顶栏**：左侧面包屑、右侧当前登录用户名 + 下拉（登出）。

**状态角标**：侧边栏「待审核」菜单项右下角显示 `reviews/queue` 返回的 `total` 数。列表页标题栏也显示各状态计数（来自 `GET /api/articles/counts`）。

### 4.3 页面 2：审核队列 `/admin/reviews`

**核心接口**：
- `GET /api/reviews/queue` (#14)：分页列表，固定按 `submitted_at` 升序
- `GET /api/articles/counts` (#32)：各状态角标（可选，辅助定位；审核队列本身只含待审核）
- `GET /api/reviews/standard` (#15)：审核标准版本 + 驳回类别字典（辅助；审核详情页才真正用）

**页面元素**：
| 区域 | 内容 |
|---|---|
| 筛选栏 | 分类下拉、标签多选、编辑下拉、标题模糊匹配 |
| 列表（Element Plus Table） | 列：提交时间、文章标题、归属编辑、分类、标签、预定发布时间（空则不显示）、操作列 |
| 操作列 | 只有一个按钮 → 「审核」，跳详情 |
| 分页 | Table 内建分页，默认 page_size=20 |

**关键交互**：
- 表格行点击也能跳详情
- 按 `submitted_at` 升序不可改，服务端固定排序

### 4.4 页面 3：审核详情 `/admin/reviews/:id`

**这是管理员端最核心的页面。**

**核心接口**：
- `GET /api/articles/{id}` (#8)：详情，管理员查看待审核文章时返回 `current_submission_id`
- `POST /api/articles/{id}/approve` (#16)：审核通过，请求体只有 `submission_id`
- `POST /api/articles/{id}/reject` (#17)：驳回，请求体有 `submission_id` + `reject_category` + `comment`
- `GET /api/reviews/standard` (#15)：驳回类别枚举

**页面布局（两栏或多 Tab）**：
- **左栏（或上半）**：文章完整详情（**只读**）
  - 标题、摘要、分类、标签、封面图预览、预定发布时间（如有）
  - Markdown 正文渲染（复用前台的 MarkdownView 组件，**只读模式**，无编辑控件）
  - 正文内的 `/api/media/{id}` 图片引用正常显示；视频链接（`.mp4/.webm/.ogg` 扩展名的 https URL）渲染 `<video controls>`
  - 文章音频（如有）原生 `<audio controls>`
  - 提交时间、归属编辑名
- **右栏（或下半）**：审核动作区
  - 驳回类别（el-select，8 类，来自 #15）
  - 驳回意见（el-input type="textarea"，必填，BR-AUDIT-003）
  - 审核通过按钮、驳回按钮
  - 留痕时间线（折叠在下方，或切 Tab 查看）

**审核通过的关键逻辑（§4.1 api-spec）**：
| 文章预定发布时间 | 审核通过后的行为 | 管理员页面怎么展示 |
|---|---|---|
| 未设置，或已到达/已过 | 立即发布（#16 返回状态=PUBLISHED，有 `published_at`） | 操作后提示"已发布"；列表不再显示（因为待审核队列只含 PENDING_REVIEW） |
| 设置了未来时间 | 进入待发布（#16 返回状态=SCHEDULED，无 `published_at`） | 操作后提示"已审核通过，将于 XX 自动发布" |

**必须注意**：审核通过接口**只接受 `submission_id` 一个字段**。请求体里出现任何其他字段（包括 `publish: true`、`status`、`title`、`content`）都会返回 `400 FIELD_NOT_WRITABLE`。这是后端结构性防越权的设计，前端不要构造多余字段。

**submission_id 的处理**：
- 从详情接口 (#8) 返回的 `current_submission_id` 字段取
- 如果详情返回 `null`（不是待审核状态），审核动作按钮禁用
- 旧页面打开新轮次审核会因 `submission_id` 不匹配返回 `409 SUBMISSION_STALE`，前端收到后提示"该文章已重新提交，请刷新页面"并重新拉详情

**驳回的关键逻辑**：
- `reject_category` 必须从 8 类枚举里选（来自 #15），服务端校验
- `comment` 不能为空/纯空格（400 REASON_REQUIRED）
- 质量/定位问题不能标为违法违规（这是审核员的业务约束，前端不强校验，留给服务端和审核员自觉）

**状态竞争处理**：
- 审核通过/驳回请求发出后，后端可能返回 409（文章已被撤回/系统已发布/状态已变）
- 收到 409 → 提示"文章状态已变化" → 重新拉详情

### 4.5 页面 4：全量文章列表 `/admin/articles`

**核心接口**：
- `GET /api/articles` (#6)：管理员可看全部
- `GET /api/articles/counts` (#32)：状态计数角标
- `GET /api/auth/me` (#5)：当前用户（auth store 提供）

**页面元素**：
| 区域 | 内容 |
|---|---|
| 状态 Tab 栏 | 6 个状态 Tab，每个带计数（来自 #32）：草稿、待审核、驳回、待发布、已发布、已下架 |
| 筛选栏 | 分类下拉、标签多选、编辑下拉、标题模糊匹配 |
| 列表（Element Plus Table） | 列：状态、标题、归属编辑、分类、标签、预定发布时间（空则不显示）、实际发布时间（已发布/已下架）、最近事件（驳回/下架横幅）、操作列 |
| 操作列 | 按当前状态显示可用动作（`allowed_actions` 字段）：<br>→ 已发布 → 「下架」按钮<br>→ 其他状态 → 「查看详情」按钮 |
| 分页 | Table 内建 |

**最近事件横幅**（api-spec §4.11）：
- 状态是 `REJECTED` → 红色横幅：「驳回」+ 类别 + 意见 + 操作人 + 时间
- 状态是 `UNPUBLISHED` → 橙色横幅：「已下架」+ 原因 + 操作人 + 时间
- 其他状态 → 不显示横幅（历史驳回/下架只在"最近事件"列以次要信息展示，不打扰当前状态视图）

### 4.6 页面 5：文章详情 `/admin/articles/:id`（管理员视角）

**核心接口**：
- `GET /api/articles/{id}` (#8)
- 下架：`POST /api/articles/{id}/unpublish` (#18)

**与审核详情的区别**：
| 维度 | 审核详情 | 管理员文章详情 |
|---|---|---|
| 文章必须是什么状态 | PENDING_REVIEW | 全部（管理员可看任意状态） |
| 可用动作 | 通过/驳回 | 只有「下架」（且仅当当前状态是 PUBLISHED 时） |
| submission_id | 需要 | 不需要（下架不需要轮次校验） |
| current_submission_id | 有（审核用） | 可能为 null（非待审核状态） |
| 备注 | 主要动作入口 | 管理员查看文章完整信息的通用视图 |

**下架对话框**：
- el-dialog，标题「下架文章」
- 下架原因输入框（textarea，必填，非空/非纯空格）
- 下架后文章状态变为 `UNPUBLISHED`，公开接口立即不再返回，媒体出口立即 404

**注意**：管理员文章详情页**不应该**有任何审核通过/驳回的按钮——这些属于审核详情页面的范围。管理员从"全部文章"列表进来看的可能是已发布文章，下架是唯一动作。审核动作只从审核队列入口进。

### 4.7 页面 6：留痕时间线 `/admin/articles/:id/audit-logs`

**入口**：文章详情页底部或 Tab 切换到「留痕」。也可以独立路由。

**核心接口**：
- `GET /api/articles/{id}/audit-logs` (#19)

**展示方式**：Element Plus Timeline 组件，按 `operated_at` 正序排列。每条留痕：
- 操作类型（审核通过/驳回/下架/提交/撤回/改期/到期自动发布）
- 操作人（用户则显示用户名；系统则显示「系统」）
- 操作时间（`+08:00` 字面值原样显示）
- 驳回/下架留痕额外显示：驳回类别/下架原因 + 审核标准版本
- 改期留痕额外显示：`从 X 改到 Y`
- 到期自动发布额外显示：关联的审核通过留痕 ID（技术追溯信息，可折叠显示）

### 4.8 页面 7：分类管理 `/admin/categories`

**核心接口**：
- `GET /api/categories` (#20)：全量列表（不分页）
- `POST /api/categories` (#21)：创建
- `PUT /api/categories/{id}` (#22)：改名
- `DELETE /api/categories/{id}` (#23)：删除

**页面元素**：
- Table 列出所有分类：名称、`in_use`（被引用时不能改名/删除，409 TAXONOMY_IN_USE）、创建时间、更新时间
- 创建按钮 → Drawer/Dialog 输入名称
- 行内「改名」按钮 → Popconfirm → el-input inline 或 Drawer
- 行内「删除」按钮 → Popconfirm（若 `in_use=true` 则按钮禁用并 tooltip 提示）

**关键约束**：
- 名称去首尾空白后 1~50 字符，不允许全空白
- 同类内不区分大小写去重，重名 409 NAME_DUPLICATE（§16 问题 2 暂定）
- 被引用时（任意状态文章引用）不能改名也不能删除

### 4.9 页面 8：标签管理 `/admin/tags`

**核心接口**：
- `GET /api/tags` (#24)：分页，支持 keyword 模糊搜索
- `POST /api/tags` (#25)
- `PUT /api/tags/{id}` (#26)
- `DELETE /api/tags/{id}` (#27)

**与分类管理的区别**：
| 维度 | 分类 | 标签 |
|---|---|---|
| 访问者 | 仅管理员 | 编辑+管理员（但 G 的管理员页面当然也能管理） |
| 列表 | 不分页，全量 | 分页 + keyword 搜索 |
| 创建者 | 仅管理员 | 全员，但 G 做管理员视角，不关心编辑创建 |
| 扁平/层级 | 扁平 | 扁平 |

**页面元素**：
- 搜索栏：keyword 输入框（模糊匹配名称）
- Table：名称、`in_use`、创建/更新时间
- 其余同分类管理的 CRUD 交互

---

## 5 状态标签颜色约定

6 个文章状态在列表和详情页需要视觉区分。Element Plus Tag 映射：

| 状态 | API 值 | 中文 | Tag 类型 | 颜色 |
|---|---|---|---|---|
| 草稿 | DRAFT | 草稿 | info | `#909399`（灰色） |
| 待审核 | PENDING_REVIEW | 待审核 | warning | `#e6a23c`（橙色） |
| 驳回 | REJECTED | 驳回 | danger | `#f56c6c`（红色） |
| 待发布 | SCHEDULED | 待发布 | primary | 管理员后台主色（冷钢蓝 `#1e40af`） |
| 已发布 | PUBLISHED | 已发布 | success | `#67c23a`（绿色） |
| 已下架 | UNPUBLISHED | 已下架 | danger 变体 | `#c0392b`（深红，比驳回更深） |

这个映射可以做成 `utils/status.js` 里的常量映射表，被列表、详情、审核详情多处复用。

---

## 6 错误处理策略

| 场景 | HTTP 状态码 + 错误码 | 前端行为 |
|---|---|---|
| 未登录访问 /admin/** | 后端返回 401 | 路由守卫跳 `/login`（F 实现） |
| 编辑角色访问管理员专属接口（审核、下架、分类写） | 后端返回 **404**（统一响应体） | 守卫已拦截；若守卫漏了，页面显示统一 404 而不是 403 |
| 审核通过/驳回/下架时状态已变 | 409 STATE_CONFLICT 或 SUBMISSION_STALE | 提示"文章状态已变化，请刷新" → 重新拉详情 |
| 下架/驳回原因空/纯空格 | 400 REASON_REQUIRED | 前端表单校验挡住（提交前 trim 检查） |
| 分类/标签被引用时改名/删除 | 409 TAXONOMY_IN_USE | 表单/按钮已禁用；若绕过前端直接调接口也会被挡住，错误提示「该资源被文章引用」 |
| 分类/标签重名 | 409 NAME_DUPLICATE | 提示「名称已存在」 |
| CSRF 令牌过期 | 403 CSRF_INVALID | 拦截器重取令牌 + 对幂等请求重试一次；非幂等请求提示重新操作 |
| 网络错误/服务端异常 | 0 或 500 | 全局统一 toast：「网络请求失败，请稍后重试」 |

> **不要为了"让用户体验更好"而吞掉后端的 404**。后端返回 404 就是在说"你没权限"或"资源不存在"，前端应该老老实实按这个响应走，不要自作主张把它显示成"该文章不是待审核状态"。

---

## 7 API 调用封装规划（`web/src/api/admin.js`）

按 api-spec 的接口分组组织：

```
admin.js 模块导出：

// 审核（REVIEW）
export function getReviewQueue({ page, page_size, category_id, tag_ids, author_id, title }) → GET /api/reviews/queue
export function getReviewStandard() → GET /api/reviews/standard
export function approveArticle(id, { submission_id }) → POST /api/articles/{id}/approve
export function rejectArticle(id, { submission_id, reject_category, comment }) → POST /api/articles/{id}/reject
export function unpublishArticle(id, { reason }) → POST /api/articles/{id}/unpublish

// 文章（管理员视角）
export function listAllArticles({ page, page_size, status, category_id, tag_ids, author_id, title, sort }) → GET /api/articles
export function getArticleDetail(id) → GET /api/articles/{id}
export function getArticleCounts({ category_id, tag_ids, author_id, title }) → GET /api/articles/counts
export function getArticleAuditLogs(id) → GET /api/articles/{id}/audit-logs

// 分类（管理员专属写）
export function listCategories() → GET /api/categories
export function createCategory({ name }) → POST /api/categories
export function renameCategory(id, { name }) → PUT /api/categories/{id}
export function deleteCategory(id) → DELETE /api/categories/{id}

// 标签（管理员可写）
export function listTags({ keyword, page, page_size }) → GET /api/tags
export function createTag({ name }) → POST /api/tags
export function renameTag(id, { name }) → PUT /api/tags/{id}
export function deleteTag(id) → DELETE /api/tags/{id}
```

**字段投影原则**：响应体字段按接口文档定义的完整字段使用。管理员端需要的字段比公开端多（比如 `current_submission_id`、`latest_event`、`allowed_actions`），不要像公开端那样做 pickListItem 裁剪。

**ID 传字符串**：与 `public.js` 保持一致，64 位整数用字符串传递避免 JS 精度丢失。

---

## 8 Mock 契约扩展

`web/mock/handlers.js` 已有公开接口 mock。G 需要追加以下管理员接口的 mock handlers（所有需要认证的接口 mock 里**跳过真实认证检查**，因为 mock 只在开发/预览环境启用）：

| 接口 | Mock 行为 |
|---|---|
| `GET /api/reviews/queue` | 返回分页的 PENDING_REVIEW 文章，按 submitted_at 升序，包含 `current_submission_id` |
| `GET /api/reviews/standard` | 返回驳回类别字典 + 标准版本号 |
| `POST /api/articles/{id}/approve` | 根据预定时间字段返回 PUBLISHED 或 SCHEDULED |
| `POST /api/articles/{id}/reject` | 状态变 REJECTED，写留痕 |
| `POST /api/articles/{id}/unpublish` | 状态变 UNPUBLISHED |
| `GET /api/articles?author_id=xxx`（管理员不传 author_id） | 返回全部文章（所有状态），带筛选 |
| `GET /api/articles/counts` | 返回 6 状态计数 |
| `GET /api/articles/{id}/audit-logs` | 返回按时间正序的留痕列表（7 类全覆盖） |
| `GET /api/categories` / POST / PUT / DELETE | 完整 CRUD mock，带 in_use 保护 |
| `GET /api/tags` / POST / PUT / DELETE | 完整 CRUD mock，带 in_use 保护 |

**Mock 里要模拟的错误路径**（因为前端要处理）：
- 审核通过/驳回返回 409 SUBMISSION_STALE（mock 检查 submission_id 是否匹配当轮）
- 分类/标签删除返回 409 TAXONOMY_IN_USE（mock 检查 in_use）
- 驳回/下架返回 400 REASON_REQUIRED（mock 检查 reason 非空/非纯空格）
- 对非管理员角色返回 404（mock 里可以按 query param ?as=editor 模拟）

---

## 9 与其他协作方的衔接

### 9.1 与 F（编辑端）的边界

| 事项 | 负责人 | G 要做什么 |
|---|---|---|
| 登录/注册页面 | F | G 不需要，但可以测试登录后是否正确跳到 `/admin` |
| auth store（`stores/auth.js`） | F 先做基础版 | G 追加：`isAdmin` computed（`role === 'ADMIN'`）、CSRF 令牌存取 |
| 会话/CSRF 拦截器 | F | G 不需要写拦截器，但要确保自己的写请求能触发它 |
| Markdown 编辑页 | F（编辑端） | **G 绝不引用**，只引用 MarkdownView（只读预览） |
| 审核页的正文控件 | G | 用前台已有的 MarkdownView，确保**没有编辑功能** |

### 9.2 与后端的边界

| 事项 | 说明 |
|---|---|
| 接口存在性 | 管理员用到的接口见本文 §12，全部以 api-spec 为准，前端不自造路径和字段 |
| 数据校验 | 前端做表单校验（非空、长度），但**后端会二次校验**，前端校验只是为了用户体验，不能代替服务端 |
| 状态迁移 | 前端不直接写 `status`，全部通过动作接口（approve/reject/unpublish/withdraw/reschedule/submit/delete） |
| 归属隔离 | 后端 MyBatis-Plus 拦截器强制执行，前端不用管（管理员看全部，编辑看自己） |
| 媒体判权 | 后端媒体出口按文章状态判权，前端正常渲染图片 URL 即可 |

### 9.3 测试策略

| 层级 | 覆盖范围 | 工具 |
|---|---|---|
| 组件/工具函数 | 状态映射、错误处理、CSRF 拦截器 | Vitest（已有） |
| 页面行为 | 审核详情的通过/驳回交互、下架弹窗、分类 CRUD 禁用逻辑 | Vitest + jsdom（已有） |
| 契约 mock | handlers 的错误路径（404/409/400 响应） | Vitest（已有 handlers.test.js） |
| 手工联调 | 登录后管理员角色正确识别、审核通过立即发布 vs 进待发布、下架后前台不可见 | 手动 + 后端真实接口 |

---

## 10 实现建议的顺序

1. **基础设施**：AdminLayout 骨架 + 侧边栏菜单 + auth store 接入（依赖 F 的基础版）+ 路由注册 + 状态映射工具
2. **API 模块**：`admin.js` 写好所有接口调用 + mock handlers 补齐
3. **分类/标签管理**（相对独立，CRUD 逻辑清晰）
4. **审核队列 + 审核详情**（核心页面）
5. **全量文章列表 + 管理员详情 + 留痕**
6. **下架功能**（管理员详情页内）
7. **错误处理打磨、空状态、loading 态**

---

## 11 不要做的事（重申）

| # | 不要做 | 为什么 |
|---|---|---|
| 1 | 在审核页或管理员详情页放任何可编辑的表单组件 | BR-007：管理员不能改内容，审核页根本没有正文编辑控件 |
| 2 | 写一个独立的「发布」按钮或接口调用 | BR-010、BR-PUB-001：发布只有审核通过时自动决定（立即发布 or 进待发布）和到期自动发布两条路径 |
| 3 | 允许管理员删除文章 | BR-DEL-003：删除是编辑专属权限 |
| 4 | 让下架文章直接恢复上线的路径 | BR-011：下架后必须重新过审 |
| 5 | 直接向服务器发带 `status` 字段的请求 | X-STATE-01：状态只能走状态机迁移接口 |
| 6 | 绕过后端三道闸门的判断直接在前端显示按钮 | architecture §3.3：前端守卫只做体验，不承担权限职责 |
| 7 | 为 CSRF 令牌建立独立的 cookie 持久化机制 | api-spec §2.2：令牌只存内存（Pinia store），不写 localStorage 或 cookie |
| 8 | 为管理员页面建一个新的 axios 实例 | 全前端共用 http.js，不要各自再建 |
| 9 | 在 mock 里跳过管理员/编辑的角色区分检查 | Mock 里要能模拟两种角色的响应差异，否则前端联调时发现不了问题 |
| 10 | 忘了给审核通过/驳回传 `submission_id` | api-spec 强制要求，缺了返回 400；且轮次不匹配返回 409 |

---

## 12 附录：接口出处

管理员端用到的接口不在本文另列清单，以 `doc/api/api-spec.md` 为准：§6.1、§6.3、§6.9（文章列表、详情、计数），§7.1～§7.5（审核队列、审核标准、通过、驳回、下架），§8.1（留痕），§9.1～§9.8（分类与标签），以及 §5.5（当前用户）。字段结构见 §4.10～§4.13，错误码见 §3.3。
