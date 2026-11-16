# AGENTS.md — AI 协作指引

本文件写给在本仓库里工作的 AI 编码助手（Cursor、Claude Code、Codex、Copilot 等）。人类成员也可以把它当作速查表。
动手之前请完整读完本文件；与下列文档冲突时，按 §2 的优先级处理。

---

## 1 项目是什么

- 一个 8 人团队的课程项目：**技术博客内容管理系统（CMS）**，前后端分离的单体应用。
- 角色只有两个：**内容编辑**（写自己的文章、提交审核）与**管理员**（审核、下架、管理分类）。博客前台匿名只读。
- 核心卖点是**权限模型可被测试证明**：三道闸门（角色 / 归属 / 状态）、归属隔离、媒体单一出口、留痕只增不改。
- 当前阶段：**设计已完成，尚未进入实现**。`src/`、`web/` 还不存在，`pom.xml` 只有 Java 21 编译配置，没有依赖。

## 2 文档地图与优先级

| 优先级 | 文档 | 作用 |
|---|---|---|
| 1 | `CMS-SRS.md` | **唯一需求真源**（v2.5，已冻结）。业务规则 `BR-*`、功能需求 `FR-*`、横切需求 `X-*`、测试用例 `TU-*` 都以它为准 |
| 2 | `doc/api/api-spec.md` + `doc/api/openapi.yaml` | 前后端统一接口规范（草案 v0.1）。路径、字段、错误码、分页以它为准；两者冲突时以 `api-spec.md` 为准 |
| 3 | `doc/context/architecture.md` | 内部架构基线：技术栈、包结构、不变量 `INV-*`、后台任务 |
| 4 | `doc/context/git-standards.md` | 提交、分支、合并规范（提交行为以它为准） |
| 5 | `doc/context/progress-tracker.md` | 当前状态快照与决策记录 |
| 参考 | `doc/context/project-overview.md` | 背景与取舍记录，**已降级，不定义规则** |

规则：
1. 需求取值冲突时一律以 `CMS-SRS.md` 为准；**不要为了让代码好写而改 SRS**。SRS 已冻结，变更必须重开版本号，先问人。
2. 发现文档之间不一致时，先在回复里指出，不要自行挑一个实现了事。已知冲突见 `doc/api/api-spec.md` §15，待确认问题见 §16。
3. 引用规则时写出编号（如 `BR-ISO-003`、`FR-ARTICLE-002`、`INV-07`），便于追溯。

## 3 技术栈（已锁定选型，版本号待定）

- **前端**：Vue 3（Composition API）+ Vite、Element Plus、Pinia、Vue Router、Axios；Markdown 编辑建议 `md-editor-v3`。
- **后端**：Java 21、Spring Boot 3.x（**Spring MVC**，不用 WebFlux）、Spring Security 6（**只做认证**）、MyBatis-Plus（不用 JPA）、MySQL 8（`utf8mb4`）、Flyway、Spring `@Scheduled`。
- **测试**：JUnit 5、Spring Boot Test、MockMvc、Testcontainers（**真 MySQL，不用 H2**）。
- **构建与部署**：Maven 单模块；前端静态产物 + 后端 jar，置于 Nginx 同源反向代理之后。
- **明确不引入**：Redis 或任何缓存、消息队列、Quartz、JWT、独立检索服务。要引入任何新依赖或新中间件，先问人。

## 4 代码结构约定

后端包根 `com.liang.cms`，**按功能域分包**（不是三层分包）：
`config/ auth/ security/ article/ taxonomy/ media/ audit/ publicapi/ task/ common/`
每个包的职责与禁止事项见 `architecture.md` §3.1。依赖方向：
- `common` 不依赖任何业务包；`security` **不得反向依赖**业务包；`publicapi` 不被任何后台包依赖。

前端目录 `web/src/{api,router,stores,views,components,utils}`，见 `architecture.md` §3.2。
- `views/article` 与 `views/review` **不共享可写组件**；审核页不得出现正文编辑控件（BR-007）。
- 前端路由守卫只做体验，**不承担任何权限职责**。

## 5 不能破坏的硬规则

写代码前逐条对照；违反任意一条都视为缺陷，即使测试是绿的。

1. **状态只能走状态机**：`article.status` 只有 `ArticleStateMachine.transition(...)` 一个写入口；不存在 `setStatus`，不存在接收 `status` 的 DTO。进入「已发布」的唯一路径是审核通过（INV-01）。
2. **归属隔离在数据层**：文章读查询的归属条件由 MyBatis-Plus 拦截器追加，scope 只能由 `ArticleScopeBinder` 设置；写路径只经 `ArticleRepository` 的固定方法（INV-02）。
3. **管理员不能改内容**：审核相关接口的 DTO 里根本没有内容字段（INV-03）。
4. **留痕只增**：`audit/` 包里不写 update / delete 方法；应用数据库账号只有 `INSERT`/`SELECT`（INV-04）。
5. **媒体单一出口**：所有文件只经 `GET /api/media/{media_id}` 判权后由应用读盘返回；`storage/` 不得出现在任何静态资源映射里（INV-05）。
6. **正文只存 Markdown 原文**：后端不渲染、不消毒、不接受 HTML / 脚本 / iframe；视频只存 `https` URL（INV-06）。
7. **系统字段只由系统写**：`published_at`、`author_id`、`status`、时间戳不出现在任何请求 DTO 里；请求带了直接 400（INV-07、INV-08）。
8. **拒绝不泄露存在性**：角色闸、归属闸失败返回 404，响应体与「资源不存在」逐字节一致；媒体出口任何拒绝都是 404；401 只用于未登录（INV-09）。具体判定顺序与错误码见 `api-spec.md` §3。
9. **公开接口只读且只给已发布**：`publicapi/` 只有 SELECT，不接受任何影响可见性的参数（INV-10）。
10. **不加缓存**：任何缓存都会破坏「下架后媒体立即不可访问」（BR-MEDIA-003）。

## 6 接口约定速查

完整内容见 `doc/api/api-spec.md`，这里只列最常用的：
- 前缀 `/api`；匿名入口 `/api/auth/{csrf,register,login}`、`/api/public/**`、`/api/media/{id}`。
- 认证：服务端会话 Cookie（`JSESSIONID`，HttpOnly）+ 除登录外的写请求带 `X-XSRF-TOKEN` 请求头。
- 响应体统一 `{code, message, data}`；HTTP 状态码按 SRS 使用 400 / 401 / 403 / 404 / 409。
- 字段 snake_case；时间 ISO 8601 且带时区偏移；分页参数 `page`、`page_size`，返回 `{items, page, page_size, total}`。
- 状态迁移用动作接口 `POST /api/articles/{id}/<动作>`，审核通过 / 驳回必须带 `submission_id`。
- 改接口时**同时改** `api-spec.md` 与 `openapi.yaml`，两者保持一致。

## 7 工作方式

1. **先读后写**：改动前先读相关 SRS 条目、`api-spec.md` 对应接口和 `architecture.md` 对应小节。
2. **小步提交**：一次只做一件事；文档改动与代码改动分开提交。
3. **测试先行于权限代码**：涉及闸门、归属、媒体判权、状态迁移的改动，必须同时补 `TU-*` 对应的接口级测试（MockMvc + Testcontainers）。越权用例直接打接口，不经过前端。
4. **不编造需求**：SRS 没写的行为不要自己发明；确需补充的通用基础设施在文档中标注【补充】。
5. **更新进度**：完成一项实质性工作后，同步更新 `doc/context/progress-tracker.md` 的对应小节（它是快照，不写流水账）。
6. **不确定就问**：需求有歧义、文档冲突、要新增依赖、要改冻结文档、要改写已推送历史时，停下来问人。

## 8 Git 规范（摘要，完整见 `doc/context/git-standards.md`）

- 提交信息遵循 Conventional Commits：`<type>[(scope)][!]: <中文描述>`，描述动词开头、不加句号、不超过 50 字。
- 常用 type：`feat` `fix` `docs` `refactor` `test` `build` `chore`；scope 取 `srs` `architecture` `auth` `security` `article` `taxonomy` `media` `audit` `publicapi` `task` `common` `config` `db` `web` 等。
- 工作分支命名 `<type>/<kebab-case 描述>`；合并保持线性历史（rebase 或 squash）。
- 已推送的历史不改写；确需改写只能 `--force-with-lease`，并事先通知协作者。
- **提交作者用仓库成员本人的 git 配置；不要添加 `Co-authored-by` 等 AI 署名脚注。**
- 文本文件 UTF-8 无 BOM、换行 LF。

## 9 不要做的事

- 不要修改 `CMS-SRS.md` 的需求内容（它已冻结），除非人明确要求并重开版本号。
- 不要把生成物、IDE 本地配置、密钥、`storage/` 下的上传文件提交进仓库。
- 不要为了让测试通过而放宽权限判定、吞掉异常或改成 200。
- 不要在前端做任何「安全」判断后就认为权限完成了。
- 不要绕过 Flyway 手动改库表结构。
