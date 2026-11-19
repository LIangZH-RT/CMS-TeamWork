// 管理员端接口 mock handlers（api-spec v0.1 §4.4~§4.21）。
// 与 handlers.js（公开接口）解耦：admin 端接口返回完整字段（含状态、作者、时间戳、留痕），
// 公开接口只返回白名单。两个 handler 函数在 mock/server.js 里按路径前缀路由。
//
// 注意：这是内存 mock，POST/PUT/DELETE 的改动只存在于当前 Vite dev server 生命周期。
// 真实后端实现以 api-spec 为准。
import { articles, categories, tags, authors, media, audit_logs, auditLog, review_standard, getAdminArticleFields } from './db.js'
import { makeCoverPng, makeDiagramPng, makeWav } from './assets.js'

// 可变引用：admin 端会改分类/标签数组（新建/改名/删除），这些数组被外部 import
// 但 db.js 导出的是 const 数组，所以用 Map 做运行态
const adminState = {
  categories: new Map(categories.map((c) => [c.id, { ...c }])),
  tags: new Map(tags.map((t) => [t.id, { ...t }])),
  articleStatus: new Map(), // 文章状态运行态变更（approve → PUBLISHED/SCHEDULED / reject → REJECTED / unpublish → UNPUBLISHED）
  publishedAt: new Map(), // 审核通过立即发布时写入的 published_at（下架后保留，§4.10）
  auditLogs: [...audit_logs],
  nextAuditId: audit_logs.reduce((m, l) => Math.max(m, l.id), 0) + 1,
  nextCategoryId: categories.reduce((m, c) => Math.max(m, c.id), 0) + 1,
  nextTagId: tags.reduce((m, t) => Math.max(m, t.id), 0) + 1,
}

/** db.js 中的 status 字段 + admin 运行态覆盖 */
function currentStatus(id) {
  return adminState.articleStatus.has(id) ? adminState.articleStatus.get(id) : articles.find((a) => a.id === id)?.status
}
function setStatus(id, status) {
  adminState.articleStatus.set(id, status)
}

const ADMIN_ACTOR = { type: 'USER', id: 1, username: 'admin' }

/** 当前时间，固定 +08:00 偏移、精确到秒（api-spec §1.3） */
function nowCst() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19) + '+08:00'
}

/** 模拟留痕追加（字段按 api-spec §4.13，未写入的字段为 null）；返回新留痕 */
function appendAudit(articleId, action, extra = {}) {
  const log = auditLog(adminState.nextAuditId++, articleId, action, ADMIN_ACTOR, nowCst(), extra)
  adminState.auditLogs.push(log)
  return log
}

const ok = (data) => ({ status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ code: 0, message: 'OK', data }) })
const notFound = () => ({ status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ code: 40400, message: '资源不存在', data: null }) })
const badRequest = (field, reason, code = 40000) => ({
  status: 400,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ code, message: '参数校验失败', data: { field_errors: [{ field, reason }] } }),
})
const conflict = (code, message, detail) => ({
  status: 409,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ code, message, data: detail ?? null }),
})

const ID_RE = /^[1-9]\d{0,18}$/
const authorById = new Map(authors.map((a) => [a.id, a]))

// ─── 投影（字段按 api-spec §4.10～§4.12，不多不少） ─────────────────────

const mediaById = new Map(media.map((m) => [m.id, m]))
const mediaSizeCache = new Map()
/** MediaRef（§4.8）：{ media_id, url, mime_type, size } */
function mediaRef(id) {
  const m = id && mediaById.get(id)
  if (!m) return null
  if (!mediaSizeCache.has(m.id)) {
    const buf = m.kind === 'cover' ? makeCoverPng(m.id, ...m.palette) : m.kind === 'diagram' ? makeDiagramPng() : makeWav()
    mediaSizeCache.set(m.id, buf.length)
  }
  return { media_id: m.id, url: `/api/media/${m.id}`, mime_type: m.kind === 'audio' ? 'audio/wav' : 'image/png', size: mediaSizeCache.get(m.id) }
}

const logsOf = (articleId) => adminState.auditLogs.filter((l) => l.article_id === articleId)
const lastLog = (articleId, actions) =>
  logsOf(articleId)
    .filter((l) => actions.includes(l.action))
    .sort((x, y) => Date.parse(y.operated_at) - Date.parse(x.operated_at) || y.id - x.id)[0] ?? null

/** 当前提交轮次 = 最近一条 SUBMIT 留痕的 id（§4.10）；只在待审核时有意义 */
function currentSubmissionId(a) {
  return currentStatus(a.id) === 'PENDING_REVIEW' ? lastLog(a.id, ['SUBMIT'])?.id ?? null : null
}
function submittedAt(a) {
  return lastLog(a.id, ['SUBMIT'])?.operated_at ?? getAdminArticleFields(a.id).submitted_at ?? null
}
function publishedAt(a) {
  return adminState.publishedAt.has(a.id) ? adminState.publishedAt.get(a.id) : a.published_at ?? null
}

/** 管理员视角的 allowed_actions（§4.1 计算口径表「管理员」列） */
function adminAllowedActions(status) {
  if (status === 'PENDING_REVIEW') return ['APPROVE', 'REJECT']
  if (status === 'PUBLISHED') return ['UNPUBLISH']
  return []
}

function briefs(a) {
  const cat = adminState.categories.get(a.category_id) || { id: a.category_id, name: '未知分类' }
  const author = authorById.get(a.author_id) || { id: a.author_id, username: 'unknown' }
  return {
    category: { id: cat.id, name: cat.name },
    tags: a.tag_ids.map((id) => adminState.tags.get(id)).filter(Boolean).map((t) => ({ id: t.id, name: t.name })),
    author: { id: author.id, username: author.username },
  }
}

/** ArticleListItem（§4.11） */
function toAdminListItem(a) {
  const status = currentStatus(a.id)
  const { category, tags, author } = briefs(a)
  const ev = lastLog(a.id, ['REJECT', 'UNPUBLISH'])
  return {
    id: a.id,
    title: a.title,
    status,
    category,
    tags,
    author,
    updated_at: getAdminArticleFields(a.id).updated_at ?? null,
    submitted_at: submittedAt(a),
    scheduled_publish_time: a.scheduled_publish_time ?? null,
    published_at: publishedAt(a),
    latest_event: ev && {
      type: ev.action,
      operated_at: ev.operated_at,
      operator: ev.operator,
      reject_category: ev.reject_category,
      reason: ev.reason,
    },
    allowed_actions: adminAllowedActions(status),
  }
}

/** Article 后台详情（§4.10） */
function toAdminDetail(a) {
  const status = currentStatus(a.id)
  const fields = getAdminArticleFields(a.id)
  const rj = lastLog(a.id, ['REJECT'])
  const up = lastLog(a.id, ['UNPUBLISH'])
  return {
    id: a.id,
    title: a.title,
    content: a.content,
    excerpt: a.excerpt ?? '',
    cover: mediaRef(a.cover_media_id),
    audio: mediaRef(a.audio_media_id),
    ...briefs(a),
    scheduled_publish_time: a.scheduled_publish_time ?? null,
    status,
    published_at: publishedAt(a),
    created_at: fields.created_at ?? null,
    updated_at: fields.updated_at ?? null,
    submitted_at: submittedAt(a),
    latest_rejection: rj && { reject_category: rj.reject_category, comment: rj.reason, operator: rj.operator, operated_at: rj.operated_at },
    latest_unpublish: up && { reason: up.reason, operator: up.operator, operated_at: up.operated_at },
    current_submission_id: currentSubmissionId(a),
    allowed_actions: adminAllowedActions(status),
  }
}

/** ReviewQueueItem（§4.12） */
function toQueueItem(a) {
  const { category, tags, author } = briefs(a)
  return {
    id: a.id,
    title: a.title,
    author,
    category,
    tags,
    submitted_at: submittedAt(a),
    scheduled_publish_time: a.scheduled_publish_time ?? null,
    current_submission_id: currentSubmissionId(a),
  }
}

function intParam(sp, name, { def, min, max }) {
  const raw = sp.get(name)
  if (raw === null || raw === '') return { value: def }
  if (!/^\d+$/.test(raw)) return { error: badRequest(name, '必须是整数') }
  const n = Number(raw)
  if (n < min || (max && n > max)) return { error: badRequest(name, max ? `取值范围 ${min}～${max}` : `不能小于 ${min}`) }
  return { value: n }
}

// ─── 文章列表（管理员视角） ──────────────────────────────────────────────

/** GET /api/articles (#6)：管理员不传 author_id → 全量 */
export function listArticlesAdmin(sp) {
  const page = intParam(sp, 'page', { def: 1, min: 1 })
  if (page.error) return page.error
  const size = intParam(sp, 'page_size', { def: 20, min: 1, max: 100 })
  if (size.error) return size.error

  const status = sp.get('status')
  if (status && !['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED'].includes(status))
    return badRequest('status', '枚举值不合法')

  const catRaw = sp.get('category_id')
  if (catRaw !== null && catRaw !== '' && !ID_RE.test(catRaw)) return badRequest('category_id', '必须是正整数')
  const authorRaw = sp.get('author_id')
  if (authorRaw !== null && authorRaw !== '' && !ID_RE.test(authorRaw)) return badRequest('author_id', '必须是正整数')
  const title = (sp.get('title') ?? '').trim()
  const tagIds = sp.getAll('tag_ids').filter((v) => v !== '')
  if (tagIds.some((v) => !ID_RE.test(v))) return badRequest('tag_ids', '必须是正整数')

  let rows = articles.map((a) => ({ a, s: currentStatus(a.id) }))
  if (status) rows = rows.filter(({ s }) => s === status)
  if (catRaw) rows = rows.filter(({ a }) => a.category_id === Number(catRaw))
  if (authorRaw) rows = rows.filter(({ a }) => a.author_id === Number(authorRaw))
  if (title) rows = rows.filter(({ a }) => a.title.includes(title))
  for (const t of new Set(tagIds.map(Number))) rows = rows.filter(({ a }) => a.tag_ids.includes(t))

  rows.sort((x, y) => Date.parse(getAdminArticleFields(y.a.id).updated_at) - Date.parse(getAdminArticleFields(x.a.id).updated_at) || y.a.id - x.a.id)

  const start = (page.value - 1) * size.value
  const items = rows.slice(start, start + size.value).map(({ a }) => toAdminListItem(a))
  return ok({ items, page: page.value, page_size: size.value, total: rows.length })
}

/** GET /api/articles/counts（§6.9）：参数与列表相同但没有 status / 分页；返回 { by_status, total } */
export function getCounts(sp) {
  const catRaw = sp.get('category_id')
  if (catRaw !== null && catRaw !== '' && !ID_RE.test(catRaw)) return badRequest('category_id', '必须是正整数')
  const authorRaw = sp.get('author_id')
  if (authorRaw !== null && authorRaw !== '' && !ID_RE.test(authorRaw)) return badRequest('author_id', '必须是正整数')
  const tagIds = sp.getAll('tag_ids').filter((v) => v !== '')
  if (tagIds.some((v) => !ID_RE.test(v))) return badRequest('tag_ids', '必须是正整数')
  const title = (sp.get('title') ?? '').trim()

  let rows = articles.map((a) => ({ a, s: currentStatus(a.id) }))
  if (catRaw) rows = rows.filter(({ a }) => a.category_id === Number(catRaw))
  if (authorRaw) rows = rows.filter(({ a }) => a.author_id === Number(authorRaw))
  if (title) rows = rows.filter(({ a }) => a.title.includes(title))
  for (const t of new Set(tagIds.map(Number))) rows = rows.filter(({ a }) => a.tag_ids.includes(t))

  const by_status = { DRAFT: 0, PENDING_REVIEW: 0, REJECTED: 0, SCHEDULED: 0, PUBLISHED: 0, UNPUBLISHED: 0 }
  rows.forEach(({ s }) => (by_status[s] += 1))
  return ok({ by_status, total: rows.length })
}

/** GET /api/articles/{id} (#8 管理员视角) */
export function getArticleAdmin(id) {
  if (!ID_RE.test(id)) return notFound()
  const a = articles.find((x) => x.id === Number(id))
  if (!a) return notFound()
  return ok(toAdminDetail(a))
}

/** GET /api/articles/{id}/audit-logs (#19) */
export function getAuditLogs(id) {
  if (!ID_RE.test(id)) return notFound()
  const a = articles.find((x) => x.id === Number(id))
  if (!a) return notFound()
  const logs = adminState.auditLogs
    .filter((l) => l.article_id === Number(id))
    .sort((x, y) => Date.parse(x.operated_at) - Date.parse(y.operated_at) || x.id - y.id)
  return ok(logs)
}

// ─── 审核队列与动作 ──────────────────────────────────────────────────────

/** GET /api/reviews/queue (#14)：只列 PENDING_REVIEW */
export function getReviewQueue(sp) {
  const page = intParam(sp, 'page', { def: 1, min: 1 })
  if (page.error) return page.error
  const size = intParam(sp, 'page_size', { def: 20, min: 1, max: 100 })
  if (size.error) return size.error

  const catRaw = sp.get('category_id')
  if (catRaw !== null && catRaw !== '' && !ID_RE.test(catRaw)) return badRequest('category_id', '必须是正整数')
  const authorRaw = sp.get('author_id')
  if (authorRaw !== null && authorRaw !== '' && !ID_RE.test(authorRaw)) return badRequest('author_id', '必须是正整数')
  const title = (sp.get('title') ?? '').trim()
  const tagIds = sp.getAll('tag_ids').filter((v) => v !== '')
  if (tagIds.some((v) => !ID_RE.test(v))) return badRequest('tag_ids', '必须是正整数')

  let rows = articles
    .filter((a) => currentStatus(a.id) === 'PENDING_REVIEW')
    .map((a) => ({ a }))

  if (catRaw) rows = rows.filter(({ a }) => a.category_id === Number(catRaw))
  if (authorRaw) rows = rows.filter(({ a }) => a.author_id === Number(authorRaw))
  if (title) rows = rows.filter(({ a }) => a.title.includes(title))
  for (const t of new Set(tagIds.map(Number))) rows = rows.filter(({ a }) => a.tag_ids.includes(t))

  // 按 submitted_at 升序，相同按 id 升序（api-spec §7.1）
  rows.sort((x, y) => Date.parse(submittedAt(x.a)) - Date.parse(submittedAt(y.a)) || x.a.id - y.a.id)

  const start = (page.value - 1) * size.value
  const items = rows.slice(start, start + size.value).map(({ a }) => toQueueItem(a))
  return ok({ items, page: page.value, page_size: size.value, total: rows.length })
}

/** GET /api/reviews/standard (#15) */
export function getStandard() {
  return ok(review_standard)
}

/** 审核通过 / 驳回：状态闸（api-spec §3.3：40900 STATE_CONFLICT） */
// 校验顺序按 api-spec §2.3：404（不存在）→ 400（请求体）→ 409（状态闸）。
// 失败一律以 { error } 返回，调用方 `if (g.error) return g.error`
function findArticle(id) {
  if (!ID_RE.test(id)) return { error: notFound() }
  const a = articles.find((x) => x.id === Number(id))
  if (!a) return { error: notFound() }
  return { a }
}
function stateGuard(a, submissionId) {
  if (currentStatus(a.id) !== 'PENDING_REVIEW') return { error: conflict(40900, '当前状态不允许此操作') }
  // §7.3 / §7.4：轮次与当前提交不符 → 409 SUBMISSION_STALE（旧页面审核新一轮内容）
  if (Number(submissionId) !== currentSubmissionId(a)) return { error: conflict(40901, '提交轮次已变化，请刷新后重新审核') }
  return {}
}
const REJECT_CATEGORY_VALUES = new Set(review_standard.reject_categories.map((c) => c.value))

/** POST /api/articles/{id}/approve (#16) */
export function approve(id, body) {
  const g = findArticle(id)
  if (g.error) return g.error
  if (!ID_RE.test(String(body?.submission_id ?? ''))) return badRequest('submission_id', '必填，且为正整数', 40010)
  const st = stateGuard(g.a, body.submission_id)
  if (st.error) return st.error
  // §7.3：预定时间在未来 → SCHEDULED（published_at 不变）；否则立即 PUBLISHED
  const now = nowCst()
  const sched = g.a.scheduled_publish_time ?? null
  const scheduled = sched && Date.parse(sched) > Date.parse(now)
  setStatus(g.a.id, scheduled ? 'SCHEDULED' : 'PUBLISHED')
  if (!scheduled) adminState.publishedAt.set(g.a.id, now)
  appendAudit(g.a.id, 'APPROVE', {
    review_standard_version: review_standard.review_standard_version,
    published_at: scheduled ? null : now,
    related_submission_id: Number(body.submission_id),
  })
  return ok({
    id: g.a.id,
    status: scheduled ? 'SCHEDULED' : 'PUBLISHED',
    published_at: publishedAt(g.a),
    scheduled_publish_time: sched,
  })
}

/** POST /api/articles/{id}/reject (#17) */
export function reject(id, body) {
  const g = findArticle(id)
  if (g.error) return g.error
  if (!ID_RE.test(String(body?.submission_id ?? ''))) return badRequest('submission_id', '必填，且为正整数', 40010)
  // FR-REVIEW-003：类别必须是 BR-CONTENT-005 的 8 类之一，意见必填（空串、纯空格视为缺失）
  if (!REJECT_CATEGORY_VALUES.has(body?.reject_category)) return badRequest('reject_category', '必须是 8 个驳回类别之一', 40011)
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''
  if (!comment) return badRequest('comment', '驳回意见必填', 40012)
  const st = stateGuard(g.a, body.submission_id)
  if (st.error) return st.error
  setStatus(g.a.id, 'REJECTED')
  appendAudit(g.a.id, 'REJECT', {
    reason: comment,
    reject_category: body.reject_category,
    review_standard_version: review_standard.review_standard_version,
    related_submission_id: Number(body.submission_id),
  })
  return ok({ id: g.a.id, status: 'REJECTED' })
}

/** POST /api/articles/{id}/unpublish (#18) */
export function unpublish(id, body) {
  if (!ID_RE.test(id)) return notFound()
  const a = articles.find((x) => x.id === Number(id))
  if (!a) return notFound()
  // §2.3：先校验请求体（400），再判断状态（409）
  if (typeof body?.reason !== 'string' || !body.reason.trim()) return badRequest('reason', '下架原因必填', 40012)
  if (currentStatus(a.id) !== 'PUBLISHED') return conflict(40900, '当前状态不允许此操作')
  setStatus(a.id, 'UNPUBLISHED')
  appendAudit(a.id, 'UNPUBLISH', { reason: body.reason.trim(), review_standard_version: review_standard.review_standard_version })
  return ok({ id: a.id, status: 'UNPUBLISHED' })
}

// ─── 分类 / 标签 ────────────────────────────────────────────────────────

function categoryProjection(c) {
  const inUse = articles.some((a) => a.category_id === c.id)
  return { id: c.id, name: c.name, in_use: inUse }
}

function tagProjection(t) {
  const inUse = articles.some((a) => a.tag_ids.includes(t.id))
  return { id: t.id, name: t.name, in_use: inUse }
}

export function listCategories() {
  return ok([...adminState.categories.values()].map(categoryProjection))
}

export function createCategory(body) {
  const name = body?.name?.trim()
  if (!name) return badRequest('name', '必填')
  if ([...adminState.categories.values()].some((c) => c.name.toLowerCase() === name.toLowerCase()))
    return conflict(40906, '分类名已存在')
  const id = adminState.nextCategoryId++
  adminState.categories.set(id, { id, name })
  return ok({ id, name })
}

export function renameCategory(id, body) {
  if (!ID_RE.test(id)) return notFound()
  const c = adminState.categories.get(Number(id))
  if (!c) return notFound()
  const name = body?.name?.trim()
  if (!name) return badRequest('name', '必填')
  // BR-TAX-004：被任意状态的文章引用就不能改名（§9.3 → 409 TAXONOMY_IN_USE）
  if (categoryProjection(c).in_use) return conflict(40904, '分类被文章引用，不能改名')
  if ([...adminState.categories.values()].some((x) => x.id !== Number(id) && x.name.toLowerCase() === name.toLowerCase()))
    return conflict(40906, '分类名已存在')
  c.name = name
  return ok({ id: c.id, name: c.name })
}

export function deleteCategory(id) {
  if (!ID_RE.test(id)) return notFound()
  const c = adminState.categories.get(Number(id))
  if (!c) return notFound()
  if (articles.some((a) => a.category_id === c.id))
    return conflict(40904, '分类被文章引用，无法删除')
  adminState.categories.delete(c.id)
  return ok({})
}

export function listTags(sp) {
  const page = intParam(sp, 'page', { def: 1, min: 1 })
  if (page.error) return page.error
  const size = intParam(sp, 'page_size', { def: 20, min: 1, max: 100 })
  if (size.error) return size.error
  const kw = (sp.get('keyword') ?? '').trim()
  let rows = [...adminState.tags.values()]
  if (kw) rows = rows.filter((t) => t.name.includes(kw))
  const start = (page.value - 1) * size.value
  return ok({
    items: rows.slice(start, start + size.value).map(tagProjection),
    page: page.value, page_size: size.value, total: rows.length,
  })
}

export function createTag(body) {
  const name = body?.name?.trim()
  if (!name) return badRequest('name', '必填')
  if ([...adminState.tags.values()].some((t) => t.name.toLowerCase() === name.toLowerCase()))
    return conflict(40906, '标签名已存在')
  const id = adminState.nextTagId++
  adminState.tags.set(id, { id, name })
  return ok({ id, name })
}

export function renameTag(id, body) {
  if (!ID_RE.test(id)) return notFound()
  const t = adminState.tags.get(Number(id))
  if (!t) return notFound()
  const name = body?.name?.trim()
  if (!name) return badRequest('name', '必填')
  // BR-TAX-004：被任意状态的文章引用就不能改名（§9.7 → 409 TAXONOMY_IN_USE）
  if (tagProjection(t).in_use) return conflict(40904, '标签被文章引用，不能改名')
  if ([...adminState.tags.values()].some((x) => x.id !== Number(id) && x.name.toLowerCase() === name.toLowerCase()))
    return conflict(40906, '标签名已存在')
  t.name = name
  return ok({ id: t.id, name: t.name })
}

export function deleteTag(id) {
  if (!ID_RE.test(id)) return notFound()
  const t = adminState.tags.get(Number(id))
  if (!t) return notFound()
  if (articles.some((a) => a.tag_ids.includes(t.id)))
    return conflict(40904, '标签被文章引用，无法删除')
  adminState.tags.delete(t.id)
  return ok({})
}

// ─── 路由入口 ───────────────────────────────────────────────────────────

/** 管理员端路由入口。只匹配 /api/{articles,reviews,categories,tags} 前缀。 */
export function handleAdmin(method, rawUrl, body = null) {
  const url = new URL(rawUrl, 'http://mock.local')
  const path = url.pathname.replace(/\/+$/, '')

  // 审核标准 GET
  if (path === '/api/reviews/standard' && method === 'GET') return getStandard()

  // 审核队列 GET
  if (path === '/api/reviews/queue' && method === 'GET') return getReviewQueue(url.searchParams)

  // 审核动作 POST
  let m = /^\/api\/articles\/([^/]+)\/approve$/.exec(path)
  if (m && method === 'POST') return approve(decodeURIComponent(m[1]), body)
  m = /^\/api\/articles\/([^/]+)\/reject$/.exec(path)
  if (m && method === 'POST') return reject(decodeURIComponent(m[1]), body)
  m = /^\/api\/articles\/([^/]+)\/unpublish$/.exec(path)
  if (m && method === 'POST') return unpublish(decodeURIComponent(m[1]), body)

  // 文章列表 / 计数
  if (path === '/api/articles' && method === 'GET') return listArticlesAdmin(url.searchParams)
  if (path === '/api/articles/counts' && method === 'GET') return getCounts(url.searchParams)

  // 文章详情 / 留痕
  m = /^\/api\/articles\/([^/]+)$/.exec(path)
  if (m && method === 'GET') return getArticleAdmin(decodeURIComponent(m[1]))
  m = /^\/api\/articles\/([^/]+)\/audit-logs$/.exec(path)
  if (m && method === 'GET') return getAuditLogs(decodeURIComponent(m[1]))

  // 分类
  if (path === '/api/categories') {
    if (method === 'GET') return listCategories()
    if (method === 'POST') return createCategory(body)
  }
  m = /^\/api\/categories\/([^/]+)$/.exec(path)
  if (m) {
    const id = decodeURIComponent(m[1])
    if (method === 'PUT') return renameCategory(id, body)
    if (method === 'DELETE') return deleteCategory(id)
  }

  // 标签
  if (path === '/api/tags') {
    if (method === 'GET') return listTags(url.searchParams)
    if (method === 'POST') return createTag(body)
  }
  m = /^\/api\/tags\/([^/]+)$/.exec(path)
  if (m) {
    const id = decodeURIComponent(m[1])
    if (method === 'PUT') return renameTag(id, body)
    if (method === 'DELETE') return deleteTag(id)
  }

  // 非 admin 路径 → 返回 notFound（由上层 handler 再尝试公开接口）
  return null
}
