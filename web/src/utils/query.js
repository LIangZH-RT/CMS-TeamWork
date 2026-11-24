// 列表筛选状态与 URL 互转：page、category_id、tag_ids（多值，交集语义，BR-SEARCH-005）。
// 分类页把分类放在路径 /category/:id 里；首页 query 里的 category_id 只用于兼容旧链接（重定向到分类页）。
// ID 一律保留为十进制字符串，避免 int64 精度问题。
const ID_RE = /^[1-9]\d{0,18}$/

export const isId = (v) => typeof v === 'string' && ID_RE.test(v)

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])

export function parseListQuery(q = {}) {
  const pageRaw = Array.isArray(q.page) ? q.page[0] : q.page
  const page = /^[1-9]\d{0,5}$/.test(pageRaw ?? '') ? Number(pageRaw) : 1
  const catRaw = Array.isArray(q.category_id) ? q.category_id[0] : q.category_id
  const category_id = ID_RE.test(catRaw ?? '') ? String(catRaw) : null
  const tag_ids = [...new Set(asArray(q.tag_ids).map(String).filter((v) => ID_RE.test(v)))]
  return { page, category_id, tag_ids }
}

/** 公开列表排序：默认发布时间降序，只把升序写进 URL（#30 白名单 published_at） */
export function parseSort(q = {}) {
  const raw = Array.isArray(q.sort) ? q.sort[0] : q.sort
  return raw === 'asc' ? 'asc' : 'desc'
}

/** 生成路由 query；默认值省略，保持 URL 干净 */
export function toRouteQuery({ page = 1, category_id = null, tag_ids = [], sort = 'desc' }) {
  const q = {}
  if (category_id) q.category_id = String(category_id)
  if (tag_ids.length) q.tag_ids = tag_ids.map(String)
  if (page > 1) q.page = String(page)
  if (sort === 'asc') q.sort = 'asc'
  return q
}

export const hasFilter = (f) => Boolean(f.category_id) || f.tag_ids.length > 0

/** 点分类：替换当前分类，回到第 1 页 */
export const withCategory = (f, id) => ({ ...f, page: 1, category_id: String(id) })

/** 点标签：已选则移除，未选则加入（交集），回到第 1 页 */
export function toggleTag(f, id) {
  const s = String(id)
  const tag_ids = f.tag_ids.includes(s) ? f.tag_ids.filter((t) => t !== s) : [...f.tag_ids, s]
  return { ...f, page: 1, tag_ids }
}

// ---- 搜索页 /search?q=&tag_ids=&page= ----
// q 与后端同口径（api-spec §11.1）：去首尾空白，空串视为未传，最多 100 个 Unicode 码点（超出截断，不发会被 400 的请求）
export const Q_MAX = 100

export function normalizeKeyword(raw) {
  const s = (Array.isArray(raw) ? raw[0] : raw) ?? ''
  return [...String(s).trim()].slice(0, Q_MAX).join('').trim()
}

export function parseSearchQuery(q = {}) {
  const { page, tag_ids } = parseListQuery(q)
  return { q: normalizeKeyword(q.q), page, category_id: null, tag_ids }
}

export function toSearchRouteQuery({ q = '', page = 1, tag_ids = [], sort = 'desc' }) {
  const out = {}
  const kw = normalizeKeyword(q)
  if (kw) out.q = kw
  return { ...out, ...toRouteQuery({ page, category_id: null, tag_ids, sort }) }
}

/**
 * 把文本按关键字切成片段，供模板逐段渲染（命中段用 <mark>）。只返回纯文本片段，不拼 HTML。
 * 大小写不敏感；关键字按字面匹配（% _ 不是通配符）。
 */
export function splitHighlight(text, kw) {
  const t = text ?? ''
  if (!kw) return [{ text: t, hit: false }]
  const lower = t.toLowerCase()
  const k = kw.toLowerCase()
  const out = []
  let i = 0
  for (let j = lower.indexOf(k); j !== -1 && k; j = lower.indexOf(k, i)) {
    if (j > i) out.push({ text: t.slice(i, j), hit: false })
    out.push({ text: t.slice(j, j + k.length), hit: true })
    i = j + k.length
  }
  if (i < t.length) out.push({ text: t.slice(i), hit: false })
  return out.length ? out : [{ text: t, hit: false }]
}
