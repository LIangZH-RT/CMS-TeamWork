# CMS-TeamWork 前后端统一接口规范（草案 v0.1）

| 项 | 内容 |
|---|---|
| 依据 | `CMS-SRS.md` v2.5（需求基线冻结版，唯一需求真源）；`doc/context/architecture.md`（内部架构基线，路径与认证约定） |
| 编制基线 | SRS v2.5 冻结版 |
| 配套文件 | `doc/api/openapi.yaml`（OpenAPI 3.0.3，与本文一致；冲突时以本文为准） |
| 文档性质 | 供评审的接口设计草案（待团队确认后定版） |
| 编制日期 | 2026-11-15 |

> 阅读约定：
> - 每个接口标注「覆盖需求」，对应 SRS 的 `FR-*`、`BR-*`、`X-*`、`TU-*` 编号。
> - 标记 **【补充】** 的内容是 SRS 没有明确要求、但实现必须要有的通用基础设施（如 CSRF 令牌下发、当前用户、字典），或者是 SRS 留给「接口设计」阶段决定的取值（如字段命名、分页参数、错误码）。凡标 【补充】 的都可以改。
> - 与 SRS 冲突时，一律以 SRS 为准；与 `architecture.md` 冲突时，以 SRS 为准，并在第 15 章列出。

---

## 目录

1. 总体约定
2. 认证、会话与 CSRF
3. 权限判定与错误响应
4. 枚举与数据模型
5. 认证与账号模块（AUTH / USER）
6. 文章模块（ARTICLE / SUBMIT）
7. 审核模块（REVIEW / PUBLISH）
8. 留痕模块（AUDIT）
9. 分类与标签模块（TAX）
10. 媒体模块（MEDIA）
11. 公开内容模块（PUBLIC）
12. 系统任务（无对外接口）
13. 接口总表
14. 需求追溯表
15. 与现有文档的冲突
16. 待确认问题

---

## 1 总体约定

### 1.1 基础路径与分区

沿用 `architecture.md` §5.3～5.5 已确定的路径分区（不加 `/v1`，见 §15 冲突 2）：

| 分区 | 前缀 | 认证 | 说明 |
|---|---|---|---|
| 后台业务接口 | `/api/**` | 需要有效会话（下列匿名入口除外） | 编辑、管理员共用同一套路径，服务端按角色和归属判定 |
| 匿名入口 | `/api/auth/login`、`/api/auth/register`、`/api/auth/csrf` | 不需要 | FR-AUTH-004 列明的匿名入口 |
| 博客前台公开接口 | `/api/public/**` | 不需要 | 只读，强制只返回「已发布」 |
| 媒体出口 | `/api/media/{media_id}` | 不需要（可带会话） | 唯一的媒体文件出口，拒绝一律 404 |

部署假设：前端和后端同源，由 Nginx 反向代理 `/api/**`（architecture §1、§9.3）。

### 1.2 风格

- RESTful：资源用名词复数，状态迁移这类流程动作用 `POST /api/articles/{id}/<动作>`。**不存在任何能直接写 `status` 字段的接口**（X-STATE-01）。
- 请求和响应都用 `application/json; charset=utf-8`。只有上传（`multipart/form-data`）和媒体出口（文件字节流）例外。
- 字段命名用 **snake_case**，与 SRS 字段名（`scheduled_publish_time`、`published_at`、`category_id` 等）保持一致。【补充】
- ID 用 64 位整数（JSON number）。
- 布尔值用 `true` / `false`，不用 0/1。
- **空值语义**：SRS 规定「不存在」的字段一律返回 `null`，不得返回空字符串或占位值（6.6、7.2）。集合为空时返回 `[]`。
- **未知字段**：写接口收到未定义的字段，或收到系统字段（`status`、`author_id`、`published_at`、`created_at`、`updated_at`、`submitted_at`、`id`）时，一律返回 `400 FIELD_NOT_WRITABLE`，状态和数据都不变。这满足 TU-13 允许的「400 或忽略」中的 400 这一支，比忽略更容易测。【补充：选择 400】
- **公开接口例外**：公开接口收到未知查询参数（如 `status=DRAFT`）时**忽略**，不报错，也不改变结果集（architecture INV-10、FR-PUBLIC-001 验收③）。

### 1.3 时间格式

- 统一使用 **ISO 8601 并带时区偏移**，例如 `2026-10-04T09:00:00+08:00`。服务端输出统一用 `+08:00`（Asia/Shanghai），精确到秒。
- 输入的日期时间**必须带偏移**（`Z` 或 `±HH:MM`），不带偏移返回 `400 PARAM_INVALID`（SRS 5.5）。
- 偏移不同但表示同一时刻的输入，按同一时刻比较（FR-SUBMIT-003 验收⑤）。
- 一切时间比较都以服务端时间为准。

### 1.4 统一响应体

除媒体出口（文件字节流）和 `204` 外，所有响应都使用：

```json
{
  "code": 0,
  "message": "OK",
  "data": {}
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | integer | `0` 表示成功；非 0 为业务错误码，见 §3.3 |
| `message` | string | 给人看的说明，前端不得用它做分支判断 |
| `data` | object / array / null | 业务数据；失败时为 `null` 或校验明细 |

- **HTTP 状态码和 `code` 同时有效**：SRS 对 400/401/403/404/409 有硬性要求，HTTP 状态码必须严格符合 SRS，`code` 只用来区分同一状态码下的不同原因。
- 校验失败（400）时，`data` 可以带字段明细：

```json
{
  "code": 40000,
  "message": "参数校验失败",
  "data": { "field_errors": [ { "field": "title", "reason": "不能为空或全空白" } ] }
}
```

- **404 例外**：所有 404 都使用同一个固定响应体，逐字节一致，不带任何明细（见 §3.2）。

### 1.5 分页

【补充：参数名与默认值】

请求参数：

| 参数 | 类型 | 默认 | 约束 |
|---|---|---|---|
| `page` | integer | 1 | 从 1 开始，≥ 1 |
| `page_size` | integer | 20 | 1～100 |

响应 `data`：

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0
}
```

- `total` 必须基于**归属过滤和筛选之后**的结果集计算（X-ISO-03、BR-SEARCH-003），不得先全量计数再过滤。
- 无结果时返回 `items: []`、`total: 0`，不报错（X-ISO-04、FR-PUBLIC-001）。
- 页码超出范围时返回空 `items`，`total` 照常。

### 1.6 HTTP 方法约定

| 方法 | 用途 | 成功状态码 |
|---|---|---|
| GET | 查询 | 200 |
| POST | 创建资源 / 流程动作 | 创建为 201，动作为 200 |
| PUT | 整体替换可编辑字段 | 200 |
| DELETE | 删除 | 200（带统一响应体，`data: null`） |

---

## 2 认证、会话与 CSRF

依据：SRS §4.1.1、§4.1.2，FR-AUTH-001～004；architecture §5.1。

> **不使用 JWT / Bearer Token。** SRS FR-AUTH-003 明确要求「会话以 httpOnly Cookie 承载」，并规定了服务端销毁会话、会话固定防护等只有服务端会话才能满足的行为；architecture §5.1 也明确否决了 JWT。因此本规范采用 **服务端会话 Cookie + CSRF 令牌**（见 §15 冲突 1）。

### 2.1 会话 Cookie

| 项 | 取值 |
|---|---|
| Cookie 名 | `JSESSIONID` |
| 属性 | `HttpOnly; SameSite=Lax; Path=/`；`Max-Age` ≤ 12 小时；HTTPS 部署时加 `Secure` |
| 空闲超时 | 30 分钟无请求即失效；每次通过认证的请求刷新空闲计时 |
| 绝对有效期 | 自登录起 12 小时，不因活动延长 |
| 会话固定防护 | 登录成功后更换会话标识，登录前的标识立即失效 |
| 并发会话 | 允许同一账号多处同时登录；登出只销毁当前会话 |

前端 Axios 需要设置 `withCredentials: true`（同源时默认就会带 Cookie）。

### 2.2 CSRF

| 项 | 取值 |
|---|---|
| 令牌下发 | 服务端写入非 httpOnly 的 Cookie `XSRF-TOKEN`，同时在 `GET /api/auth/csrf` 的响应体里返回 |
| 令牌回传 | 请求头 `X-XSRF-TOKEN: <token>` |
| 需要 CSRF 的请求 | **除登录外**所有改变状态的请求（POST / PUT / DELETE），包括登出、注册 |
| 不需要 CSRF 的请求 | `POST /api/auth/login`、所有 GET |
| 失败 | 令牌缺失或不匹配返回 `403 CSRF_INVALID`，不执行操作 |
| 令牌轮换 | 登录成功后令牌随会话更换。前端在登录成功后必须重新读取 `XSRF-TOKEN`（或重新调用 `GET /api/auth/csrf`） |

### 2.3 校验顺序（固定）

SRS §4.1.2 规定了 认证 → CSRF → 三道闸门 的顺序。本规范把请求体校验和状态校验的位置也固定下来：

```
1. 认证            未登录或会话失效        → 401 UNAUTHENTICATED
2. CSRF            令牌缺失或不匹配        → 403 CSRF_INVALID
3. 角色闸 + 归属闸  无权限或不是你的资源    → 404 NOT_FOUND（统一响应体）
4. 请求格式校验     参数或请求体不合法      → 400 xxx
5. 状态闸 / 业务前提 状态不允许、轮次不符、被引用等 → 409 xxx
6. 依赖存储数据的内容校验（如提交时必填内容缺失） → 400 xxx
```

- 第 3 步在第 4 步之前：这样非归属者无论发什么请求体都只拿到 404，不会因为 400 而得知资源存在。
- FR-ARTICLE-005 写明「先校验角色与归属，再校验状态、留痕及二次确认」，因此删除接口的二次确认（400）放在状态与留痕判定（409）之后，作为第 6 步。
- 匿名入口（登录、注册）没有第 1、3 步；媒体出口所有拒绝都是 404（§3.2）。

---

## 3 权限判定与错误响应

### 3.1 角色

| 角色 | 枚举值 | 来源 |
|---|---|---|
| 内容编辑 | `EDITOR` | 注册入口直接注册，立即启用 |
| 管理员 | `ADMIN` | 数据库初始化时创建，每库有且仅有一个，不开放注册 |

一个账号只有一个角色（BR-ROLE-001）。管理员不写文章（BR-ROLE-002）。

### 3.2 三道闸门与统一 404

依据：SRS §4.4、X-ISO-04、architecture INV-09。

- **角色闸或归属闸失败一律返回 404**，响应体与「资源不存在」逐字节一致：

```json
{ "code": 40400, "message": "资源不存在", "data": null }
```

- 状态闸失败返回 409，因为能走到这一步的请求者本来就看得到这篇文章，不会泄露额外信息。
- 编辑调用管理员接口（审核通过、驳回、下架、分类写操作）也返回同样的 404，不返回 403（§4.6 第 2、3 条，TU-11、TU-18）。
- 管理员调用编辑专属接口（创建、编辑、删除、提交、撤回、改期、上传）同样返回 404（TU-12、§4.6 第 6、7 条）。
- **媒体出口**的任何拒绝都是 404，**不返回 401**，也不返回 409（FR-MEDIA-002）。
- 后台列表、筛选、计数接口**不触发 404**，只返回本人可见范围内的结果，没有结果时返回空列表和零计数（X-ISO-04）。

### 3.3 错误码表

【补充：错误码取值】HTTP 状态码按 SRS 定；`code` = HTTP 状态码 × 100 + 序号。

| HTTP | code | 名称 | 含义 | 典型来源 |
|---|---|---|---|---|
| 200/201 | 0 | OK | 成功 | — |
| 400 | 40000 | PARAM_INVALID | 参数或请求体格式不合法（缺字段、类型错、时间不带偏移、标题全空白等） | 通用 |
| 400 | 40001 | FIELD_NOT_WRITABLE | 请求包含系统字段或未定义字段（如 `status`） | X-STATE-01、TU-13 |
| 400 | 40002 | USERNAME_INVALID | 登录名不符合 3～32 位 ASCII 字母、数字或下划线 | §4.1.1 |
| 400 | 40003 | PASSWORD_INVALID | 密码不符合 8～64 个 Unicode 码点，或全空白 | §4.1.1 |
| 400 | 40004 | CONTENT_REJECTED | 正文违规：代码区域之外有原始 HTML、脚本、iframe 或嵌入代码；危险协议、`http:`、`//` 协议相对地址；视频链接不是绝对 https；外部图片 | BR-MEDIA-001、BR-MEDIA-006、FR-MEDIA-004、TU-24 |
| 400 | 40005 | MEDIA_REFERENCE_INVALID | 引用的媒体不存在、不属于本文章，或用途不符（如把音频当封面） | BR-MEDIA-008、TU-20 |
| 400 | 40006 | MEDIA_TYPE_INVALID | 真实格式不在白名单（含 svg），或与扩展名或 `Content-Type` 声明不一致 | BR-MEDIA-002、TU-23 |
| 400 | 40007 | MEDIA_TOO_LARGE | 超过大小上限（图片 5 MB，音频 20 MB） | BR-MEDIA-002、BR-MEDIA-005 |
| 400 | 40008 | REFERENCE_INVALID | `category_id` 或 `tag_ids` 指向不存在的分类或标签 | FR-TAX-003 |
| 400 | 40009 | SCHEDULE_TIME_INVALID | 改期的新时间早于或等于服务端当前时间 | BR-PUB-008 |
| 400 | 40010 | SUBMISSION_ID_INVALID | 审核请求缺少提交轮次标识，或格式无效 | §5.6、FR-REVIEW-002/003 |
| 400 | 40011 | REJECT_CATEGORY_INVALID | 驳回类别缺失或不在枚举内 | BR-CONTENT-005 |
| 400 | 40012 | REASON_REQUIRED | 驳回意见或下架原因缺失、为空字符串或纯空格 | BR-AUDIT-003、TU-15 |
| 400 | 40013 | CONFIRM_REQUIRED | 删除没有带二次确认标记 | BR-DEL-005 |
| 400 | 40014 | ARTICLE_INCOMPLETE | 提交审核时必填内容（标题、正文、分类）缺失 | FR-SUBMIT-001 |
| 401 | 40100 | UNAUTHENTICATED | 未登录、会话过期或已登出 | FR-AUTH-002、FR-AUTH-004 |
| 401 | 40101 | LOGIN_FAILED | 登录名不存在、密码错误或账号被锁定，**三种情况响应完全相同** | §4.1.1、§4.1.2 |
| 403 | 40300 | CSRF_INVALID | CSRF 令牌缺失或不匹配 | §4.1.2 |
| 404 | 40400 | NOT_FOUND | 资源不存在 / 无权限 / 不是你的资源，**统一响应体** | §4.4 |
| 409 | 40900 | STATE_CONFLICT | 当前文章状态不允许此操作（含并发下状态已变） | §4.4、§5.6 |
| 409 | 40901 | SUBMISSION_STALE | 提交轮次已变化（旧页面审核新一轮内容） | §5.6 |
| 409 | 40902 | SCHEDULE_ALREADY_DUE | 待发布文章的原预定时间已到达，不能再改期 | BR-PUB-008 |
| 409 | 40903 | ARTICLE_HAS_AUDIT_TRAIL | 草稿曾经提交过（有留痕），不能删除 | BR-DEL-001、TU-03b |
| 409 | 40904 | TAXONOMY_IN_USE | 分类或标签被任意状态的文章引用，不能改名或删除 | BR-TAX-004 |
| 409 | 40905 | USERNAME_TAKEN | 规范化后的登录名已存在（含与管理员重名） | §4.1.1 |
| 409 | 40906 | NAME_DUPLICATE | 分类或标签名称重复【补充，见 §16】 | — |
| 500 | 50000 | INTERNAL_ERROR | 服务端异常；流程操作整体不生效（§5.6） | — |

> 说明：409 各子码只在请求者已通过角色闸和归属闸后才可能出现，所以细分原因不会泄露资源存在性。

---

## 4 枚举与数据模型

### 4.1 枚举

**文章状态 `ArticleStatus`**（SRS §5.1）

| 值 | 中文 | 说明 |
|---|---|---|
| `DRAFT` | 草稿 | 正在创建或修改，尚未提交 |
| `PENDING_REVIEW` | 待审核 | 已提交，等待管理员审核 |
| `REJECTED` | 驳回 | 审核不通过，等待编辑修改后重新提交 |
| `SCHEDULED` | 待发布 | 审核通过，等待预定时间到达 |
| `PUBLISHED` | 已发布 | 已对博客前台公开 |
| `UNPUBLISHED` | 已下架 | 曾经发布，被管理员下架 |

> architecture §4.1 规定数据库里存中文字面量。接口层统一用上表的英文值，由后端负责映射（见 §16）。

**角色 `Role`**：`EDITOR`（内容编辑）、`ADMIN`（管理员）。

**留痕操作类型 `AuditAction`**（SRS §6.6）

| 值 | 中文 | 操作人 | 对应迁移 |
|---|---|---|---|
| `SUBMIT` | 提交审核 | 归属编辑 | #1、#2、#5 |
| `APPROVE` | 审核通过 | 管理员 | #7、#8 |
| `REJECT` | 驳回 | 管理员 | #6 |
| `UNPUBLISH` | 下架 | 管理员 | #9 |
| `WITHDRAW` | 撤回 | 归属编辑 | #4 |
| `RESCHEDULE` | 改期 | 归属编辑 | #3 |
| `AUTO_PUBLISH` | 到期自动发布 | 系统 | #10 |

**操作人类型 `ActorType`**：`USER`（用户账号）、`SYSTEM`（系统，只用于 `AUTO_PUBLISH`）。

**驳回类别 `RejectCategory`**（BR-CONTENT-005，固定 8 类）

| 值 | 中文 |
|---|---|
| `ILLEGAL` | 违法违规 |
| `AUTHENTICITY_SOURCE` | 真实性／来源 |
| `COPYRIGHT_PRIVACY` | 版权／隐私 |
| `MINOR_VULGAR_VIOLENCE` | 未成年人／低俗／暴力 |
| `DISCRIMINATION_HARASSMENT` | 歧视／骚扰／引战 |
| `SPAM_MARKETING` | 垃圾／营销 |
| `QUALITY_POSITIONING` | 内容质量／博客定位 |
| `OTHER` | 其他 |

**媒体用途 `MediaUsage`**

| 值 | 中文 | 白名单 | 上限 | 每篇数量 |
|---|---|---|---|---|
| `COVER` | 封面图 | jpg / jpeg / png / gif / webp（不含 svg） | 5 MB | 引用 ≤ 1 |
| `INLINE_IMAGE` | 正文图片 | 同封面图 | 5 MB | 不限 |
| `AUDIO` | 文章音频 | mp3 / m4a / wav / ogg | 20 MB | 引用 ≤ 1 |

**最近事件类型 `LatestEventType`**：`REJECT`、`UNPUBLISH`（用于列表的「最近一次驳回或下架」）。

**文章可执行动作 `ArticleAction`**【补充】：`EDIT`、`DELETE`、`SUBMIT`、`WITHDRAW`、`RESCHEDULE`、`UPLOAD_MEDIA`、`APPROVE`、`REJECT`、`UNPUBLISH`。仅用于详情里的 `allowed_actions`，帮前端决定显示哪些按钮；服务端仍独立判权。

### 4.2 用户 `User`

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `id` | int64 | 否 | 账号 ID |
| `username` | string | 否 | 登录名，规范化后的形式（去首尾空白、转小写）【补充：存储形式见 §16】 |
| `role` | Role | 否 | 单一角色 |
| `created_at` | datetime | 否 | 注册或初始化时间 |

不返回密码或密码哈希。本期不采集邮箱、手机号、昵称（§4.1.1）。

### 4.3 用户摘要 `UserBrief`

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `id` | int64 | 否 | 账号 ID |
| `username` | string | 否 | 登录名 |

### 4.4 操作人 `Actor`

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `type` | ActorType | 否 | `USER` 或 `SYSTEM` |
| `id` | int64 | 是 | `USER` 时必有，`SYSTEM` 时为 `null`（BR-AUDIT-004） |
| `username` | string | 是 | `USER` 时必有，`SYSTEM` 时为 `null` |

### 4.5 分类 `Category`

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `id` | int64 | 否 | |
| `name` | string | 否 | 1～50 个字符，不允许全空白【补充：长度】 |
| `in_use` | boolean | 否 | 是否被任意状态的文章引用（被引用时不能改名或删除）。只给布尔值，不给计数，避免通过计数推断他人文章数量（BR-SEARCH-003） |
| `created_at` | datetime | 否 | |
| `updated_at` | datetime | 否 | |

### 4.6 标签 `Tag`

字段同 `Category`。标签扁平，无父子层级（BR-SEARCH-006）。

### 4.7 分类 / 标签摘要 `CategoryBrief`、`TagBrief`

| 字段 | 类型 | 可空 |
|---|---|---|
| `id` | int64 | 否 |
| `name` | string | 否 |

### 4.8 媒体引用 `MediaRef`

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `media_id` | int64 | 否 | 媒体资源 ID |
| `url` | string | 否 | 站内相对地址，固定为 `/api/media/{media_id}` |
| `mime_type` | string | 否 | 服务端按文件内容判定的真实类型 |
| `size` | int64 | 否 | 字节数 |

### 4.9 媒体资源 `Media`（上传响应）

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `media_id` | int64 | 否 | |
| `article_id` | int64 | 否 | 归属文章，上传时确定，不可改派（BR-MEDIA-008） |
| `usage` | MediaUsage | 否 | 用途 |
| `url` | string | 否 | `/api/media/{media_id}` |
| `mime_type` | string | 否 | 真实类型 |
| `size` | int64 | 否 | 字节数 |
| `linked` | boolean | 否 | 是否已保存进文章引用。刚上传时为 `false`；未关联超过 24 小时会被系统清理（BR-MEDIA-004） |
| `created_at` | datetime | 否 | |

不返回原始文件名和存储路径。存储文件名由系统生成（BR-MEDIA-002）。

### 4.10 文章 `Article`（后台详情）

依据：SRS §7.2、FR-ARTICLE-004。

**（1）编辑可写的内容字段**

| 字段 | 类型 | 必填 | 可空 | 说明 |
|---|---|---|---|---|
| `title` | string | 是 | 否 | 单行，不允许全空白；长度上限见 §16【补充建议 ≤ 200】 |
| `content` | string | 是 | 否 | Markdown 原文，规则见 §6.0 |
| `excerpt` | string | 否 | 否 | 未填写时为 `""`，系统不自动截取 |
| `cover` | MediaRef | 否 | 是 | 封面图；写入时用 `cover_media_id` |
| `audio` | MediaRef | 否 | 是 | 文章音频；写入时用 `audio_media_id` |
| `category` | CategoryBrief | 是 | 否 | 单选；写入时用 `category_id` |
| `tags` | TagBrief[] | 否 | 否 | 多选，无标签为 `[]`；写入时用 `tag_ids` |
| `scheduled_publish_time` | datetime | 否 | 是 | 预定发布时间 |

**（2）系统维护字段（只读，写入即 400）**

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `id` | int64 | 否 | |
| `status` | ArticleStatus | 否 | 只能由流程动作改变 |
| `author` | UserBrief | 否 | 归属编辑，创建后不可变 |
| `published_at` | datetime | 是 | 本次实际发布时间；下架期间保留上次取值（§5.5） |
| `created_at` | datetime | 否 | |
| `updated_at` | datetime | 否 | 最后修改时间 |
| `submitted_at` | datetime | 是 | 最近一次提交审核时间，用于审核队列排序 |

**（3）来自留痕的派生字段（只读，不存回文章记录）**

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `latest_rejection` | LatestRejection | 是 | 最近一次驳回；从未驳回为 `null` |
| `latest_unpublish` | LatestUnpublish | 是 | 最近一次下架；从未下架为 `null` |
| `current_submission_id` | int64 | 是 | 当前提交轮次标识（= 本轮「提交审核」留痕的 ID）。**仅管理员查看「待审核」文章时返回**，其他情况为 `null` |
| `allowed_actions` | ArticleAction[] | 否 | 【补充】当前请求者在当前状态下可执行的动作 |

`LatestRejection`：

| 字段 | 类型 | 可空 |
|---|---|---|
| `reject_category` | RejectCategory | 否 |
| `comment` | string | 否 |
| `operator` | Actor | 否 |
| `operated_at` | datetime | 否 |

`LatestUnpublish`：

| 字段 | 类型 | 可空 |
|---|---|---|
| `reason` | string | 否 |
| `operator` | Actor | 否 |
| `operated_at` | datetime | 否 |

### 4.11 文章列表项 `ArticleListItem`（后台）

依据：FR-ARTICLE-003、FR-ARTICLE-006、SRS §7.2（3）。

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `id` | int64 | 否 | |
| `title` | string | 否 | |
| `status` | ArticleStatus | 否 | |
| `category` | CategoryBrief | 否 | |
| `tags` | TagBrief[] | 否 | |
| `author` | UserBrief | 否 | 归属编辑 |
| `updated_at` | datetime | 否 | 最后修改时间 |
| `submitted_at` | datetime | 是 | 【补充】 |
| `scheduled_publish_time` | datetime | 是 | 【补充】 |
| `published_at` | datetime | 是 | 【补充】 |
| `latest_event` | LatestEvent | 是 | 最近一次驳回**或**下架，跨类型取最新一条；都没发生过为 `null` |

`LatestEvent`：

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `type` | LatestEventType | 否 | `REJECT` 或 `UNPUBLISH` |
| `operated_at` | datetime | 否 | 该条留痕的服务端时间，不是文章修改时间 |
| `operator` | Actor | 否 | |
| `reject_category` | RejectCategory | 是 | 仅 `REJECT` 有值 |
| `reason` | string | 否 | 驳回意见或下架原因 |

语义：只取「驳回」「下架」两类留痕；文章之后重新提交、审核通过、再次发布都**不会**清除该值，直到发生新的驳回或下架（§7.2（3））。

### 4.12 审核队列项 `ReviewQueueItem`

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `id` | int64 | 否 | 文章 ID |
| `title` | string | 否 | |
| `author` | UserBrief | 否 | |
| `category` | CategoryBrief | 否 | |
| `tags` | TagBrief[] | 否 | |
| `submitted_at` | datetime | 否 | |
| `scheduled_publish_time` | datetime | 是 | |
| `current_submission_id` | int64 | 否 | 当前提交轮次标识 |

### 4.13 留痕 `AuditLog`

依据：SRS §6.6 字段规则表。所有「不写入」的字段一律返回 `null`。

| 字段 | 类型 | 可空 | 出现于 |
|---|---|---|---|
| `id` | int64 | 否 | 全部 |
| `article_id` | int64 | 否 | 全部 |
| `action` | AuditAction | 否 | 全部 |
| `operator` | Actor | 否 | 全部 |
| `operated_at` | datetime | 否 | 全部 |
| `reason` | string | 是 | 只在 `REJECT`（驳回意见）、`UNPUBLISH`（下架原因）有值 |
| `reject_category` | RejectCategory | 是 | 只在 `REJECT` 有值 |
| `review_standard_version` | string | 是 | 只在 `APPROVE`、`REJECT`、`UNPUBLISH` 有值，如 `CMS-CONTENT-REVIEW-1.0` |
| `published_at` | datetime | 是 | 只在「审核通过且立即发布」和 `AUTO_PUBLISH` 有值 |
| `schedule_change` | ScheduleChange | 是 | 只在 `RESCHEDULE` 有值 |
| `related_approval_id` | int64 | 是 | 只在 `AUTO_PUBLISH` 有值，指向仍有效的审核通过留痕 |
| `related_submission_id` | int64 | 是 | 只在 `APPROVE`、`REJECT` 有值，指向管理员查看的那一轮提交审核留痕 |

`ScheduleChange`：`{ "from": datetime, "to": datetime }`，两者均非空。

### 4.14 公开文章 `PublicArticleListItem` / `PublicArticleDetail`

依据：SRS §8.2 公开信息白名单。**只能返回下列字段**。

`PublicArticleListItem`：

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `id` | int64 | 否 | |
| `title` | string | 否 | |
| `excerpt` | string | 否 | 未填写为 `""` |
| `cover_url` | string | 是 | `/api/media/{id}`；无封面为 `null` |
| `category` | CategoryBrief | 否 | |
| `tags` | TagBrief[] | 否 | 无标签为 `[]` |
| `published_at` | datetime | 否 | 本次实际发布时间 |

`PublicArticleDetail`：在列表项字段基础上增加：

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `content` | string | 否 | Markdown 原文，包含当前的正文图片引用（`/api/media/{id}`）和视频链接 |
| `audio_url` | string | 是 | 无音频为 `null` |

**禁止返回**：作者 ID、登录名或任何账号信息，状态，提交轮次，审核人，驳回类别与意见，下架原因，审核标准版本，留痕，预定发布时间，以及其他内部字段。

---

## 5 认证与账号模块（AUTH / USER）

### 5.1 `GET /api/auth/csrf` 获取 CSRF 令牌【补充】

- **说明**：下发 CSRF 令牌，供匿名注册和登录后的写请求使用。SRS §4.1.2 要求「匿名注册使用服务端在注册页下发的令牌」，这里把「下发」落成一个接口。
- **权限**：匿名可调用。
- **请求**：无。
- **响应 200**：同时写入 `Set-Cookie: XSRF-TOKEN=...; Path=/; SameSite=Lax`（非 httpOnly）。

```json
{ "code": 0, "message": "OK", "data": { "header_name": "X-XSRF-TOKEN", "token": "5b0c2f..." } }
```

- **覆盖需求**：§4.1.2 CSRF 防护、FR-AUTH-003、FR-AUTH-004。

### 5.2 `POST /api/auth/register` 注册内容编辑账号

- **说明**：测试环境下内容编辑直接注册，注册成功立即启用。**只能创建 `EDITOR`**，不能创建管理员；注册**不建立会话**，之后必须登录。
- **权限**：匿名；需要 CSRF 令牌。
- **请求体**：

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| `username` | string | 是 | 先去首尾空白，再校验 3～32 位 ASCII 字母、数字、下划线；唯一性不区分大小写 |
| `password` | string | 是 | 8～64 个 Unicode 码点，不允许全空白；不去空白、不转大小写、不截断 |

请求体中出现 `role` 等其他字段 → `400 FIELD_NOT_WRITABLE`。

```json
{ "username": " Editor_01 ", "password": "correct horse 9" }
```

- **响应 201**：

```json
{ "code": 0, "message": "OK", "data": { "id": 12, "username": "editor_01", "role": "EDITOR", "created_at": "2026-11-15T10:00:00+08:00" } }
```

- **错误**：`400 PARAM_INVALID`（缺字段）、`400 USERNAME_INVALID`、`400 PASSWORD_INVALID`、`400 FIELD_NOT_WRITABLE`、`403 CSRF_INVALID`、`409 USERNAME_TAKEN`（含与管理员重名；并发注册同名只有一个成功）。
- **覆盖需求**：FR-USER-001、§4.1.1、FR-AUTH-004；验收 FR-AUTH-001/FR-USER-001 ①～⑤。

### 5.3 `POST /api/auth/login` 登录

- **说明**：用登录名和密码登录，成功后建立服务端会话并**更换会话标识**。
- **权限**：匿名；**不需要** CSRF 令牌。
- **请求体**：

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| `username` | string | 是 | 规范化规则同注册 |
| `password` | string | 是 | 按原始输入校验 |

- **响应 200**：响应头带 `Set-Cookie: JSESSIONID=...; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`（HTTPS 时加 `Secure`），并轮换 `XSRF-TOKEN`。

```json
{ "code": 0, "message": "OK", "data": { "user": { "id": 12, "username": "editor_01", "role": "EDITOR", "created_at": "2026-11-15T10:00:00+08:00" } } }
```

- **错误**：
  - `400 PARAM_INVALID` / `USERNAME_INVALID` / `PASSWORD_INVALID`：缺字段或格式不合法。
  - `401 LOGIN_FAILED`：登录名不存在、密码错误、账号被锁定。**三种情况响应体完全一致**，且不建立会话：

```json
{ "code": 40101, "message": "登录名或密码错误", "data": null }
```

- **锁定规则**：同一登录名连续 5 次认证失败锁定 15 分钟；锁定期间即使密码正确也返回上面同一个 401；到期自动解除。
- **覆盖需求**：FR-AUTH-001、FR-AUTH-003、§4.1.1、§4.1.2；TU-25。

### 5.4 `POST /api/auth/logout` 登出

- **说明**：服务端销毁**当前**会话；之后再用旧会话标识访问返回 401。不影响同一账号的其他会话。
- **权限**：已登录；需要 CSRF 令牌。
- **请求体**：无。
- **响应 200**：`{ "code": 0, "message": "OK", "data": null }`，同时清除 `JSESSIONID`。
- **错误**：`401 UNAUTHENTICATED`、`403 CSRF_INVALID`。
- **覆盖需求**：FR-AUTH-002；TU-25。

### 5.5 `GET /api/auth/me` 当前用户

- **说明**：返回当前登录用户和角色。前端据此决定编辑端或管理员端的菜单和路由（前端守卫只管体验，不承担权限判定）。
- **权限**：已登录。
- **响应 200**：

```json
{ "code": 0, "message": "OK", "data": { "id": 1, "username": "admin", "role": "ADMIN", "created_at": "2026-10-19T00:00:00+08:00" } }
```

- **错误**：`401 UNAUTHENTICATED`。
- **覆盖需求**：FR-AUTH-005、BR-ROLE-001；FR-AUTH-004（会话失效检测）。

### 5.6 不提供的账号接口

| 需求 | 交付范围 | 本规范处理 |
|---|---|---|
| FR-USER-002 修改账号角色 | 后续版本 | 不设计接口 |
| FR-USER-003 停用与启用账号 | 后续版本 | 不设计接口 |
| FR-USER-004 密码找回、重置、自助改密 | 本期不做 | **不得提供**任何相关接口 |
| FR-USER-005 改派文章归属编辑 | 后续版本 | 不设计接口；`author_id` 不可写 |

---

## 6 文章模块（ARTICLE / SUBMIT）

### 6.0 正文（`content`）保存规则

依据：BR-MEDIA-001、BR-MEDIA-006、BR-MEDIA-008、FR-MEDIA-004、§4.6 第 17 条、TU-24。凡是写入 `content` 的接口（创建、编辑）都执行：

1. 按 Markdown 结构解析，**只校验代码区域之外**的内容。围栏代码块、缩进代码块、行内代码里的 HTML、`<script>`、`<iframe>` 等示例当作普通文本，允许保存。
2. 代码区域之外出现原始 HTML、脚本、iframe 或播放器嵌入代码 → `400 CONTENT_REJECTED`。
3. **图片** `![alt](地址)`：地址必须是站内相对地址 `/api/media/{media_id}`，并且该媒体属于**本文章**、用途为 `INLINE_IMAGE`。外部 URL → `400 CONTENT_REJECTED`；其他文章（包括已发布文章）的媒体 → `400 MEDIA_REFERENCE_INVALID`。
4. **普通链接**：绝对 `https://` URL，或站内相对地址（以单个 `/` 开头、不以 `//` 开头）。
5. **视频链接**：必须是绝对 `https://` URL，不限域名。
6. 一律拒绝：`javascript:`、`data:`、`vbscript:` 等危险协议，`http:`，以 `//` 开头的协议相对地址，缺少协议又不是站内相对的地址 → `400 CONTENT_REJECTED`。
7. 保存 Markdown 原文，不渲染、不消毒、不存 HTML。CMS 不下载、不代理视频。
8. `400 CONTENT_REJECTED` 的 `data.field_errors` 给出违规位置（如行号和原因），便于前端提示。

> 视频链接与普通链接在 Markdown 语法上无法区分，SRS 也没有规定区分方式。本规范的处理：凡链接都必须满足普通链接规则；相对地址在规则 4 下合法。因此「相对路径的视频链接拒绝」（验收⑧）实际上依赖如何认定「视频链接」，见 §16 问题 9。

### 6.0.1 媒体引用保存规则

- `cover_media_id` 必须指向本文章、用途为 `COVER` 的媒体；`audio_media_id` 必须指向本文章、用途为 `AUDIO` 的媒体；否则返回 `400 MEDIA_REFERENCE_INVALID`。
- 置为 `null` 表示移除；换成另一个 ID 表示替换。替换总是产生新资源，旧文件不会被原地覆盖（BR-MEDIA-002）。
- 引用变更和文章内容保存在同一事务内共同成功（§5.6）。被移除或替换掉的媒体会立即失去读取权限，并由系统清理（BR-MEDIA-004）。

### 6.1 `GET /api/articles` 文章列表（编辑：我的文章；管理员：全部文章）

- **说明**：编辑和管理员共用。编辑的结果集在数据层强制附加 `author_id = 当前用户`，管理员不附加。筛选和关键字都走同一套归属过滤，不存在绕过列表的查询路径。
- **权限**：已登录（EDITOR、ADMIN）。
- **查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `page`、`page_size` | integer | 否 | 见 §1.5 |
| `status` | ArticleStatus | 否 | 按状态筛选，可多值（`status=DRAFT&status=REJECTED`） |
| `category_id` | int64 | 否 | 按分类筛选 |
| `tag_ids` | int64[] | 否 | 按标签筛选，可多值，**交集语义**（同时具备全部标签） |
| `title` | string | 否 | 标题模糊匹配（不检索正文） |
| `author_id` | int64 | 否 | 按归属编辑筛选。管理员可用；编辑传入时与本人条件取交集，传他人 ID 只会得到空列表 |
| `sort` | string | 否 | 【补充】`updated_at_desc`（默认）、`updated_at_asc`、`created_at_desc` |

- **响应 200**：`data` 为分页对象，`items` 为 `ArticleListItem[]`。

```json
{
  "code": 0, "message": "OK",
  "data": {
    "items": [
      {
        "id": 101, "title": "Spring Boot 入门教程", "status": "UNPUBLISHED",
        "category": { "id": 3, "name": "后端" },
        "tags": [ { "id": 7, "name": "Spring" }, { "id": 9, "name": "Java" } ],
        "author": { "id": 12, "username": "zhangsan" },
        "updated_at": "2026-10-02T09:00:00+08:00",
        "submitted_at": "2026-09-28T14:00:00+08:00",
        "scheduled_publish_time": null,
        "published_at": "2026-09-28T15:20:00+08:00",
        "latest_event": {
          "type": "UNPUBLISH", "operated_at": "2026-10-02T09:00:00+08:00",
          "operator": { "type": "USER", "id": 1, "username": "admin" },
          "reject_category": null, "reason": "技术结论已过期，需更新"
        }
      }
    ],
    "page": 1, "page_size": 20, "total": 1
  }
}
```

- **错误**：`400 PARAM_INVALID`（参数类型错误）、`401 UNAUTHENTICATED`。不会返回 404。
- **覆盖需求**：FR-ARTICLE-003、FR-ARTICLE-006、BR-SEARCH-001～005、BR-ISO-001～003、X-ISO-01～04、§7.2（3）；TU-05、TU-06、TU-07、TU-22；§4.6 第 16 条。

### 6.2 `POST /api/articles` 创建文章草稿

- **说明**：创建一篇状态为 `DRAFT` 的文章，`author` 为当前编辑。因为媒体上传必须指定已存在的文章，所以封面、音频、正文图片要在创建之后上传，再通过「编辑文章」关联。
- **权限**：仅 EDITOR；管理员调用返回 404。需要 CSRF。
- **请求体**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 是 | 不允许全空白 |
| `content` | string | 是 | 规则见 §6.0（创建时还没有媒体，正文不能含图片引用） |
| `excerpt` | string | 否 | 缺省为 `""` |
| `category_id` | int64 | 是 | 必须存在 |
| `tag_ids` | int64[] | 否 | 缺省为 `[]`，必须都存在 |
| `scheduled_publish_time` | datetime | 否 | 必须带时区偏移；保存时不要求晚于当前时间 |

> 草稿是否允许缺少标题、正文、分类，SRS 没有明确，本规范按 §7.2「必填」和 FR-ARTICLE-002 处理为必填，见 §16 问题 1。

```json
{
  "title": "Vue 3 组合式 API 笔记",
  "content": "# 前言\n\n示例视频：[演示](https://www.bilibili.com/video/BV1xx)\n\n```html\n<script>alert(1)</script>\n```",
  "excerpt": "",
  "category_id": 4,
  "tag_ids": [11, 12],
  "scheduled_publish_time": "2026-12-01T09:00:00+08:00"
}
```

- **响应 201**：`data` 为完整 `Article`（同 §6.3）。
- **错误**：`400 PARAM_INVALID`、`400 FIELD_NOT_WRITABLE`（如带 `status`、`author_id`）、`400 CONTENT_REJECTED`、`400 REFERENCE_INVALID`、`401`、`403 CSRF_INVALID`、`404 NOT_FOUND`（管理员调用）。
- **覆盖需求**：FR-ARTICLE-001、FR-TAX-003、FR-MEDIA-004、BR-ISO-001、BR-ROLE-002、X-STATE-01。

### 6.3 `GET /api/articles/{id}` 文章详情

- **说明**：返回文章完整内容、关联媒体、最近一次驳回和最近一次下架信息（按类型分别返回）。管理员查看「待审核」文章时额外返回 `current_submission_id`，审核通过或驳回时必须带上它。管理员审核时用本接口查看完整正文和媒体。
- **权限**：EDITOR（仅本人文章）、ADMIN（全部）。
- **路径参数**：`id` int64。
- **响应 200**：

```json
{
  "code": 0, "message": "OK",
  "data": {
    "id": 102, "title": "Vue 3 组合式 API 笔记", "status": "PENDING_REVIEW",
    "content": "# 前言\n\n![架构图](/api/media/5001)\n...",
    "excerpt": "",
    "cover": { "media_id": 5000, "url": "/api/media/5000", "mime_type": "image/png", "size": 182044 },
    "audio": null,
    "category": { "id": 4, "name": "前端" },
    "tags": [ { "id": 11, "name": "Vue" } ],
    "scheduled_publish_time": "2026-12-01T09:00:00+08:00",
    "author": { "id": 12, "username": "zhangsan" },
    "published_at": null,
    "created_at": "2026-11-10T10:00:00+08:00",
    "updated_at": "2026-11-14T16:00:00+08:00",
    "submitted_at": "2026-11-14T16:05:00+08:00",
    "latest_rejection": {
      "reject_category": "QUALITY_POSITIONING", "comment": "正文缺少实际案例",
      "operator": { "type": "USER", "id": 1, "username": "admin" },
      "operated_at": "2026-11-12T10:30:00+08:00"
    },
    "latest_unpublish": null,
    "current_submission_id": 9031,
    "allowed_actions": ["APPROVE", "REJECT"]
  }
}
```

- **错误**：`401`、`404 NOT_FOUND`（不存在，或是他人文章）。
- **覆盖需求**：FR-ARTICLE-004、FR-REVIEW-001（查看完整正文与媒体）、BR-CONTENT-001、BR-009、BR-ISO-001、§5.6；TU-01、§4.6 第 8 条。

### 6.4 `PUT /api/articles/{id}` 编辑文章

- **说明**：整体替换文章的可编辑字段，同时完成分类、标签设置和媒体的关联、移除、替换。只有归属编辑在 `DRAFT`、`REJECTED`、`UNPUBLISHED` 状态下可以调用。管理员没有任何修改内容的接口。
- **权限**：仅归属 EDITOR；需要 CSRF。
- **请求体**（**全量替换**：可选字段省略即视为置空 / 清空）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 是 | 不允许全空白 |
| `content` | string | 是 | 规则见 §6.0 |
| `excerpt` | string | 否 | 省略为 `""` |
| `category_id` | int64 | 是 | 必须存在 |
| `tag_ids` | int64[] | 否 | 省略为 `[]` |
| `cover_media_id` | int64 / null | 否 | 规则见 §6.0.1；省略或 `null` 表示无封面 |
| `audio_media_id` | int64 / null | 否 | 规则见 §6.0.1；省略或 `null` 表示无音频 |
| `scheduled_publish_time` | datetime / null | 否 | 带时区偏移；`null` 表示不设预定时间 |

```json
{
  "title": "Vue 3 组合式 API 笔记（修订）",
  "content": "# 前言\n\n![架构图](/api/media/5001)\n\n参考：[官方文档](https://vuejs.org/)",
  "excerpt": "组合式 API 的常见用法",
  "category_id": 4,
  "tag_ids": [11],
  "cover_media_id": 5000,
  "audio_media_id": null,
  "scheduled_publish_time": null
}
```

- **响应 200**：`data` 为更新后的完整 `Article`。
- **错误**：
  - `404 NOT_FOUND`：文章不存在、不是本人文章、管理员调用。
  - `400 PARAM_INVALID`：标题或正文为空、未指定分类、时间不带偏移等。
  - `400 FIELD_NOT_WRITABLE`：带了 `status` 等系统字段。
  - `400 CONTENT_REJECTED` / `MEDIA_REFERENCE_INVALID` / `REFERENCE_INVALID`。
  - `409 STATE_CONFLICT`：状态为 `PENDING_REVIEW`、`SCHEDULED`、`PUBLISHED`（含与提交审核并发、提交先成功的情况），内容不变。
  - `401`、`403 CSRF_INVALID`。
- **覆盖需求**：FR-ARTICLE-002、FR-TAX-003、FR-MEDIA-001（关联、移除、替换）、FR-MEDIA-004、BR-002、BR-007、BR-ISO-001、BR-TAX-001～002、BR-MEDIA-001、BR-MEDIA-008、X-STATE-01；TU-02、TU-12、TU-13、TU-19、TU-20、TU-24；§4.6 第 6、8、12、17 条。

### 6.5 `DELETE /api/articles/{id}` 删除草稿

- **说明**：物理删除从未提交过的草稿（状态为 `DRAFT` 且没有任何留痕），不生成留痕。同时清理该文章拥有的全部媒体，包括还没关联的上传文件。删除不可撤销，前端必须二次确认。
- **权限**：仅归属 EDITOR；需要 CSRF。
- **查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `confirm` | boolean | 是 | 必须为 `true`，作为二次确认标记 |

示例：`DELETE /api/articles/103?confirm=true`

- **响应 200**：`{ "code": 0, "message": "OK", "data": null }`
- **错误**（按判定顺序）：
  - `404 NOT_FOUND`：不存在、他人草稿、管理员调用。
  - `409 STATE_CONFLICT`：状态不是 `DRAFT`。
  - `409 ARTICLE_HAS_AUDIT_TRAIL`：是草稿，但有留痕（例如「提交后又被撤回」）。
  - `400 CONFIRM_REQUIRED`：没有带 `confirm=true`。
  - `401`、`403 CSRF_INVALID`。
- **覆盖需求**：FR-ARTICLE-005、BR-DEL-001～005、BR-MEDIA-004；TU-03、TU-03b；§4.6 第 7、14 条。

### 6.6 `POST /api/articles/{id}/submit` 提交审核

- **说明**：`DRAFT` / `REJECTED` / `UNPUBLISHED` → `PENDING_REVIEW`。写入 `submitted_at`，生成「提交审核」留痕；该留痕的 ID 就是本轮的提交轮次标识。
- **权限**：仅归属 EDITOR；需要 CSRF。
- **请求体**：无（或 `{}`）。
- **响应 200**：

```json
{ "code": 0, "message": "OK", "data": { "id": 102, "status": "PENDING_REVIEW", "submitted_at": "2026-11-14T16:05:00+08:00" } }
```

- **错误**：`404`（非归属、管理员）、`409 STATE_CONFLICT`（已经是待审核，或是待发布、已发布）、`400 ARTICLE_INCOMPLETE`（必填内容缺失）、`401`、`403`。
- **覆盖需求**：FR-SUBMIT-001、BR-001、BR-005、BR-006、BR-011、BR-ISO-001、X-AUDIT-01；TU-04；§4.6 第 15 条。

### 6.7 `POST /api/articles/{id}/withdraw` 撤回待发布文章

- **说明**：`SCHEDULED` → `DRAFT`。清空预定发布时间，原审核结论作废，生成「撤回」留痕（不产生驳回记录）。预定时间已到但系统还没实际发布时**也可以撤回**。与发布并发时只有一方成功，发布已成功则返回 409。
- **权限**：仅归属 EDITOR；需要 CSRF。
- **请求体**：无。
- **响应 200**：

```json
{ "code": 0, "message": "OK", "data": { "id": 104, "status": "DRAFT", "scheduled_publish_time": null } }
```

- **错误**：`404`、`409 STATE_CONFLICT`（不是待发布，或并发发布已成功）、`401`、`403`。
- **覆盖需求**：FR-SUBMIT-002、BR-PUB-009、BR-PUB-010、§5.6。

### 6.8 `POST /api/articles/{id}/reschedule` 修改待发布文章的预定时间

- **说明**：`SCHEDULED` → `SCHEDULED`。内容不变，原审核结论继续有效，生成「改期」留痕（记录变更前后时间）。只能在原预定时间到达**之前**改期。
- **权限**：仅归属 EDITOR；需要 CSRF。
- **请求体**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `scheduled_publish_time` | datetime | 是 | 新时间，带时区偏移，必须严格晚于服务端当前时间 |
| `expected_scheduled_publish_time` | datetime | 否 | 【补充】客户端看到的原预定时间。传入且与服务端当前值不同 → 409，用于识别旧页面（§5.6「预定时间已经变化的旧请求返回 409」） |

```json
{ "scheduled_publish_time": "2026-12-04T09:00:00+08:00", "expected_scheduled_publish_time": "2026-12-01T09:00:00+08:00" }
```

- **响应 200**：

```json
{ "code": 0, "message": "OK", "data": { "id": 104, "status": "SCHEDULED", "scheduled_publish_time": "2026-12-04T09:00:00+08:00" } }
```

- **错误**：`404`、`400 PARAM_INVALID`（缺字段、不带偏移）、`400 SCHEDULE_TIME_INVALID`（新时间 ≤ 当前时间）、`409 STATE_CONFLICT`（不是待发布、并发使前提失效、`expected_*` 不一致）、`409 SCHEDULE_ALREADY_DUE`（原预定时间已到达）、`401`、`403`。
- **覆盖需求**：FR-SUBMIT-003、BR-PUB-008、§5.5、§5.6。

> 「先 400 还是先 409」：若新时间不合法、同时原时间已到达，按 §2.3 的顺序先返回 400（请求格式问题）。见 §16 问题 6。

---

## 7 审核模块（REVIEW / PUBLISH）

> 不存在任何「发布」接口或「发布」参数（BR-PUB-001、§4.6 第 4 条）。发布只有两条路径：审核通过时立即发布（由 §7.3 同步完成），以及到期自动发布（§12 系统任务）。也不存在「恢复上线」接口（§4.6 第 5 条）。

### 7.1 `GET /api/reviews/queue` 审核队列

- **说明**：列出所有 `PENDING_REVIEW` 文章，按 `submitted_at` 升序（先提交先审），提交时间相同按文章 ID 升序，固定排序、不可改。查看正文与媒体用 §6.3。
- **权限**：仅 ADMIN；编辑调用返回 404。
- **查询参数**：`page`、`page_size`（§1.5）；可选 `category_id`、`tag_ids`（交集）、`author_id`、`title`（与 BR-SEARCH-001 一致的结构化筛选）。
- **响应 200**：分页对象，`items` 为 `ReviewQueueItem[]`。

```json
{
  "code": 0, "message": "OK",
  "data": {
    "items": [
      {
        "id": 102, "title": "Vue 3 组合式 API 笔记",
        "author": { "id": 12, "username": "zhangsan" },
        "category": { "id": 4, "name": "前端" },
        "tags": [ { "id": 11, "name": "Vue" } ],
        "submitted_at": "2026-11-14T16:05:00+08:00",
        "scheduled_publish_time": "2026-12-01T09:00:00+08:00",
        "current_submission_id": 9031
      }
    ],
    "page": 1, "page_size": 20, "total": 1
  }
}
```

- **错误**：`401`、`404`（编辑调用）。
- **覆盖需求**：FR-REVIEW-001、BR-SEARCH-001、BR-CONTENT-001。

### 7.2 `GET /api/reviews/standard` 当前审核标准与驳回类别【补充】

- **说明**：返回当前审核标准版本和驳回类别字典，供审核页展示。审核标准版本由服务端配置，审核请求**不**由客户端传入，由服务端写入留痕。
- **权限**：仅 ADMIN。
- **响应 200**：

```json
{
  "code": 0, "message": "OK",
  "data": {
    "review_standard_version": "CMS-CONTENT-REVIEW-1.0",
    "reject_categories": [
      { "value": "ILLEGAL", "label": "违法违规" },
      { "value": "AUTHENTICITY_SOURCE", "label": "真实性／来源" },
      { "value": "COPYRIGHT_PRIVACY", "label": "版权／隐私" },
      { "value": "MINOR_VULGAR_VIOLENCE", "label": "未成年人／低俗／暴力" },
      { "value": "DISCRIMINATION_HARASSMENT", "label": "歧视／骚扰／引战" },
      { "value": "SPAM_MARKETING", "label": "垃圾／营销" },
      { "value": "QUALITY_POSITIONING", "label": "内容质量／博客定位" },
      { "value": "OTHER", "label": "其他" }
    ]
  }
}
```

- **错误**：`401`、`404`（编辑调用）。
- **覆盖需求**：§6.1.1、BR-CONTENT-005（支撑 FR-REVIEW-003 的类别选择）。

### 7.3 `POST /api/articles/{id}/approve` 审核通过

- **说明**：按审核标准通过当前这一轮提交。服务端在**同一次原子操作**内完成：校验状态与轮次 → 判断预定时间 → 写状态、`published_at` 和留痕。
  - 未设预定时间，或预定时间已到达或已过 → `PUBLISHED`，`published_at` = 审核通过时间（不顺延）。
  - 预定时间在未来 → `SCHEDULED`，`published_at` 不变。
  - 留痕：`APPROVE`，关联本轮提交留痕，记录审核标准版本；立即发布时还记录实际发布时间。
- **权限**：仅 ADMIN；需要 CSRF。
- **请求体**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `submission_id` | int64 | 是 | 管理员实际查看的提交轮次标识（来自详情或队列的 `current_submission_id`） |

请求体中出现其他字段（如 `publish`、`title`、`content`）→ `400 FIELD_NOT_WRITABLE`。审核接口不接受任何内容字段，也不接受「发布」动作参数。

```json
{ "submission_id": 9031 }
```

- **响应 200**：

```json
{ "code": 0, "message": "OK", "data": { "id": 102, "status": "PUBLISHED", "published_at": "2026-11-15T15:20:00+08:00", "scheduled_publish_time": null } }
```

或

```json
{ "code": 0, "message": "OK", "data": { "id": 102, "status": "SCHEDULED", "published_at": null, "scheduled_publish_time": "2026-12-01T09:00:00+08:00" } }
```

- **错误**：`404`（不存在、编辑调用）、`400 SUBMISSION_ID_INVALID`、`400 FIELD_NOT_WRITABLE`、`409 STATE_CONFLICT`（不是待审核）、`409 SUBMISSION_STALE`（轮次已变化）、`401`、`403`。任何失败都不产生审核结论、状态变化或留痕。
- **覆盖需求**：FR-REVIEW-002、FR-PUBLISH-001、FR-PUBLISH-003、BR-003、BR-010、BR-PUB-001、BR-PUB-003、BR-PUB-005～007、BR-CONTENT-001～005、BR-AUDIT-005、X-STATE-02、§5.6；TU-11、TU-14、TU-14b。

### 7.4 `POST /api/articles/{id}/reject` 驳回

- **说明**：`PENDING_REVIEW` → `REJECTED`，必须选择驳回类别并填写意见。生成 `REJECT` 留痕，记录类别、意见、本轮提交和审核标准版本。质量或定位问题不得标为 `ILLEGAL`（属于审核员的业务约束，服务端无法判定）。
- **权限**：仅 ADMIN；需要 CSRF。
- **请求体**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `submission_id` | int64 | 是 | 同 §7.3 |
| `reject_category` | RejectCategory | 是 | 8 类之一 |
| `comment` | string | 是 | 驳回意见；空字符串或纯空格视为缺失 |

```json
{ "submission_id": 9031, "reject_category": "QUALITY_POSITIONING", "comment": "正文缺少实际案例" }
```

- **响应 200**：`{ "code": 0, "message": "OK", "data": { "id": 102, "status": "REJECTED" } }`
- **错误**：`404`、`400 SUBMISSION_ID_INVALID`、`400 REJECT_CATEGORY_INVALID`、`400 REASON_REQUIRED`、`409 STATE_CONFLICT`、`409 SUBMISSION_STALE`、`401`、`403`。失败时状态和留痕都不变。
- **覆盖需求**：FR-REVIEW-003、BR-004、BR-CONTENT-005、BR-AUDIT-003、BR-AUDIT-005；TU-11、TU-15；§4.6 第 2、13 条。

### 7.5 `POST /api/articles/{id}/unpublish` 下架

- **说明**：`PUBLISHED` → `UNPUBLISHED`，必须填写下架原因。生成 `UNPUBLISH` 留痕，记录原因和审核标准版本。下架后公开接口和媒体出口**立即**不再返回该文章及其媒体；`published_at` 保留上次取值。
- **权限**：仅 ADMIN；需要 CSRF。
- **请求体**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `reason` | string | 是 | 空字符串或纯空格视为缺失 |

```json
{ "reason": "技术结论已过期，需更新" }
```

- **响应 200**：`{ "code": 0, "message": "OK", "data": { "id": 101, "status": "UNPUBLISHED" } }`
- **错误**：`404`、`400 REASON_REQUIRED`、`409 STATE_CONFLICT`（不是已发布）、`401`、`403`。
- **覆盖需求**：FR-REVIEW-004、BR-008、BR-011、BR-AUDIT-003、BR-AUDIT-005；TU-10、TU-11、TU-15；§4.6 第 3、13 条。

---

## 8 留痕模块（AUDIT）

### 8.1 `GET /api/articles/{id}/audit-logs` 查看文章留痕

- **说明**：按 `operated_at` 正序返回该文章全部留痕（同一时间按 ID 正序）。不分页（单篇留痕数量有限）。**不存在任何修改或删除留痕的接口。**
- **权限**：EDITOR（仅本人文章）、ADMIN（全部）。
- **响应 200**：

```json
{
  "code": 0, "message": "OK",
  "data": [
    { "id": 9001, "article_id": 104, "action": "SUBMIT",
      "operator": { "type": "USER", "id": 12, "username": "zhangsan" },
      "operated_at": "2026-09-28T16:00:00+08:00",
      "reason": null, "reject_category": null, "review_standard_version": null,
      "published_at": null, "schedule_change": null,
      "related_approval_id": null, "related_submission_id": null },
    { "id": 9002, "article_id": 104, "action": "APPROVE",
      "operator": { "type": "USER", "id": 1, "username": "admin" },
      "operated_at": "2026-09-28T16:20:00+08:00",
      "reason": null, "reject_category": null, "review_standard_version": "CMS-CONTENT-REVIEW-1.0",
      "published_at": null, "schedule_change": null,
      "related_approval_id": null, "related_submission_id": 9001 },
    { "id": 9003, "article_id": 104, "action": "RESCHEDULE",
      "operator": { "type": "USER", "id": 12, "username": "zhangsan" },
      "operated_at": "2026-09-29T11:00:00+08:00",
      "reason": null, "reject_category": null, "review_standard_version": null,
      "published_at": null,
      "schedule_change": { "from": "2026-10-01T09:00:00+08:00", "to": "2026-10-04T09:00:00+08:00" },
      "related_approval_id": null, "related_submission_id": null },
    { "id": 9004, "article_id": 104, "action": "AUTO_PUBLISH",
      "operator": { "type": "SYSTEM", "id": null, "username": null },
      "operated_at": "2026-10-04T09:00:12+08:00",
      "reason": null, "reject_category": null, "review_standard_version": null,
      "published_at": "2026-10-04T09:00:12+08:00", "schedule_change": null,
      "related_approval_id": 9002, "related_submission_id": null }
  ]
}
```

- **错误**：`401`、`404`（不存在、他人文章）。
- **覆盖需求**：FR-AUDIT-002、BR-AUDIT-001～004、BR-ISO-001、X-AUDIT-02、X-AUDIT-03；TU-08；§4.6 第 9 条。

---

## 9 分类与标签模块（TAX）

通用规则：
- 分类或标签只要被**任意状态**的文章引用，就不能改名或删除，返回 `409 TAXONOMY_IN_USE`（管理员也一样）。
- 引用保护判定与改名、删除、文章关联保存在同一并发一致性约束下执行；删除分类不会把文章分类置空，也不会级联删除文章。
- 名称：去首尾空白后 1～50 个字符，不允许全空白。【补充：长度、去空白、重名处理见 §16】

### 9.1 `GET /api/categories` 分类列表

- **说明**：返回全部分类（数量有限，不分页），编辑写文章时选择分类、管理员维护分类都用它。
- **权限**：已登录（EDITOR、ADMIN）。
- **响应 200**：

```json
{ "code": 0, "message": "OK", "data": [ { "id": 3, "name": "后端", "in_use": true, "created_at": "2026-10-20T10:00:00+08:00", "updated_at": "2026-10-20T10:00:00+08:00" } ] }
```

- **错误**：`401`。
- **覆盖需求**：FR-TAX-001、FR-TAX-003（选择分类的前置查询，【补充】）、BR-TAX-003。

### 9.2 `POST /api/categories` 创建分类

- **权限**：仅 ADMIN；编辑调用 404。需要 CSRF。
- **请求体**：`{ "name": "后端" }`
- **响应 201**：`data` 为 `Category`。
- **错误**：`400 PARAM_INVALID`、`409 NAME_DUPLICATE`【补充】、`401`、`403`、`404`（编辑）。
- **覆盖需求**：FR-TAX-001、BR-TAX-005。

### 9.3 `PUT /api/categories/{id}` 修改分类名称

- **权限**：仅 ADMIN；需要 CSRF。
- **请求体**：`{ "name": "服务端" }`
- **响应 200**：`data` 为 `Category`。
- **错误**：`404`（不存在、编辑调用）、`400 PARAM_INVALID`、`409 TAXONOMY_IN_USE`、`409 NAME_DUPLICATE`、`401`、`403`。
- **覆盖需求**：FR-TAX-001、BR-TAX-004、BR-TAX-005；TU-18。

### 9.4 `DELETE /api/categories/{id}` 删除分类

- **权限**：仅 ADMIN；需要 CSRF。
- **响应 200**：`data: null`。
- **错误**：`404`、`409 TAXONOMY_IN_USE`、`401`、`403`。
- **覆盖需求**：FR-TAX-001、BR-TAX-004、BR-TAX-005；TU-18。

### 9.5 `GET /api/tags` 标签列表

- **说明**：返回标签列表，支持按名称模糊搜索（编辑器里的标签输入联想）。【补充：分页与搜索参数】
- **权限**：已登录。
- **查询参数**：`keyword`（可选，名称模糊匹配）、`page`、`page_size`。
- **响应 200**：分页对象，`items` 为 `Tag[]`。
- **错误**：`401`。
- **覆盖需求**：FR-TAX-002、FR-TAX-003（前置查询，【补充】）。

### 9.6 `POST /api/tags` 创建标签

- **权限**：EDITOR、ADMIN；需要 CSRF。标签全局共享。
- **请求体**：`{ "name": "Spring" }`
- **响应 201**：`data` 为 `Tag`。
- **错误**：`400 PARAM_INVALID`、`409 NAME_DUPLICATE`【补充】、`401`、`403`。
- **覆盖需求**：FR-TAX-002、BR-TAX-003、BR-TAX-005、BR-SEARCH-006。

### 9.7 `PUT /api/tags/{id}` 修改标签名称

- **权限**：EDITOR、ADMIN，不限创建人；需要 CSRF。
- **请求体**：`{ "name": "Spring Boot" }`
- **响应 200**：`data` 为 `Tag`。
- **错误**：`404`（不存在）、`400`、`409 TAXONOMY_IN_USE`、`409 NAME_DUPLICATE`、`401`、`403`。
- **覆盖需求**：FR-TAX-002、BR-TAX-004、BR-TAX-005；TU-18。

### 9.8 `DELETE /api/tags/{id}` 删除标签

- **权限**：EDITOR、ADMIN，不限创建人；需要 CSRF。
- **响应 200**：`data: null`。
- **错误**：`404`、`409 TAXONOMY_IN_USE`、`401`、`403`。
- **覆盖需求**：FR-TAX-002、BR-TAX-004、BR-TAX-005；TU-18。

---

## 10 媒体模块（MEDIA）

### 10.1 `POST /api/articles/{id}/media` 上传媒体

- **说明**：向本人的文章上传一个封面图、正文图片或音频文件。上传后的资源**还未关联**（`linked: false`），需要再调用 §6.4（设置 `cover_media_id` / `audio_media_id`，或在正文里引用 `/api/media/{media_id}`）完成关联。上传满 24 小时仍未关联的文件会被系统清理。
- **权限**：仅归属 EDITOR，文章状态为 `DRAFT` / `REJECTED` / `UNPUBLISHED`；需要 CSRF。
- **请求**：`multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `file` | binary | 是 | 文件本体 |
| `usage` | MediaUsage | 是 | `COVER` / `INLINE_IMAGE` / `AUDIO` |

- **服务端校验**：
  - 按文件签名（魔数）判定真实格式；扩展名和 `Content-Type` 只作辅助。真实格式不在该用途的白名单内，或与扩展名、`Content-Type` 声明不一致 → `400 MEDIA_TYPE_INVALID`。
  - 图片 ≤ 5 MB，音频 ≤ 20 MB（等于上限可以通过，超 1 字节拒绝）→ 否则 `400 MEDIA_TOO_LARGE`。
  - 失败时不落盘、不创建资源记录。
  - 存储文件名和响应类型以服务端判定结果为准，不采用用户的文件名和扩展名。
- **响应 201**：

```json
{
  "code": 0, "message": "OK",
  "data": { "media_id": 5001, "article_id": 102, "usage": "INLINE_IMAGE", "url": "/api/media/5001",
            "mime_type": "image/png", "size": 230411, "linked": false, "created_at": "2026-11-14T15:00:00+08:00" }
}
```

- **错误**：`404`（文章不存在、他人文章、管理员调用）、`409 STATE_CONFLICT`（待审核、待发布、已发布）、`400 PARAM_INVALID`（缺 `file` 或 `usage`）、`400 MEDIA_TYPE_INVALID`、`400 MEDIA_TOO_LARGE`、`401`、`403`。
- **覆盖需求**：FR-MEDIA-001、BR-MEDIA-001、BR-MEDIA-002、BR-MEDIA-005、BR-MEDIA-008；TU-19、TU-23。

### 10.2 `GET /api/media/{media_id}` 媒体文件出口

- **说明**：所有封面图、正文图片、音频的**唯一出口**，匿名可访问。
- **权限判定**：

| 情形 | 匿名 / 其他编辑 | 归属编辑 / 管理员 |
|---|---|---|
| 已关联到当前引用，文章为 `PUBLISHED` | 可读 | 可读 |
| 已关联到当前引用，文章为其他 5 种状态 | 404 | 可读 |
| 已上传但从未关联 | 404 | 可读 |
| 已被移除或替换、失去全部当前引用，或文章已删除（即使文件尚未清理） | 404 | 404 |
| 资源不存在 | 404 | 404 |

- **响应 200**：文件字节流。`Content-Type` 为服务端判定的真实类型；建议加 `X-Content-Type-Options: nosniff`。**不加任何缓存头**（`Cache-Control: no-store`），确保下架后立即失效（architecture §4.3）。音频建议支持 `Range` 请求（206）。【补充】
- **拒绝**：**一律 404**，响应与资源不存在完全一致；**不返回 401、403 或 409**。
- **覆盖需求**：FR-MEDIA-002、BR-MEDIA-003、BR-MEDIA-004、BR-ISO-004；TU-09、TU-10、TU-21；§4.6 第 11 条；§9.1 第 3 条。

---

## 11 公开内容模块（PUBLIC）

通用规则：
- 匿名可访问，只读，不需要 CSRF。
- 服务端强制只返回 `PUBLISHED`；**不接受任何影响可见性的参数**，未知参数（如 `status`、`author_id`）直接忽略。
- 只返回 §4.14 白名单字段。
- 下架后立即不再返回。

### 11.1 `GET /api/public/articles` 已发布文章列表

- **查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `page`、`page_size` | integer | 否 | 见 §1.5 |
| `category_id` | int64 | 否 | 按分类筛选 |
| `tag_ids` | int64[] | 否 | 多值，**交集语义** |

默认按 `published_at` 降序，同时间按 `id` 降序。【补充：排序】

- **响应 200**：

```json
{
  "code": 0, "message": "OK",
  "data": {
    "items": [
      { "id": 101, "title": "Spring Boot 入门教程", "excerpt": "",
        "cover_url": "/api/media/4000",
        "category": { "id": 3, "name": "后端" },
        "tags": [ { "id": 7, "name": "Spring" } ],
        "published_at": "2026-09-28T15:20:00+08:00" }
    ],
    "page": 1, "page_size": 20, "total": 1
  }
}
```

- **错误**：`400 PARAM_INVALID`（分页参数类型错误）。标签组合没有结果时返回空列表，不报错。
- **覆盖需求**：FR-PUBLIC-001、BR-ISO-004、BR-SEARCH-005、X-ISO-02；§4.6 第 10 条。

### 11.2 `GET /api/public/articles/{id}` 已发布文章详情

- **响应 200**：

```json
{
  "code": 0, "message": "OK",
  "data": {
    "id": 101, "title": "Spring Boot 入门教程", "excerpt": "",
    "cover_url": "/api/media/4000",
    "category": { "id": 3, "name": "后端" },
    "tags": [ { "id": 7, "name": "Spring" } ],
    "published_at": "2026-09-28T15:20:00+08:00",
    "content": "# 简介\n\n![示意图](/api/media/4001)\n\n视频：[演示](https://www.youtube.com/watch?v=xxxx)",
    "audio_url": null
  }
}
```

- **错误**：`404 NOT_FOUND`，文章不存在或不是已发布状态时**响应完全相同**。
- **覆盖需求**：FR-PUBLIC-002、BR-ISO-004、BR-MEDIA-003、BR-MEDIA-005；TU-16、TU-21；§4.6 第 10 条。

---

## 12 系统任务（无对外接口）

以下需求由后台任务完成，**不提供 HTTP 接口**（尤其不提供手动触发发布的接口）。接口层可观察到的效果如下，前后端联调时据此验证。

| 需求 | 行为 | 接口层可观察效果 |
|---|---|---|
| FR-PUBLISH-002 到期自动发布 | 定时扫描 `SCHEDULED` 且预定时间已到、审核结论仍有效的文章；到期后 60 秒内发布；服务恢复后补处理；重入不重复发布、不覆盖同一周期的 `published_at` | 文章变为 `PUBLISHED`；`published_at` 为真正发布时刻；留痕新增 `AUTO_PUBLISH`（操作人 `SYSTEM`，带 `published_at` 和 `related_approval_id`）；公开接口开始返回 |
| FR-PUBLISH-001 / 003 | 由 §7.3 审核通过请求同步完成，不是独立任务 | 见 §7.3 响应 |
| FR-MEDIA-003 媒体清理 | 清理被移除、替换或所属文章已删除的媒体文件；未关联上传满 24 小时后 60 秒内清理；清理前再次确认未被关联；失败记录并自动重试 | 被移除或替换的媒体在 §10.2 立即返回 404；未关联媒体超时后返回 404 |
| FR-AUDIT-001 留痕自动生成 | 7 类流程事件与流程结果同一事务写入；删除从未提交的草稿不生成留痕 | §8.1 能查到对应留痕 |

---

## 13 接口总表

| # | 模块 | 方法 | 路径 | 说明 | 权限 | 标记 |
|---|---|---|---|---|---|---|
| 1 | AUTH | GET | `/api/auth/csrf` | 获取 CSRF 令牌 | 匿名 | 【补充】 |
| 2 | AUTH | POST | `/api/auth/register` | 注册内容编辑 | 匿名 + CSRF | |
| 3 | AUTH | POST | `/api/auth/login` | 登录 | 匿名 | |
| 4 | AUTH | POST | `/api/auth/logout` | 登出 | 已登录 + CSRF | |
| 5 | AUTH | GET | `/api/auth/me` | 当前用户 | 已登录 | |
| 6 | ARTICLE | GET | `/api/articles` | 文章列表（我的 / 全部） | 编辑、管理员 | |
| 7 | ARTICLE | POST | `/api/articles` | 创建草稿 | 编辑 | |
| 8 | ARTICLE | GET | `/api/articles/{id}` | 文章详情 | 归属编辑、管理员 | |
| 9 | ARTICLE | PUT | `/api/articles/{id}` | 编辑文章（含分类、标签、媒体关联） | 归属编辑 | |
| 10 | ARTICLE | DELETE | `/api/articles/{id}?confirm=true` | 删除草稿 | 归属编辑 | |
| 11 | SUBMIT | POST | `/api/articles/{id}/submit` | 提交审核 | 归属编辑 | |
| 12 | SUBMIT | POST | `/api/articles/{id}/withdraw` | 撤回待发布 | 归属编辑 | |
| 13 | SUBMIT | POST | `/api/articles/{id}/reschedule` | 改期 | 归属编辑 | |
| 14 | REVIEW | GET | `/api/reviews/queue` | 审核队列 | 管理员 | |
| 15 | REVIEW | GET | `/api/reviews/standard` | 审核标准与驳回类别 | 管理员 | 【补充】 |
| 16 | REVIEW | POST | `/api/articles/{id}/approve` | 审核通过（含立即发布） | 管理员 | |
| 17 | REVIEW | POST | `/api/articles/{id}/reject` | 驳回 | 管理员 | |
| 18 | REVIEW | POST | `/api/articles/{id}/unpublish` | 下架 | 管理员 | |
| 19 | AUDIT | GET | `/api/articles/{id}/audit-logs` | 文章留痕 | 归属编辑、管理员 | |
| 20 | TAX | GET | `/api/categories` | 分类列表 | 已登录 | |
| 21 | TAX | POST | `/api/categories` | 创建分类 | 管理员 | |
| 22 | TAX | PUT | `/api/categories/{id}` | 修改分类名称 | 管理员 | |
| 23 | TAX | DELETE | `/api/categories/{id}` | 删除分类 | 管理员 | |
| 24 | TAX | GET | `/api/tags` | 标签列表 | 已登录 | |
| 25 | TAX | POST | `/api/tags` | 创建标签 | 编辑、管理员 | |
| 26 | TAX | PUT | `/api/tags/{id}` | 修改标签名称 | 编辑、管理员 | |
| 27 | TAX | DELETE | `/api/tags/{id}` | 删除标签 | 编辑、管理员 | |
| 28 | MEDIA | POST | `/api/articles/{id}/media` | 上传媒体 | 归属编辑 | |
| 29 | MEDIA | GET | `/api/media/{media_id}` | 媒体文件出口 | 匿名（按文章状态判权） | |
| 30 | PUBLIC | GET | `/api/public/articles` | 已发布文章列表 | 匿名 | |
| 31 | PUBLIC | GET | `/api/public/articles/{id}` | 已发布文章详情 | 匿名 | |

**合计 31 个接口**：AUTH 5、ARTICLE 5、SUBMIT 3、REVIEW 5、AUDIT 1、TAX 8、MEDIA 2、PUBLIC 2。

### 13.1 权限矩阵对照（SRS §4.5 → 接口）

| SRS 动作 | 接口 | 编辑（本人） | 编辑（他人） | 管理员 |
|---|---|---|---|---|
| 创建文章 | #7 | ✓ | — | 404 |
| 读取详情 | #8 | ✓ | 404 | ✓ |
| 列表、筛选、计数 | #6 | 仅本人结果集 | — | 全部 |
| 编辑内容 | #9 | 草稿、驳回、已下架，否则 409 | 404 | 404 |
| 删除 | #10 | 仅无留痕草稿，否则 409 | 404 | 404 |
| 提交审核 | #11 | 草稿、驳回、已下架，否则 409 | 404 | 404 |
| 撤回 | #12 | 仅待发布，否则 409 | 404 | 404 |
| 改期 | #13 | 仅待发布，否则 409 | 404 | 404 |
| 审核通过 / 驳回 | #16 / #17 | 404 | 404 | 仅待审核，否则 409 |
| 下架 | #18 | 404 | 404 | 仅已发布，否则 409 |
| 查看留痕 | #19 | ✓ | 404 | ✓ |
| 上传、关联、移除、替换媒体 | #28、#9 | 草稿、驳回、已下架，否则 409 | 404 | 404 |
| 访问媒体 | #29 | ✓（含未发布） | 仅已发布文章的当前引用 | ✓ |
| 创建分类 | #21 | 404 | 404 | ✓ |
| 修改、删除分类 | #22、#23 | 404 | 404 | 仅未被引用，否则 409 |
| 创建标签 | #25 | ✓ | ✓ | ✓ |
| 修改、删除标签 | #26、#27 | 仅未被引用，否则 409 | 同左 | 同左 |
| 管理用户与角色 | 无接口 | — | — | — |
| 发布文章 | **无接口** | — | — | — |

---

## 14 需求追溯表

### 14.1 功能需求 → 接口

| 需求 | 交付范围 | 承接接口 / 机制 |
|---|---|---|
| FR-AUTH-001 登录 | 本期 | #3 |
| FR-AUTH-002 登出 | 本期 | #4；会话失效后任意后台接口 401 |
| FR-AUTH-003 Cookie 与 CSRF | 本期 | #1、#3、§2 |
| FR-AUTH-004 未认证 401 与匿名入口 | 本期 | 全部后台接口（§2.3），匿名入口 #1～#3、#29～#31 |
| FR-AUTH-005 按角色分流 | 本期 | #5 |
| FR-USER-001 编辑注册 / 管理员初始化 | 本期 | #2；管理员由数据库初始化，无接口 |
| FR-USER-002 修改角色 | 后续 | 无（§5.6） |
| FR-USER-003 停用启用 | 后续 | 无（§5.6） |
| FR-USER-004 密码找回 | 不做 | 无，且不得提供 |
| FR-USER-005 改派归属 | 后续 | 无（§5.6） |
| FR-ARTICLE-001 创建草稿 | 本期 | #7 |
| FR-ARTICLE-002 编辑文章 | 本期 | #9 |
| FR-ARTICLE-003 我的文章列表 | 本期 | #6（编辑） |
| FR-ARTICLE-004 文章详情 | 本期 | #8 |
| FR-ARTICLE-005 删除草稿 | 本期 | #10 |
| FR-ARTICLE-006 全部文章列表 | 本期 | #6（管理员） |
| FR-SUBMIT-001 提交审核 | 本期 | #11 |
| FR-SUBMIT-002 撤回 | 本期 | #12 |
| FR-SUBMIT-003 改期 | 本期 | #13 |
| FR-REVIEW-001 审核队列 | 本期 | #14、#8 |
| FR-REVIEW-002 审核通过 | 本期 | #16（#15 辅助） |
| FR-REVIEW-003 驳回 | 本期 | #17（#15 辅助） |
| FR-REVIEW-004 下架 | 本期 | #18 |
| FR-PUBLISH-001 立即发布 | 本期 | #16 同步完成 |
| FR-PUBLISH-002 到期自动发布 | 本期 | 系统任务（§12），无接口 |
| FR-PUBLISH-003 写入实际发布时间 | 本期 | #16 + 系统任务 |
| FR-TAX-001 分类 | 本期 | #20～#23 |
| FR-TAX-002 标签 | 本期 | #24～#27 |
| FR-TAX-003 为文章设分类标签 | 本期 | #7、#9（#20、#24 辅助） |
| FR-MEDIA-001 上传与关联 | 本期 | #28 上传；#9 关联、移除、替换 |
| FR-MEDIA-002 媒体访问控制 | 本期 | #29 |
| FR-MEDIA-003 媒体清理 | 本期 | 系统任务（§12），无接口 |
| FR-MEDIA-004 正文链接校验 | 本期 | #7、#9（§6.0） |
| FR-AUDIT-001 留痕自动生成 | 本期 | #11、#12、#13、#16、#17、#18 + 系统任务 |
| FR-AUDIT-002 查看留痕 | 本期 | #19 |
| FR-PUBLIC-001 公开列表 | 本期 | #30 |
| FR-PUBLIC-002 公开详情 | 本期 | #31 |

37 条功能需求全部有归属：33 条本期需求由接口或系统任务承接，4 条（FR-USER-002～005）按 SRS 不设计接口。

### 14.2 横切需求 → 接口

| 需求 | 承接方式 |
|---|---|
| X-ISO-01 数据层归属条件 | #6、#8～#13、#19、#28 由服务端按当前用户附加归属；#29、#30、#31 按各自规则 |
| X-ISO-02 全部查询入口隔离 | #6、#8、#14、#19；公开接口强制已发布；媒体出口独立判权 |
| X-ISO-03 计数基于过滤后结果 | §1.5 分页规则；#6、#14、#30 |
| X-ISO-04 统一 404 与空列表 | §3.2 |
| X-STATE-01 不得直接写状态 | 无写状态接口；`status` 字段写入即 400（§1.2） |
| X-STATE-02 发布只有两条路径 | #16 + 系统任务；无发布接口 |
| X-AUDIT-01 七类留痕 | §12、§8 |
| X-AUDIT-02 留痕不可改删 | 无修改、删除留痕接口 |
| X-AUDIT-03 留痕查询受隔离 | #19 |

### 14.3 必须失败的组合（SRS §4.6）→ 接口行为

| # | 组合 | 接口与预期 |
|---|---|---|
| 1 | 编辑使文章进入已发布 | 无此接口；#9 带 `status` → 400 |
| 2 | 编辑审核通过或驳回 | #16、#17 → 404 |
| 3 | 编辑下架 | #18 → 404 |
| 4 | 管理员手动发布 | 无此接口 |
| 5 | 已下架直接恢复为已发布 | 无此接口；#16 对已下架 → 409 |
| 6 | 管理员编辑他人内容 | #9 → 404 |
| 7 | 管理员删除他人草稿 | #10 → 404 |
| 8 | 编辑读写删他人文章 | #8、#9、#10 → 404 |
| 9 | 编辑读他人留痕 | #19 → 404 |
| 10 | 匿名读非已发布正文 | #31 → 404 |
| 11 | 匿名读非已发布媒体 | #29 → 404 |
| 12 | 直接提交状态字段 | #7、#9 → 400 FIELD_NOT_WRITABLE |
| 13 | 驳回或下架原因为空 | #17、#18 → 400 REASON_REQUIRED |
| 14 | 删除非草稿或撤回过的草稿 | #10 → 409 |
| 15 | 重复提交审核 | #11 → 409 |
| 16 | 通过筛选或计数推断他人文章 | #6 只算本人结果集 |
| 17 | 正文含 HTML、外部图片、危险协议 | #7、#9 → 400 CONTENT_REJECTED |

---

## 15 与现有文档的冲突

| # | 冲突 | 本规范的处理 |
|---|---|---|
| 1 | 本次任务描述建议「JWT / Token 请求头鉴权」，但 SRS FR-AUTH-003、§4.1.2 要求 httpOnly Cookie 会话、服务端销毁会话、会话固定防护；architecture §5.1 明确否决 JWT | **按 SRS 用 Cookie 会话 + CSRF**，不用 JWT |
| 2 | 本次任务描述建议基础路径 `/api/v1`，architecture §5.1～5.5 已定 `/api/auth/*`、`/api/public/**`、`/api/media/{mediaId}` | 沿用 `/api`，不加版本号。如需版本化，整体换成 `/api/v1` 即可，不影响其他设计 |
| 3 | architecture §6.1 到期发布 SQL 曾带 `published_at IS NULL`，INV-07 曾写「一旦非空永不被覆盖」；与 SRS §5.5、BR-PUB-006 冲突 | **已按 SRS 对齐（2026-11-16）**：去掉该条件；同周期靠状态门闩 + 无发布留痕防重复；跨周期允许更新 `published_at` |
| 4 | architecture §6.2 曾写孤儿文件「超过 N 天」才清理；与 BR-MEDIA-004 的 24 小时／60 秒口径冲突 | **已按 SRS 对齐（2026-11-16）**：见 architecture §6.2 与本文 §12 |
| 5 | architecture §5.4 曾在「已发布即回写」前未区分从未关联／已失去引用；与 FR-MEDIA-002 冲突 | **已按 SRS 对齐（2026-11-16）**：见 architecture §5.4 与本文 §10.2 |
| 6 | architecture §5.1 曾用 `CookieCsrfTokenRepository`；SRS §4.1.2 要求会话绑定令牌 | **已按 SRS 对齐（2026-11-16）**：改为 `HttpSessionCsrfTokenRepository`，由 `#1` 下发；接口仍用 `X-XSRF-TOKEN` |
| 7 | `project-overview.md` 写「公开文章接口支持按状态、分类、标签、归属编辑筛选及标题模糊匹配」；SRS FR-PUBLIC-001 只规定分页和分类、标签筛选，并禁止任何状态参数 | 按 SRS，公开接口只有分类和标签筛选 |
| 8 | `project-overview.md` 写留痕只有 6 类（缺「到期自动发布」）；SRS §6.6 为 7 类 | 按 SRS，7 类 |
| 9 | architecture §4.1 规定 `article.status` 存中文字面量 | 数据库存中文不影响接口；接口用英文枚举，由后端映射（§4.1） |

---

## 16 待确认问题

| # | 问题 | 本规范的暂定处理 |
|---|---|---|
| 1 | 草稿能否缺少标题、正文、分类？SRS §7.2 标为必填，FR-ARTICLE-002 规定编辑时缺失返回 400；但 FR-SUBMIT-001 又有「必填内容缺失返回 400」，暗示草稿可能不完整 | 创建和编辑都要求三项必填；提交时再查一次（`ARTICLE_INCOMPLETE` 基本不会触发） |
| 2 | 分类、标签名称的长度、是否去首尾空白、是否允许重名、重名是否区分大小写 | 去首尾空白，1～50 字符，同类内不区分大小写去重，重名 409 |
| 3 | 标题、摘要、正文长度上限；每篇标签数量上限 | 未设上限，建议标题 ≤ 200、摘要 ≤ 500、正文 ≤ 1 MB |
| 4 | 博客前台导航需要分类列表（BR-TAX-003「用于前台导航与面包屑」），但公开白名单只定义了文章列表和详情两个出口 | **未提供**公开分类、标签列表接口。如需要，建议新增 `GET /api/public/categories`（只返回 ID 和名称），需 SRS 确认 |
| 5 | 接口层状态等枚举用英文还是中文；JSON 字段用 snake_case 还是 camelCase | 英文枚举 + snake_case |
| 6 | 400 和 409 同时成立时谁优先（如对待审核文章提交一个空标题的编辑） | 角色、归属 404 → 请求格式 400 → 状态 409（§2.3）；删除的二次确认按 SRS 放在 409 之后 |
| 7 | 登录名存储与返回是保留原样（去空白后）还是统一小写 | 统一小写返回 |
| 8 | 后台文章列表的默认排序（SRS 只规定了审核队列的排序） | `updated_at` 降序；公开列表 `published_at` 降序 |
| 9 | 正文里怎样认定一个链接是「视频链接」？SRS 要求视频链接必须是绝对 https、相对路径的视频链接要拒绝，但又允许普通链接用站内相对地址，而 Markdown 语法上两者没有区别 | 暂按普通链接规则校验。建议约定：指向非本站的链接都视为外链（必须 https），站内相对地址只允许 `/api/media/` 以外的站内页面；或约定视频用专门语法（如 `[video](https://...)`），需团队确认 |
| 10 | 公开详情里的「正文图片引用、正文视频链接」是否需要单独字段 | 只包含在 `content` 原文中，不单独抽出 |
| 11 | 是否需要文章编辑的乐观锁（两个标签页同时编辑同一篇文章，后写覆盖前写） | 未加。可选方案：请求带 `expected_updated_at`，不一致返回 409 |
| 12 | 权限矩阵里的「计数」是否需要单独接口（如按状态统计数量的标签页角标） | 只用列表的 `total`；如需按状态计数，可加 `GET /api/articles/counts`，同样受归属过滤 |
| 13 | 编辑是否应看到分类、标签的 `in_use` | 返回布尔值不返回计数；编辑本来就能通过 409 得知是否被引用 |
| 14 | 审核标准版本从哪里配置、怎样升级 | 服务端配置项，#15 只读展示 |
| 15 | 正文图片引用是否允许同一篇文章里重复引用同一个媒体 | 允许 |
| 16 | 管理员能否按状态等条件筛选审核队列以外的列表 | 可以，#6 对管理员开放全部筛选 |
