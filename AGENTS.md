# AGENTS.md — AI 协作指引

本文件写给在本仓库里工作的 AI 编码助手（Cursor、Claude Code、Codex、Copilot 等）。人类成员也可以把它当作速查表。
动手之前请完整读完本文件；与下列文档冲突时，按 §2 的优先级处理。

---

## 1 项目是什么

- 一个 8 人团队的课程项目：**技术博客内容管理系统（CMS）**，前后端分离的单体应用。
- 角色只有两个：**内容编辑**（写自己的文章、提交审核）与**管理员**（审核、下架、管理分类、管理用户）。权限用 RBAC 表达（`role`/`permission`/`role_permission`，27 个权限点，一人一角色，运行时只读）。博客前台匿名只读。
- 核心卖点是**权限模型可被测试证明**：三道闸门（权限 / 归属 / 状态）、归属隔离、媒体单一出口、留痕只增不改。
- 当前阶段：**设计已完成，后端即将进入 M0**。`web/` 已有博客前台与管理员后台（契约 mock 供数）；`src/` 还没有后端代码，`pom.xml` 只有 Java 21 编译配置，没有依赖。表结构为 16 张表（`doc/db/schema.md` v2），分工见 `doc/context/team-division.md`。

## 2 文档地图与优先级

| 优先级 | 文档 | 作用 |
|---|---|---|
| 1 | `CMS-SRS.md` | **唯一需求真源**（v2.6，在 v2.5 冻结基线上补齐课程评分项）。业务规则 `BR-*`、功能需求 `FR-*`、横切需求 `X-*`、测试用例 `TU-*` 都以它为准 |
| 2 | `doc/api/api-spec.md` + `doc/api/openapi.yaml` | 前后端统一接口规范（草案 v0.2，44 个接口）。路径、字段、错误码、分页以它为准；两者冲突时以 `api-spec.md` 为准 |
| 3 | `doc/context/architecture.md` | 内部架构基线：技术栈、包结构、不变量 `INV-*`、后台任务 |
| 3 | `doc/db/schema.md` | 16 张表的字段、约束、范式论证与 Flyway 顺序；architecture §4.1 的展开。写迁移、Entity、Mapper 以它为准 |
| 4 | `doc/context/git-standards.md` | 提交、分支、合并规范（提交行为以它为准） |
| 5 | `doc/context/team-division.md` | 分工、表所有权、任务细分与 PR 审核人 |
| 5 | `doc/context/progress-tracker.md` | 当前状态快照与决策记录 |
| 5 | `doc/ai-log/README.md` | AI 使用与过程记录规则（每人的记录由本人写） |
| 参考 | `doc/context/project-overview.md` | 背景与取舍记录，**已降级，不定义规则** |

规则：
1. 需求取值冲突时一律以 `CMS-SRS.md` 为准；**不要为了让代码好写而改 SRS**。SRS 变更必须重开版本号，先问人。
2. 发现文档之间不一致时，先在回复里指出，不要自行挑一个实现了事。已知冲突见 `doc/api/api-spec.md` §15，待确认问题见 §16。
3. 引用规则时写出编号（如 `BR-ISO-003`、`FR-ARTICLE-002`、`INV-07`），便于追溯。

## 3 技术栈（已锁定选型，版本号待定）

- **前端**：Vue 3（Composition API）+ Vite、Element Plus、Pinia、Vue Router、Axios；Markdown 编辑建议 `md-editor-v3`。
- **后端**：Java 21（决策 T6）、Spring Framework 6.2 + **Spring MVC**（**不用 Spring Boot**，不用 WebFlux；`web.xml` + Java 配置类、单一 `DispatcherServlet` 容器，见 `architecture.md` §2.10）、认证与 CSRF 用 Spring MVC `HandlerInterceptor`（**不用 Spring Security**，密码哈希只用 `spring-security-crypto` 的 BCrypt，`architecture.md` §5.1）、Spring AOP（权限切面、操作日志切面）、MyBatis-Plus（非 Boot 依赖，不用 JPA）、MySQL 8（`utf8mb4`）、Flyway（Spring Bean 启动时迁移）、Spring `@Scheduled`。课程报告里写作「Spring 6 + Spring MVC + MyBatis-Plus，基于实验二 SSM 升级」（D12、T1～T9，待老师确认）。
- **测试**：JUnit 5、Spring TestContext（`spring-test`）、MockMvc、Testcontainers（**真 MySQL，不用 H2**）。**2026-11-23 起后端测试暂缓到 M5**（`team-division.md` §3.7），选型不变。
- **构建与部署**：Maven 单模块，`packaging = war`；后端 WAR 部署到外部 Tomcat 10.1，前端静态产物与 `/api/**` 反向代理都在 Nginx 同源之后。
- **明确不引入**：Spring Boot（任何 `spring-boot-*` 依赖）、Spring Security 框架（`spring-security-web` / `spring-security-config`；只允许 `spring-security-crypto`）、Redis 或任何缓存、消息队列、Quartz、JWT、独立检索服务。要引入任何新依赖或新中间件，先问人。

## 4 代码结构约定

后端包根 `com.liang.cms`，**按功能域分包**（不是三层分包）：
`config/ auth/ security/ system/ article/ taxonomy/ media/ audit/ publicapi/ task/ common/`（`system/` 为 v2.6 用户管理与操作日志查询）
每个包的职责与禁止事项见 `architecture.md` §3.1。依赖方向：
- `common` 不依赖任何业务包；`security` **不得反向依赖**业务包；`publicapi` 不被任何后台包依赖。

数据库：
- 表、字段、约束以 `doc/db/schema.md` 为准；迁移按其 §8 的 V1～V11 顺序，每张表只由所有者改（`team-division.md` §1.3）。
- `category`、`tag`、`article` 只做**逻辑删除**（`@TableLogic`，`deleted` 为 0 或行 id，实体字段声明为 `Long`）；`user` **没有 `deleted` 列、不可删除**，只能停用（BR-USER-002），不要给 `User` 加 `@TableLogic`。这四张表应用账号都没有 `DELETE` 权限。手写 XML 要自己加 `deleted = 0`；唯一例外是 BR-ROLE-005 的作者判定，要包含已删除文章（schema USER-03）。
- 枚举在库里与接口里是**同一套英文代码**，用 MyBatis-Plus `@EnumValue` 直接映射，不做中英映射。
- schema §6 列出的服务层规则（AUD-01～08、USER-01、TAX-01、MEDIA-01～03、ART-01）数据库不会替你挡，必须在对应 Service 里校验。

前端目录 `web/src/{api,router,stores,views,components,utils}`，见 `architecture.md` §3.2。
- `views/article` 与 `views/review` **不共享可写组件**；审核页不得出现正文编辑控件（BR-007）。
- 前端路由守卫只做体验，**不承担任何权限职责**。

## 5 不能破坏的硬规则

写代码前逐条对照；违反任意一条都视为缺陷，即使测试是绿的。

1. **状态只能走状态机**：`article.status` 只有 `ArticleStateMachine.transition(...)` 一个写入口；不存在 `setStatus`，不存在接收**文章** `status` 的 DTO。进入「已发布」的唯一路径是审核通过（INV-01）。
2. **归属隔离在数据层**：文章读查询的归属条件由 MyBatis-Plus 拦截器追加，scope 只能由 `ArticleScopeBinder` 设置；写路径只经 `ArticleRepository` 的固定方法（INV-02）。
3. **管理员不能改内容**：审核相关接口的 DTO 里根本没有内容字段（INV-03）。
4. **留痕只增**：`audit/` 包里不写 update / delete 方法；应用数据库账号只有 `INSERT`/`SELECT`（INV-04）。
5. **媒体单一出口**：所有文件只经 `GET /api/media/{media_id}`（#29）与 `/download`（#43）共用的同一个 `MediaAccessPolicy` 判权后由应用读盘返回；`storage/` 不得出现在任何静态资源映射里（INV-05）。
6. **正文只存 Markdown 原文**：后端不渲染、不消毒、不接受 HTML / 脚本 / iframe；视频只存 `https` URL（INV-06）。
7. **文章的系统字段只由系统写**：文章的 `published_at`、`author_id`、`status`、`version`、时间戳不出现在文章写接口（#7、#9）的请求 DTO 里；请求带了直接 400（INV-07、INV-08）。这条只针对文章：#34 账号启停、#38 分类启停的请求体本来就是 `status`，不要被全局规则误拒（api-spec §1.2）。编辑文章用 `expected_version` 做乐观锁，不一致返回 `409 40907`。
8. **拒绝不泄露存在性**：权限闸、归属闸失败返回 404，响应体与「资源不存在」逐字节一致；媒体出口任何拒绝都是 404；401 只用于未登录（INV-09）。具体判定顺序与错误码见 `api-spec.md` §3。
9. **公开接口只读且只给已发布**：`publicapi/` 只有 SELECT，不接受任何影响可见性的参数（INV-10）。
10. **不加缓存**：任何缓存都会破坏「下架后媒体立即不可访问」（BR-MEDIA-003）。
11. **权限只在切面判**：每个 Controller 方法都有 `@RequiresPermission` 或在白名单里（启动检查，BR-RBAC-003）；Service 里不判断角色；拦截器只判是否已登录，不判权限。写接口加 `@OperationLog`，不直接写 `sys_operation_log`；文章业务留痕仍走 `AuditWriter`。
12. **批量逐条独立事务**：#40～#42 每条一个事务（`TransactionTemplate` 或另一个 Bean 上的 `REQUIRES_NEW`），不要同类自调用。

## 6 接口约定速查

完整内容见 `doc/api/api-spec.md`，这里只列最常用的：
- 前缀 `/api`；匿名入口 `/api/auth/{csrf,register,login}`、`/api/public/**`、`/api/media/{id}`、`/api/media/{id}/download`。
- 认证：服务端会话 Cookie（`JSESSIONID`，HttpOnly）+ 除登录外的写请求带 `X-XSRF-TOKEN` 请求头；由 `AuthInterceptor`（401）与 `CsrfInterceptor`（403）校验，会话里只存 `user_id`，状态与角色每请求查库。
- 响应体统一 `{code, message, data}`；HTTP 状态码按 SRS 使用 400 / 401 / 403 / 404 / 409。
- 字段 snake_case；时间 ISO 8601 且带时区偏移；分页参数 `page`、`page_size`，返回 `{items, page, page_size, total}`。
- 状态迁移用动作接口 `POST /api/articles/{id}/<动作>`，审核通过 / 驳回必须带 `submission_id`。
- 改接口时**同时改** `api-spec.md` 与 `openapi.yaml`，两者保持一致。

## 7 工作方式

1. **先读后写**：改动前先读相关 SRS 条目、`api-spec.md` 对应接口和 `architecture.md` 对应小节。
2. **小步提交**：一次只做一件事；文档改动与代码改动分开提交。
3. **权限代码要留验证记录**：涉及闸门、归属、媒体判权、状态迁移的改动，PR 里必须附手工验证记录（curl 或 Apifox，至少包含一次「编辑 B 访问编辑 A 的文章返回 404」）。原先要求的 `TU-*` 接口级测试（MockMvc + Testcontainers）暂缓到 M5 统一补，代码要保持可测（时间源注入、`StorageService` 可替换）。
4. **不编造需求**：SRS 没写的行为不要自己发明；确需补充的通用基础设施在文档中标注【补充】。
5. **更新进度**：完成一项实质性工作后，同步更新 `doc/context/progress-tracker.md` 的对应小节（它是快照，不写流水账）。
6. **不确定就问**：需求有歧义、文档冲突、要新增依赖、要改冻结文档、要改写已推送历史时，停下来问人。

## 8 Git 规范（摘要，完整见 `doc/context/git-standards.md`）

- 提交信息遵循 Conventional Commits：`<type>[(scope)][!]: <中文描述>`，描述动词开头、不加句号、不超过 50 字。
- 常用 type：`feat` `fix` `docs` `refactor` `test` `build` `chore`；scope 取 `srs` `architecture` `api` `team` `ai-log` `auth` `security` `system` `article` `taxonomy` `media` `audit` `oplog` `publicapi` `task` `common` `config` `db` `web` 等。
- 工作分支命名 `<type>/<kebab-case 描述>`；**后端 PR 用 merge commit 合并**（保留逐次提交作过程材料），文档 / 前端 PR 可 squash（git-standards §7）。
- 已推送的历史不改写；确需改写只能 `--force-with-lease`，并事先通知协作者。
- **提交作者用仓库成员本人的 git 配置；不要添加 `Co-authored-by` 等 AI 署名脚注。**
- 文本文件 UTF-8 无 BOM、换行 LF。

## 9 不要做的事

- 不要修改 `CMS-SRS.md` 的需求内容，除非人明确要求并重开版本号。
- 不要替成员代写 `doc/ai-log/` 里的个人记录或个人陈述；后端复杂逻辑（状态机、闸门、批量事务、切面、N+1 优化）由负责人本人写（`doc/ai-log/README.md`）。
- 不要把生成物、IDE 本地配置、密钥、`storage/` 下的上传文件提交进仓库。
- 不要为了让测试通过而放宽权限判定、吞掉异常或改成 200。
- 不要在前端做任何「安全」判断后就认为权限完成了。
- 不要绕过 Flyway 手动改库表结构。
- 不要引入 Spring Boot 或 Spring Security 框架依赖，也不要写 `@SpringBootApplication`、`application.yml`、`SecurityFilterChain`；本项目是手工装配的 Spring MVC（`architecture.md` §2.10）。
