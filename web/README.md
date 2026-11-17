# web — CMS-TeamWork 前端

Vue 3 + Vite、Element Plus、Pinia、Vue Router、Axios、md-editor-v3（只读预览）。
目录与边界见 `doc/context/architecture.md` §3.2、§3.3；接口见 `doc/api/api-spec.md`。

当前只实现**博客前台**（A，范围延伸）：

| 路由 | 页面 |
|---|---|
| `/` | 首页：头条（最新发布的一篇）、分类胶囊、文章网格、标签多选侧栏、关于本站、分页；`?tag_ids=&page=` |
| `/category/:id` | 分类页：同一套列表，分类在路径里；`?tag_ids=&page=`。不在 facets 里的分类进统一 404 |
| `/search` | 搜索页：`?q=&tag_ids=&page=`，匹配标题或摘要（api-spec §11.1 `q`，范围延伸） |
| `/posts/:id` | 文章详情 |
| 其他 | 前台统一 404 |

顶栏分类导航与侧栏标签来自公开列表的 `with_facets=true`（api-spec §4.14 `PublicFacets`），没有单独的公开分类 / 标签接口。
旧链接 `/?category_id=3` 会重定向到 `/category/3`。

顶栏「作者登录」只链到预留的 `/login`。登录 / 注册页（F）与 `/admin/**` 后台（F / G）尚未实现，合入前 `/login` 按约定落到前台统一 404。

## 运行

需要 Node.js 20.19+ 或 22.12+。

```bash
cd web
npm install
npm run dev            # http://localhost:5173 ，默认使用契约 mock
npm test               # vitest 单元测试
npm run build          # 产物在 web/dist/
npm run preview:mock   # 用契约 mock 预览构建产物，http://localhost:4173
```

## 契约 mock 与真实后端

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_USE_MOCK` | 开发时 `true`（`.env.development`） | `true`：`/api/**` 由 `mock/` 里的 Vite 中间件应答；`false`：代理到真实后端 |
| `VITE_API_TARGET` | `http://localhost:8080` | 关闭 mock 时 `/api` 的代理目标 |

切到真实后端：复制 `.env.example` 为 `.env.development.local`（不入库）后重启 `npm run dev`。

mock 按 api-spec §1.4 / §1.5 / §3.2 / §10.2 / §11 只实现三个公开出口：
`GET /api/public/articles`（含 `with_facets` 与 `q`）、`GET /api/public/articles/{id}`、`GET /api/media/{id}`。
`q` 按 SQL `LIKE` 语义模拟：转义 `\ % _` 后按字面匹配标题或摘要，大小写不敏感，不匹配正文；facets 不受筛选影响。
它只跑在 Vite 的 Node 中间件里，不会打进前端产物。数据见 `mock/db.js`，
其中带有五种非已发布状态、内部字段、未关联媒体、只被草稿引用的分类与标签（验证 facets 不含未发布内容）、
标题含 `%` `_` 的文章（id 114，验证转义）和一篇「渲染安全自检」文章（id 199，仅 mock）。
C / E 交付后对照 `mock/handlers.test.js` 的用例联调。

## 公共底座（F / G 复用）

- `src/api/http.js`：唯一的 Axios 实例。同源 `/api/**`、携带 Cookie、解包 `{code,message,data}`、失败抛 `ApiError`（`status` 为 404 时进统一 404）。
  CSRF 令牌按 api-spec §2.2 只从 `GET /api/auth/csrf` 响应体取得、不走 Cookie，已关闭 axios 读 Cookie 的默认行为；写请求的 `X-XSRF-TOKEN` 拦截器由 F 接入。
- `src/composables/usePublicList.js`：公开列表加载状态机（防乱序、重试）。
- `src/stores/taxonomy.js`：facets（分类 / 标签导航），一次浏览会话内复用，不落本地存储。
- `src/components/MarkdownView.vue`：只读 Markdown 渲染，不得改成可写组件。
- `src/utils/markdown.js`：前台渲染安全规则（见下）。
- 路由分区：`/` 前台（`PublicLayout`）；`/login` 预留给 F；`/admin/**` 给 F / G，使用独立 AdminLayout。

## 渲染安全规则（`src/utils/markdown.js`）

- 原始 HTML 不解析，代码块 / 行内代码按文本显示
- 图片只加载 `/api/media/{id}`，其他地址显示替代文字
- 链接只跟从绝对 `https://` 与站内相对地址；外链新窗口 + `rel="noopener noreferrer"`；`http:`、`//…`、`javascript:`、`data:`、`vbscript:` 等只保留文字
- **视频（api-spec §6.0 规则 5、§16 问题 9）**：链接目标为 `https://` 且路径以 `.mp4` / `.webm` / `.ogg` 结尾时，渲染为 `<video controls preload="metadata">`（不自动播放），下方保留原链接；不生成 iframe，视频平台页面链接仍是普通外链
- 时间按接口返回的 `+08:00` 原样显示，不换算浏览器时区
