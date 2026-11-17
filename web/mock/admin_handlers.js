// 管理员端接口 mock handlers（api-spec v0.1 §4.4~§4.21）。
// 与 handlers.js（公开接口）解耦：admin 端接口返回完整字段（含状态、作者、时间戳、留痕），
// 公开接口只返回白名单。两个 handler 函数在 mock/server.js 里按路径前缀路由。
//
// 注意：这是内存 mock，POST/PUT/DELETE 的改动只存在于当前 Vite dev server 生命周期。
// 真实后端实现以 api-spec 为准。
import { articles, categories, tags, authors, audit_logs, review_standard, getAdminArticleFields } from './db.js'

// 可变引用：admin 端会改分类/标签数组（新建/改名/删除），这些数组被外部 import
// 但 db.js 导出的是 const 数组，所以用 Map 做运行态
const adminState = {
  categories: new Map(categories.map((c) => [c.id, { ...c }])),
  tags: new Map(tags.map((t) => [t.id, { ...t }])),
  articleStatus: new Map(), // 文章状态运行态变更（approve → PUBLISHED / reject → REJECTED / unpublish → UNPUBLISHED）
  auditLogs: [...audit_logs],
  nextAuditId: audit_logs.length + 1,
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

/** 模拟留痕追加：所有 admin 动作都写一条 */
function appendAudit(articleId, action, detail) {
  const id = adminState.nextAuditId++
  adminState.auditLogs.push({
    id,
    article_id: articleId,
    operator_id: 1,
    operator_role: 'ADMIN',
    action,
    detail,
    operated_at: new Date().toISOString().replace('T', ' ').slice(0, 16).replace(' ', 'T') + '+08:00',
  })
}

const ok = (data) => ({ status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ code: 0, message: 'OK', data }) })
const notFound = () => ({ status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ code: 40400, message: '资源不存在', data: null }) })
const badRequest = (field, reason) => ({
  status: 400,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ code: 40000, message: '参数校验失败', data: { field_errors: [{ field, reason }] } }),
})
const conflict = (code, message, detail) => ({
  status: 409,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ code, message, data: detail ?? null }),
})

const ID_RE = /^[1-9]\d{0,18}$/
const authorById = new Map(authors.map((a) => [a.id, a]))

/** 管理员视角文章投影：全字段（api-spec §4.16） */
function projectArticle(a, fields = {}) {
  const cat = adminState.categories.get(a.category_id) || { id: a.category_id, name: '未知分类' }
  const tagList = a.tag_ids.map((id) => adminState.tags.get(id)).filter(Boolean)
  const author = authorById.get(a.author_id) || { id: a.author_id, username: 'unknown', role: 'EDITOR' }
  const status = currentStatus(a.id)
  return {
    id: a.id,
    title: a.title,
    excerpt: a.excerpt ?? '',
    category: { id: cat.id, name: cat.name },
    tags: tagList.map((t) => ({ id: t.id, name: t.name })),
    cover_url: a.cover_media_id ? `/api/media/${a.cover_media_id}` : null,
    author: { id: author.id, username: author.username },
    status,
    submission_round: a.submission_round ?? null,
    submitted_at: fields.submitted_at ?? null,
    scheduled_publish_time: a.scheduled_publish_time ?? null,
    published_at: status === 'PUBLISHED' ? a.published_at : null,
    created_at: fields.created_at ?? null,
    updated_at: fields.updated_at ?? null,
    reject_reason: status === 'REJECTED' ? a.reject_reason ?? null : null,
    unpublish_reason: status === 'UNPUBLISHED' ? a.unpublish_reason ?? null : null,
    // 审核详情才返回正文和 current_submission_id，列表不返回正文（api-spec §2.4）
  }
}

/** 审核详情额外字段：content + current_submission_id */
function projectArticleDetail(a, fields) {
  const base = projectArticle(a, fields)
  if (a.status === 'PENDING_REVIEW') base.current_submission_id = fields.current_submission_id ?? null
  base.content = a.content
  return base
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
  const items = rows.slice(start, start + size.value).map(({ a }) => projectArticle(a, getAdminArticleFields(a.id)))
  return ok({ items, page: page.value, page_size: size.value, total: rows.length })
}

/** GET /api/articles/counts (#32) */
export function getCounts(sp) {
  const rows = articles.map((a) => ({ a, s: currentStatus(a.id) }))
  const title = (sp.get('title') ?? '').trim()
  const catRaw = sp.get('category_id')
  if (catRaw) rows = rows.filter(({ a }) => a.category_id === Number(catRaw))
  if (title) rows = rows.filter(({ a }) => a.title.includes(title))
  const counts = { DRAFT: 0, PENDING_REVIEW: 0, REJECTED: 0, SCHEDULED: 0, PUBLISHED: 0, UNPUBLISHED: 0 }
  rows.forEach(({ s }) => (counts[s] = (counts[s] || 0) + 1))
  return ok(counts)
}

/** GET /api/articles/{id} (#8 管理员视角) */
export function getArticleAdmin(id) {
  if (!ID_RE.test(id)) return notFound()
  const a = articles.find((x) => x.id === Number(id))
  if (!a) return notFound()
  return ok(projectArticleDetail(a, getAdminArticleFields(a.id)))
}

/** GET /api/articles/{id}/audit-logs (#19) */
export function getAuditLogs(id) {
  if (!ID_RE.test(id)) return notFound()
  const a = articles.find((x) => x.id === Number(id))
  if (!a) return notFound()
  const logs = adminState.auditLogs
    .filter((l) => l.article_id === Number(id))
    .sort((x, y) => Date.parse(x.operated_at) - Date.parse(y.operated_at))
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

  let rows = articles
    .filter((a) => currentStatus(a.id) === 'PENDING_REVIEW')
    .map((a) => ({ a, fields: getAdminArticleFields(a.id) }))

  if (catRaw) rows = rows.filter(({ a }) => a.category_id === Number(catRaw))
  if (authorRaw) rows = rows.filter(({ a }) => a.author_id === Number(authorRaw))
  if (title) rows = rows.filter(({ a }) => a.title.includes(title))

  // 按 submitted_at 升序（api-spec §4.4）
  rows.sort((x, y) => Date.parse(x.fields.submitted_at) - Date.parse(y.fields.submitted_at) || x.a.id - y.a.id)

  const start = (page.value - 1) * size.value
  const items = rows.slice(start, start + size.value).map(({ a, fields }) => projectArticle(a, fields))
  return ok({ items, page: page.value, page_size: size.value, total: rows.length })
}

/** GET /api/reviews/standard (#15) */
export function getStandard() {
  return ok(review_standard)
}

/** 审核通过 / 驳回：状态闸（api-spec §3.3 状态闸 409） */
function reviewGuard(id) {
  if (!ID_RE.test(id)) return notFound()
  const a = articles.find((x) => x.id === Number(id))
  if (!a) return notFound()
  const st = currentStatus(a.id)
  if (st !== 'PENDING_REVIEW') {
    return conflict(40901, `状态为 ${st}，无法进行审核操作`, { current_status: st, allowed_statuses: ['PENDING_REVIEW'] })
  }
  return { a }
}

/** POST /api/articles/{id}/approve (#16) */
export function approve(id, body) {
  const g = reviewGuard(id)
  if (g.error) return g.error
  if (!body?.submission_id) return badRequest('submission_id', '必填')
  setStatus(g.a.id, 'PUBLISHED')
  appendAudit(g.a.id, 'APPROVE', { submission_id: body.submission_id })
  return ok({ id: g.a.id, status: 'PUBLISHED' })
}

/** POST /api/articles/{id}/reject (#17) */
export function reject(id, body) {
  const g = reviewGuard(id)
  if (g.error) return g.error
  if (!body?.submission_id) return badRequest('submission_id', '必填')
  if (!body?.reject_category) return badRequest('reject_category', '必填')
  setStatus(g.a.id, 'REJECTED')
  appendAudit(g.a.id, 'REJECT', {
    submission_id: body.submission_id,
    reason_category: body.reject_category,
    reason_comment: body.comment ?? '',
  })
  return ok({ id: g.a.id, status: 'REJECTED' })
}

/** POST /api/articles/{id}/unpublish (#18) */
export function unpublish(id, body) {
  if (!ID_RE.test(id)) return notFound()
  const a = articles.find((x) => x.id === Number(id))
  if (!a) return notFound()
  const st = currentStatus(a.id)
  if (st !== 'PUBLISHED') {
    return conflict(40901, `状态为 ${st}，无法下架`, { current_status: st })
  }
  if (!body?.reason || !body.reason.trim()) return badRequest('reason', '下架原因必填')
  setStatus(a.id, 'UNPUBLISHED')
  appendAudit(a.id, 'UNPUBLISH', { reason: body.reason.trim() })
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
    return conflict(40902, '分类名已存在')
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
  if ([...adminState.categories.values()].some((x) => x.id !== Number(id) && x.name.toLowerCase() === name.toLowerCase()))
    return conflict(40902, '分类名已存在')
  c.name = name
  return ok({ id: c.id, name: c.name })
}

export function deleteCategory(id) {
  if (!ID_RE.test(id)) return notFound()
  const c = adminState.categories.get(Number(id))
  if (!c) return notFound()
  if (articles.some((a) => a.category_id === c.id))
    return conflict(40903, '分类下还有文章，无法删除', { used_count: articles.filter((a) => a.category_id === c.id).length })
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
    return conflict(40902, '标签名已存在')
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
  if ([...adminState.tags.values()].some((x) => x.id !== Number(id) && x.name.toLowerCase() === name.toLowerCase()))
    return conflict(40902, '标签名已存在')
  t.name = name
  return ok({ id: t.id, name: t.name })
}

export function deleteTag(id) {
  if (!ID_RE.test(id)) return notFound()
  const t = adminState.tags.get(Number(id))
  if (!t) return notFound()
  if (articles.some((a) => a.tag_ids.includes(t.id)))
    return conflict(40903, '标签被文章引用，无法删除', { used_count: articles.filter((a) => a.tag_ids.includes(t.id)).length })
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
