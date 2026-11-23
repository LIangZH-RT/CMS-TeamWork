// 管理员端接口 mock handlers（api-spec v0.1 §4.4~§4.21）。
// 与 handlers.js（公开接口）解耦：admin 端接口返回完整字段（含状态、作者、时间戳、留痕），
// 公开接口只返回白名单。两个 handler 函数在 mock/server.js 里按路径前缀路由。
//
// 注意：这是内存 mock，POST/PUT/DELETE 的改动只存在于当前 Vite dev server 生命周期。
// 真实后端实现以 api-spec 为准。
import { articles, categories, tags, authors, media, audit_logs, auditLog, review_standard, getAdminArticleFields } from './db.js'
import { makeCoverPng, makeDiagramPng, makeWav } from './assets.js'
import { actorFromHeaders, csrfOk, writeOplog } from './session.js'

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
  nextArticleId: articles.reduce((m, a) => Math.max(m, a.id), 0) + 1,
  nextMediaId: media.reduce((m, a) => Math.max(m, a.id), 0) + 1,
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
function appendAudit(articleId, action, extra = {}, operator = ADMIN_ACTOR) {
  const log = auditLog(adminState.nextAuditId++, articleId, action, operator, nowCst(), extra)
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
const created = (data) => ({ status: 201, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ code: 0, message: 'OK', data }) })
const unauth = () => ({ status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ code: 40100, message: '未登录', data: null }) })
const csrfFail = () => ({ status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ code: 40300, message: 'CSRF 令牌无效', data: null }) })

const ID_RE = /^[1-9]\d{0,18}$/
const authorById = new Map(authors.map((a) => [a.id, a]))

// ─── 投影（字段按 api-spec §4.10～§4.12，不多不少） ─────────────────────

const mediaById = new Map(media.map((m) => [m.id, m]))
const mediaSizeCache = new Map()
/** MediaRef（§4.8）：{ media_id, url, mime_type, size } */
function mediaRef(id) {
  const m = id && (mediaById.get(id) || media.find((x) => x.id === id))
  if (m && !mediaById.has(m.id)) mediaById.set(m.id, m)
  if (!m) return null
  if (!mediaSizeCache.has(m.id)) {
    const palette = m.palette?.length ? m.palette : ['#1e3a8a', '#7c3aed']
    const buf = m.kind === 'audio' ? makeWav() : m.kind === 'diagram' ? makeDiagramPng() : makeCoverPng(m.id, ...palette)
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
    version: a.version ?? 0,
  }
}

/** 归属编辑的 allowed_actions（§4.1）。无留痕的草稿才有 DELETE。 */
function editorAllowedActions(a) {
  const status = currentStatus(a.id)
  if (status === 'DRAFT') {
    const actions = ['EDIT', 'UPLOAD_MEDIA', 'SUBMIT']
    if (!logsOf(a.id).length) actions.push('DELETE')
    return actions
  }
  if (status === 'REJECTED' || status === 'UNPUBLISHED') return ['EDIT', 'UPLOAD_MEDIA', 'SUBMIT']
  if (status === 'SCHEDULED') {
    const actions = ['WITHDRAW']
    const sched = a.scheduled_publish_time
    if (sched && Date.parse(sched) > Date.now()) actions.push('RESCHEDULE')
    return actions
  }
  return []
}

function visibleArticles() {
  return articles.filter((a) => !a.deleted)
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

const ARTICLE_SORT = new Set(['updated_at', 'created_at', 'published_at', 'title', 'id'])
const STATUSES = ['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED']

function stamp(a, field) {
  if (field === 'id') return a.id
  if (field === 'title') return a.title || ''
  if (field === 'published_at') return publishedAt(a) || ''
  if (field === 'created_at') return a.created_at || getAdminArticleFields(a.id).created_at || ''
  return a.updated_at || getAdminArticleFields(a.id).updated_at || ''
}

function categoryScope(id) {
  const ids = new Set([id])
  for (const c of adminState.categories.values()) {
    if (!c.deleted && c.parent_id === id) ids.add(c.id)
  }
  return ids
}

/** 列表与计数共用的筛选。actor 为空时保持旧的管理员全量口径（单测不传会话）。 */
function selectArticles(sp, actor, { withStatus }) {
  const statuses = withStatus ? sp.getAll('status').filter((s) => s !== '') : []
  if (statuses.some((s) => !STATUSES.includes(s))) return { error: badRequest('status', '枚举值不合法') }
  const catRaw = sp.get('category_id')
  if (catRaw !== null && catRaw !== '' && !ID_RE.test(catRaw)) return { error: badRequest('category_id', '必须是正整数') }
  const authorRaw = sp.get('author_id')
  if (authorRaw !== null && authorRaw !== '' && !ID_RE.test(authorRaw)) return { error: badRequest('author_id', '必须是正整数') }
  const keyword = (sp.get('keyword') ?? sp.get('title') ?? '').trim()
  if ([...keyword].length > 100) return { error: badRequest('keyword', '不能超过 100 个字符') }
  const tagIds = sp.getAll('tag_ids').filter((v) => v !== '')
  if (tagIds.some((v) => !ID_RE.test(v))) return { error: badRequest('tag_ids', '必须是正整数') }
  const sorts = sp.getAll('sort').filter((s) => s !== '')
  const parsedSort = []
  for (const item of sorts) {
    const [field, dir] = item.split(',')
    if (!ARTICLE_SORT.has(field) || (dir !== 'asc' && dir !== 'desc')) return { error: badRequest('sort', '不在白名单', 40018) }
    parsedSort.push([field, dir])
  }
  let rows = visibleArticles().map((a) => ({ a, s: currentStatus(a.id) }))
  if (actor?.role === 'EDITOR') rows = rows.filter(({ a }) => a.author_id === actor.id)
  if (statuses.length) rows = rows.filter(({ s }) => statuses.includes(s))
  if (catRaw) {
    const ids = categoryScope(Number(catRaw))
    rows = rows.filter(({ a }) => ids.has(a.category_id))
  }
  if (authorRaw) rows = rows.filter(({ a }) => a.author_id === Number(authorRaw))
  if (keyword) rows = rows.filter(({ a }) => a.title.includes(keyword) || (a.excerpt || '').includes(keyword))
  for (const t of new Set(tagIds.map(Number))) rows = rows.filter(({ a }) => a.tag_ids.includes(t))
  if (parsedSort.length) {
    rows.sort((x, y) => {
      for (const [field, dir] of parsedSort) {
        const av = stamp(x.a, field)
        const bv = stamp(y.a, field)
        if (av === bv) continue
        const cmp = av > bv ? 1 : -1
        return dir === 'asc' ? cmp : -cmp
      }
      return x.a.id - y.a.id
    })
  } else {
    rows.sort((x, y) => Date.parse(stamp(y.a, 'updated_at')) - Date.parse(stamp(x.a, 'updated_at')) || y.a.id - x.a.id)
  }
  return { rows }
}

/** GET /api/articles (#6)：管理员不传 author_id → 全量 */
export function listArticlesAdmin(sp, actor = null) {
  const page = intParam(sp, 'page', { def: 1, min: 1 })
  if (page.error) return page.error
  const size = intParam(sp, 'page_size', { def: 20, min: 1, max: 100 })
  if (size.error) return size.error
  const selected = selectArticles(sp, actor, { withStatus: true })
  if (selected.error) return selected.error
  const start = (page.value - 1) * size.value
  const items = selected.rows.slice(start, start + size.value).map(({ a }) => {
    const item = toAdminListItem(a)
    if (actor?.role === 'EDITOR') item.allowed_actions = editorAllowedActions(a)
    return item
  })
  return ok({ items, page: page.value, page_size: size.value, total: selected.rows.length })
}

/** GET /api/articles/counts（§6.9）：参数与列表相同但没有 status / 分页；返回 { by_status, total } */
export function getCounts(sp, actor = null) {
  const selected = selectArticles(sp, actor, { withStatus: false })
  if (selected.error) return selected.error
  const by_status = { DRAFT: 0, PENDING_REVIEW: 0, REJECTED: 0, SCHEDULED: 0, PUBLISHED: 0, UNPUBLISHED: 0 }
  selected.rows.forEach(({ s }) => (by_status[s] += 1))
  return ok({ by_status, total: selected.rows.length })
}

function projectDetail(a, actor) {
  const detail = toAdminDetail(a)
  if (actor?.role === 'EDITOR') detail.allowed_actions = editorAllowedActions(a)
  return detail
}

/** GET /api/articles/{id} (#8 管理员视角) */
export function getArticleAdmin(id, actor = null) {
  if (!ID_RE.test(id)) return notFound()
  const a = articles.find((x) => x.id === Number(id) && !x.deleted)
  if (!a) return notFound()
  if (actor?.role === 'EDITOR' && a.author_id !== actor.id) return notFound()
  return ok(projectDetail(a, actor))
}

/** GET /api/articles/{id}/audit-logs (#19) */
export function getAuditLogs(id, actor = null) {
  if (!ID_RE.test(id)) return notFound()
  const a = articles.find((x) => x.id === Number(id) && !x.deleted)
  if (!a) return notFound()
  if (actor?.role === 'EDITOR' && a.author_id !== actor.id) return notFound()
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

  let rows = visibleArticles()
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

const SEED_TIME = '2026-10-19T00:00:00+08:00'

function categoryProjection(c, { withChildren = false } = {}) {
  const inUse = visibleArticles().some((a) => a.category_id === c.id)
  const node = {
    id: c.id,
    name: c.name,
    parent_id: c.parent_id ?? null,
    sort_order: c.sort_order ?? 0,
    status: c.status ?? 'ENABLED',
    in_use: inUse,
    created_at: c.created_at || SEED_TIME,
    updated_at: c.updated_at || SEED_TIME,
    children: [],
  }
  if (!withChildren) return node
  return node
}

function tagProjection(t) {
  const inUse = articles.some((a) => a.tag_ids.includes(t.id))
  return { id: t.id, name: t.name, in_use: inUse }
}

function aliveCategories() {
  return [...adminState.categories.values()].filter((c) => !c.deleted)
}

export function listCategories(sp = new URLSearchParams()) {
  const status = sp.get?.('status') ?? null
  if (status && status !== 'ENABLED' && status !== 'DISABLED') return badRequest('status', '枚举值不合法')
  let all = aliveCategories()
  if (status === 'ENABLED') {
    const disabledRoots = new Set(all.filter((c) => !c.parent_id && c.status === 'DISABLED').map((c) => c.id))
    all = all.filter((c) => c.status !== 'DISABLED' && !disabledRoots.has(c.parent_id))
  } else if (status === 'DISABLED') {
    all = all.filter((c) => c.status === 'DISABLED')
  }
  const nodes = new Map(all.map((c) => [c.id, categoryProjection(c)]))
  const roots = []
  for (const c of all) {
    const node = nodes.get(c.id)
    if (c.parent_id && nodes.has(c.parent_id)) nodes.get(c.parent_id).children.push(node)
    else roots.push(node)
  }
  const byOrder = (a, b) => a.sort_order - b.sort_order || a.id - b.id
  roots.sort(byOrder)
  for (const r of roots) r.children.sort(byOrder)
  return ok(roots)
}

export function createCategory(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name || [...name].length > 50) return badRequest('name', '必填，1～50 个字符')
  const parentId = body?.parent_id ?? null
  if (parentId != null && !ID_RE.test(String(parentId))) return badRequest('parent_id', '必须是正整数')
  if (parentId != null) {
    const parent = adminState.categories.get(Number(parentId))
    if (!parent || parent.deleted) return badRequest('parent_id', '父分类不存在')
    if (parent.parent_id) return badRequest('parent_id', '分类最多两级', 40016)
  }
  if (aliveCategories().some((c) => c.name.toLowerCase() === name.toLowerCase())) return conflict(40906, '分类名已存在')
  const id = adminState.nextCategoryId++
  const row = {
    id,
    name,
    parent_id: parentId == null ? null : Number(parentId),
    sort_order: Number.isInteger(body?.sort_order) ? body.sort_order : 0,
    status: 'ENABLED',
    created_at: nowCst(),
    updated_at: nowCst(),
  }
  adminState.categories.set(id, row)
  return created(categoryProjection(row))
}

export function renameCategory(id, body) {
  if (!ID_RE.test(id)) return notFound()
  const c = adminState.categories.get(Number(id))
  if (!c || c.deleted) return notFound()
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name || [...name].length > 50) return badRequest('name', '必填，1～50 个字符')
  const hasParent = body && Object.prototype.hasOwnProperty.call(body, 'parent_id')
  const parentId = hasParent ? body.parent_id : (c.parent_id ?? null)
  if (parentId != null && !ID_RE.test(String(parentId))) return badRequest('parent_id', '必须是正整数')
  if (parentId != null && Number(parentId) === c.id) return badRequest('parent_id', '不能把自己当作父分类', 40016)
  if (parentId != null) {
    const parent = adminState.categories.get(Number(parentId))
    if (!parent || parent.deleted) return badRequest('parent_id', '父分类不存在')
    if (parent.parent_id) return badRequest('parent_id', '分类最多两级', 40016)
    const hasChild = aliveCategories().some((x) => x.parent_id === c.id)
    if (hasChild) return badRequest('parent_id', '有子分类时不能再设置父分类', 40016)
  }
  const nameChanged = name.toLowerCase() !== c.name.toLowerCase()
  const parentChanged = (parentId ?? null) !== (c.parent_id ?? null)
  if (categoryProjection(c).in_use && (nameChanged || parentChanged)) return conflict(40904, '分类被文章引用，不能改名')
  if (aliveCategories().some((x) => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase())) return conflict(40906, '分类名已存在')
  c.name = name
  c.parent_id = parentId ?? null
  c.updated_at = nowCst()
  return ok(categoryProjection(c))
}

export function deleteCategory(id) {
  if (!ID_RE.test(id)) return notFound()
  const c = adminState.categories.get(Number(id))
  if (!c || c.deleted) return notFound()
  if (visibleArticles().some((a) => a.category_id === c.id)) return conflict(40904, '分类被文章引用，无法删除')
  if (aliveCategories().some((x) => x.parent_id === c.id)) return conflict(40908, '请先删除子分类')
  c.deleted = true
  return ok(null)
}

export function setCategoryStatus(id, body) {
  if (!ID_RE.test(id)) return notFound()
  const c = adminState.categories.get(Number(id))
  if (!c || c.deleted) return notFound()
  if (body?.status !== 'ENABLED' && body?.status !== 'DISABLED') return badRequest('status', '必须是 ENABLED 或 DISABLED')
  c.status = body.status
  c.updated_at = nowCst()
  return ok(categoryProjection(c))
}

export function sortCategories(body) {
  const items = body?.items
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) return badRequest('items', '1～50 条', 40017)
  const parentId = body?.parent_id ?? null
  if (parentId != null && !ID_RE.test(String(parentId))) return badRequest('parent_id', '必须是正整数')
  if (parentId != null) {
    const parent = adminState.categories.get(Number(parentId))
    if (!parent || parent.deleted) return notFound()
  }
  const siblings = aliveCategories().filter((c) => (c.parent_id ?? null) === (parentId == null ? null : Number(parentId)))
  const byId = new Map(siblings.map((c) => [c.id, c]))
  if (items.some((it) => !byId.has(Number(it?.id)) || !Number.isInteger(it?.sort_order))) return badRequest('items', '条目不属于该父级')
  for (const it of items) byId.get(Number(it.id)).sort_order = it.sort_order
  return ok(siblings.map((c) => categoryProjection(c)).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id))
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

// ─── 编辑写路径（#7、#9–#13、#28、#40–#42）────────────────────────────────

const FORBIDDEN_ARTICLE_FIELDS = ['status', 'author_id', 'id', 'published_at', 'version', 'created_at', 'updated_at', 'role']
const DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

function systemField(body) {
  if (!body || typeof body !== 'object') return null
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_ARTICLE_FIELDS.includes(key)) return badRequest(key, '系统字段不可写', 40001)
  }
  return null
}

function contentRejected(content) {
  const stripped = String(content).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
  if (/<\s*(script|iframe|img|video|object|embed)\b/i.test(stripped)) return true
  if (/javascript:|vbscript:|data:/i.test(stripped)) return true
  for (const m of stripped.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    if (!/^\/api\/media\/[1-9]\d{0,18}$/.test(m[1].trim())) return true
  }
  return false
}

function categoryUsable(id) {
  const c = adminState.categories.get(Number(id))
  if (!c || c.deleted) return 'missing'
  if ((c.status ?? 'ENABLED') === 'DISABLED') return 'disabled'
  if (c.parent_id) {
    const p = adminState.categories.get(c.parent_id)
    if (!p || p.deleted) return 'missing'
    if ((p.status ?? 'ENABLED') === 'DISABLED') return 'disabled'
  }
  return 'ok'
}

function editorOf(actor) {
  if (actor?.role === 'EDITOR') return actor
  if (!actor) return authors.find((a) => a.role === 'EDITOR') || { id: 11, username: 'zhangsan', role: 'EDITOR' }
  return null
}

function loadArticle(id, actor) {
  if (!ID_RE.test(String(id))) return { error: notFound() }
  const a = articles.find((x) => x.id === Number(id) && !x.deleted)
  if (!a) return { error: notFound() }
  const editor = editorOf(actor)
  if (!editor) return { error: notFound() }
  if (actor && a.author_id !== editor.id) return { error: notFound() }
  return { a, editor }
}

function actorBrief(editor) {
  return { type: 'USER', id: editor.id, username: editor.username }
}

export function createArticle(body, actor = null) {
  const badField = systemField(body)
  if (badField) return badField
  const editor = editorOf(actor)
  if (!editor) return notFound()
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const content = typeof body?.content === 'string' ? body.content : ''
  if (!title || [...title].length > 200 || !content) return badRequest('title', '标题与正文必填')
  if (contentRejected(content)) return badRequest('content', '正文不合规', 40004)
  const cat = categoryUsable(body?.category_id)
  if (cat === 'missing') return badRequest('category_id', '分类不存在', 40008)
  if (cat === 'disabled') return badRequest('category_id', '分类已停用', 40015)
  const tagIds = Array.isArray(body?.tag_ids) ? body.tag_ids : []
  if (tagIds.some((id) => !adminState.tags.has(Number(id)))) return badRequest('tag_ids', '标签不存在', 40008)
  let scheduled = body?.scheduled_publish_time ?? null
  if (scheduled != null && !DT_RE.test(scheduled)) return badRequest('scheduled_publish_time', '必须带时区偏移')
  const now = nowCst()
  const row = {
    id: adminState.nextArticleId++,
    title,
    content,
    excerpt: typeof body?.excerpt === 'string' ? body.excerpt : '',
    category_id: Number(body.category_id),
    tag_ids: tagIds.map(Number),
    cover_media_id: null,
    audio_media_id: null,
    published_at: null,
    scheduled_publish_time: scheduled,
    status: 'DRAFT',
    author_id: editor.id,
    version: 0,
    created_at: now,
    updated_at: now,
  }
  articles.push(row)
  return created(projectDetail(row, { role: 'EDITOR' }))
}

export function updateArticle(id, body, actor = null) {
  const badField = systemField(body)
  if (badField) return badField
  const g = loadArticle(id, actor)
  if (g.error) return g.error
  const status = currentStatus(g.a.id)
  if (!['DRAFT', 'REJECTED', 'UNPUBLISHED'].includes(status)) return conflict(40900, '当前状态不允许此操作')
  if (!Number.isInteger(body?.expected_version)) return badRequest('expected_version', '必填')
  if ((g.a.version ?? 0) !== body.expected_version) return conflict(40907, '文章已被修改，请刷新后重做')
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const content = typeof body?.content === 'string' ? body.content : ''
  if (!title || !content) return badRequest('title', '标题与正文必填')
  if (contentRejected(content)) return badRequest('content', '正文不合规', 40004)
  const cat = categoryUsable(body?.category_id)
  if (cat === 'missing') return badRequest('category_id', '分类不存在', 40008)
  if (cat === 'disabled') return badRequest('category_id', '分类已停用', 40015)
  const tagIds = Array.isArray(body?.tag_ids) ? body.tag_ids : []
  if (tagIds.some((tid) => !adminState.tags.has(Number(tid)))) return badRequest('tag_ids', '标签不存在', 40008)
  const sched = body?.scheduled_publish_time ?? null
  if (sched != null && !DT_RE.test(sched)) return badRequest('scheduled_publish_time', '必须带时区偏移')
  for (const [key, usage] of [['cover_media_id', 'COVER'], ['audio_media_id', 'AUDIO']]) {
    const mid = body?.[key]
    if (mid == null) continue
    const mediaRow = media.find((m) => m.id === Number(mid))
    if (!mediaRow || mediaRow.article_id !== g.a.id || (mediaRow.usage || (mediaRow.kind === 'audio' ? 'AUDIO' : mediaRow.kind === 'diagram' ? 'INLINE_IMAGE' : 'COVER')) !== usage) {
      return badRequest(key, '媒体引用无效', 40005)
    }
  }
  g.a.title = title
  g.a.content = content
  g.a.excerpt = typeof body?.excerpt === 'string' ? body.excerpt : ''
  g.a.category_id = Number(body.category_id)
  g.a.tag_ids = tagIds.map(Number)
  g.a.cover_media_id = body?.cover_media_id == null ? null : Number(body.cover_media_id)
  g.a.audio_media_id = body?.audio_media_id == null ? null : Number(body.audio_media_id)
  g.a.scheduled_publish_time = sched
  g.a.version = (g.a.version ?? 0) + 1
  g.a.updated_at = nowCst()
  return ok(projectDetail(g.a, { role: 'EDITOR' }))
}

export function deleteDraft(id, confirm, actor = null) {
  const g = loadArticle(id, actor)
  if (g.error) return g.error
  if (currentStatus(g.a.id) !== 'DRAFT') return conflict(40900, '当前状态不允许此操作')
  if (logsOf(g.a.id).length) return conflict(40903, '草稿曾经提交过，不能删除')
  if (confirm !== true && confirm !== 'true') return badRequest('confirm', '需要二次确认', 40013)
  g.a.deleted = true
  writeOplog({
    operator: { id: g.editor.id, username: g.editor.username },
    module: 'ARTICLE',
    operation: 'ARTICLE_DELETE',
    target_type: 'ARTICLE',
    target_id: g.a.id,
    http_method: 'DELETE',
    request_uri: `/api/articles/${g.a.id}`,
    success: true,
  })
  return ok(null)
}

function dedupeIds(ids) {
  const out = []
  const seen = new Set()
  for (const id of ids || []) {
    const key = String(id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

function batchOf(results) {
  const succeeded = results.filter((r) => r.success).length
  return ok({ total: results.length, succeeded, failed: results.length - succeeded, results })
}

function resultOf(id, res) {
  const body = JSON.parse(res.body)
  return { id: Number(id), success: body.code === 0, code: body.code, message: body.code === 0 ? 'OK' : body.message }
}

export function submitArticle(id, actor = null) {
  const g = loadArticle(id, actor)
  if (g.error) return g.error
  const status = currentStatus(g.a.id)
  if (!['DRAFT', 'REJECTED', 'UNPUBLISHED'].includes(status)) return conflict(40900, '当前状态不允许此操作')
  if (!g.a.title?.trim() || !g.a.content?.trim() || !g.a.category_id) return badRequest('title', '必填内容缺失', 40014)
  setStatus(g.a.id, 'PENDING_REVIEW')
  const log = appendAudit(g.a.id, 'SUBMIT', {}, actorBrief(g.editor))
  g.a.updated_at = log.operated_at
  return ok({ id: g.a.id, status: 'PENDING_REVIEW', submitted_at: log.operated_at })
}

export function withdrawArticle(id, actor = null) {
  const g = loadArticle(id, actor)
  if (g.error) return g.error
  if (currentStatus(g.a.id) !== 'SCHEDULED') return conflict(40900, '当前状态不允许此操作')
  setStatus(g.a.id, 'DRAFT')
  g.a.scheduled_publish_time = null
  appendAudit(g.a.id, 'WITHDRAW', {}, actorBrief(g.editor))
  return ok({ id: g.a.id, status: 'DRAFT', scheduled_publish_time: null })
}

export function rescheduleArticle(id, body, actor = null) {
  const g = loadArticle(id, actor)
  if (g.error) return g.error
  const next = body?.scheduled_publish_time
  if (!DT_RE.test(next || '')) return badRequest('scheduled_publish_time', '必须带时区偏移')
  if (Date.parse(next) <= Date.now()) return badRequest('scheduled_publish_time', '必须晚于当前时间', 40009)
  if (currentStatus(g.a.id) !== 'SCHEDULED') return conflict(40900, '当前状态不允许此操作')
  const prev = g.a.scheduled_publish_time
  if (prev && Date.parse(prev) <= Date.now()) return conflict(40902, '预定时间已到，不能再改期')
  if (body?.expected_scheduled_publish_time && body.expected_scheduled_publish_time !== prev) return conflict(40900, '预定时间已变化')
  g.a.scheduled_publish_time = next
  appendAudit(g.a.id, 'RESCHEDULE', { schedule_change: { from: prev, to: next } }, actorBrief(g.editor))
  return ok({ id: g.a.id, status: 'SCHEDULED', scheduled_publish_time: next })
}

export function uploadMedia(id, body, actor = null) {
  const g = loadArticle(id, actor)
  if (g.error) return g.error
  if (!['DRAFT', 'REJECTED', 'UNPUBLISHED'].includes(currentStatus(g.a.id))) return conflict(40900, '当前状态不允许此操作')
  const usage = body?.usage
  if (!body?.__multipart && !body?.filename) return badRequest('file', '缺少文件')
  if (!['COVER', 'INLINE_IMAGE', 'AUDIO'].includes(usage)) return badRequest('usage', '用途无效')
  const filename = String(body.filename || body.original_name || 'file')
  const ext = (filename.split('.').pop() || '').toLowerCase()
  const imageExt = ['jpg', 'jpeg', 'png', 'gif', 'webp']
  const audioExt = ['mp3', 'm4a', 'wav', 'ogg']
  if (usage === 'AUDIO' ? !audioExt.includes(ext) : !imageExt.includes(ext)) return badRequest('file', '格式不在白名单', 40006)
  const size = Number(body.size) || 1024
  const limit = usage === 'AUDIO' ? 20 * 1024 * 1024 : 5 * 1024 * 1024
  if (size > limit) return badRequest('file', '超过大小上限', 40007)
  const mediaId = adminState.nextMediaId++
  media.push({
    id: mediaId,
    article_id: g.a.id,
    kind: usage === 'AUDIO' ? 'audio' : usage === 'INLINE_IMAGE' ? 'diagram' : 'cover',
    usage,
    palette: ['#1e3a8a', '#7c3aed'],
    original_name: filename.split(/[/\\]/).pop().slice(0, 255),
    unreferenced: true,
  })
  return created({
    media_id: mediaId,
    article_id: g.a.id,
    usage,
    url: `/api/media/${mediaId}`,
    mime_type: usage === 'AUDIO' ? 'audio/wav' : 'image/png',
    size,
    original_name: filename.split(/[/\\]/).pop().slice(0, 255),
    download_url: `/api/media/${mediaId}/download`,
    linked: false,
    created_at: nowCst(),
  })
}

// ─── 路由入口 ───────────────────────────────────────────────────────────

function passThrough(path, method) {
  if (path.startsWith('/api/public') || path.startsWith('/api/auth')) return true
  if (path.startsWith('/api/admin') || path === '/api/roles' || path === '/api/permissions') return true
  if ((method === 'GET' || method === 'HEAD') && /^\/api\/media\/[^/]+(\/download)?$/.test(path)) return true
  return false
}

function denied(actor, method, path) {
  const editorWrite = (method === 'POST' && (path === '/api/articles' || path === '/api/articles/batch-delete'))
    || (method === 'PUT' && /^\/api\/articles\/[^/]+$/.test(path))
    || (method === 'DELETE' && /^\/api\/articles\/[^/]+$/.test(path))
    || /^\/api\/articles\/[^/]+\/(submit|withdraw|reschedule|media)$/.test(path)
  const adminOnly = path.startsWith('/api/reviews')
    || /^\/api\/articles\/[^/]+\/(approve|reject|unpublish)$/.test(path)
    || (path.startsWith('/api/categories') && method !== 'GET')
  if (actor.role === 'ADMIN' && editorWrite) return true
  if (actor.role === 'EDITOR' && adminOnly) return true
  return false
}

/** 后台接口入口。不传 headers 时不校验会话，便于既有单测直接调用。 */
export function handleAdmin(method, rawUrl, body = null, headers = undefined) {
  const url = new URL(rawUrl, 'http://mock.local')
  const path = url.pathname.replace(/\/+$/, '')
  if (passThrough(path, method)) return null

  const enforce = headers !== undefined
  const actor = enforce ? actorFromHeaders(headers) : null
  if (enforce && !actor) return unauth()
  if (enforce && !['GET', 'HEAD'].includes(method) && !csrfOk(headers)) return csrfFail()
  if (enforce && denied(actor, method, path)) return notFound()

  if (path === '/api/reviews/standard' && method === 'GET') return getStandard()
  if (path === '/api/reviews/queue' && method === 'GET') return getReviewQueue(url.searchParams)
  if (path === '/api/reviews/batch-approve' && method === 'POST') {
    const items = dedupeIds((body?.items || []).map((it) => it?.article_id))
    if (!Array.isArray(body?.items) || items.length < 1 || items.length > 50) return badRequest('items', '1～50 条', 40017)
    if (body.items.some((it) => !ID_RE.test(String(it?.submission_id ?? '')))) return badRequest('submission_id', '必填', 40010)
    const results = []
    const seen = new Set()
    for (const it of body.items) {
      if (seen.has(String(it.article_id))) continue
      seen.add(String(it.article_id))
      results.push(resultOf(it.article_id, approve(String(it.article_id), { submission_id: it.submission_id })))
    }
    return batchOf(results)
  }
  if (path === '/api/reviews/batch-unpublish' && method === 'POST') {
    const ids = dedupeIds(body?.article_ids)
    if (ids.length < 1 || ids.length > 50) return badRequest('article_ids', '1～50 条', 40017)
    if (typeof body?.reason !== 'string' || !body.reason.trim()) return badRequest('reason', '下架原因必填', 40012)
    return batchOf(ids.map((id) => resultOf(id, unpublish(String(id), { reason: body.reason }))))
  }

  let m = /^\/api\/articles\/([^/]+)\/approve$/.exec(path)
  if (m && method === 'POST') return approve(decodeURIComponent(m[1]), body)
  m = /^\/api\/articles\/([^/]+)\/reject$/.exec(path)
  if (m && method === 'POST') return reject(decodeURIComponent(m[1]), body)
  m = /^\/api\/articles\/([^/]+)\/unpublish$/.exec(path)
  if (m && method === 'POST') return unpublish(decodeURIComponent(m[1]), body)
  m = /^\/api\/articles\/([^/]+)\/submit$/.exec(path)
  if (m && method === 'POST') return submitArticle(decodeURIComponent(m[1]), actor)
  m = /^\/api\/articles\/([^/]+)\/withdraw$/.exec(path)
  if (m && method === 'POST') return withdrawArticle(decodeURIComponent(m[1]), actor)
  m = /^\/api\/articles\/([^/]+)\/reschedule$/.exec(path)
  if (m && method === 'POST') return rescheduleArticle(decodeURIComponent(m[1]), body, actor)
  m = /^\/api\/articles\/([^/]+)\/media$/.exec(path)
  if (m && method === 'POST') return uploadMedia(decodeURIComponent(m[1]), body, actor)

  if (path === '/api/articles' && method === 'GET') return listArticlesAdmin(url.searchParams, actor)
  if (path === '/api/articles' && method === 'POST') return createArticle(body, actor)
  if (path === '/api/articles/counts' && method === 'GET') return getCounts(url.searchParams, actor)
  if (path === '/api/articles/batch-delete' && method === 'POST') {
    const ids = dedupeIds(body?.article_ids)
    if (ids.length < 1 || ids.length > 50) return badRequest('article_ids', '1～50 条', 40017)
    if (body?.confirm !== true) return badRequest('confirm', '需要二次确认', 40013)
    return batchOf(ids.map((id) => resultOf(id, deleteDraft(String(id), true, actor))))
  }

  m = /^\/api\/articles\/([^/]+)$/.exec(path)
  if (m && method === 'GET') return getArticleAdmin(decodeURIComponent(m[1]), actor)
  if (m && method === 'PUT') return updateArticle(decodeURIComponent(m[1]), body, actor)
  if (m && method === 'DELETE') return deleteDraft(decodeURIComponent(m[1]), url.searchParams.get('confirm'), actor)
  m = /^\/api\/articles\/([^/]+)\/audit-logs$/.exec(path)
  if (m && method === 'GET') return getAuditLogs(decodeURIComponent(m[1]), actor)

  if (path === '/api/categories/sort' && method === 'PUT') return sortCategories(body)
  if (path === '/api/categories') {
    if (method === 'GET') return listCategories(url.searchParams)
    if (method === 'POST') return createCategory(body)
  }
  m = /^\/api\/categories\/([^/]+)\/status$/.exec(path)
  if (m && method === 'PUT') return setCategoryStatus(decodeURIComponent(m[1]), body)
  m = /^\/api\/categories\/([^/]+)$/.exec(path)
  if (m && m[1] !== 'sort') {
    const id = decodeURIComponent(m[1])
    if (method === 'PUT') return renameCategory(id, body)
    if (method === 'DELETE') return deleteCategory(id)
  }

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

  return null
}
