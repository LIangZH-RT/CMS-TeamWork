// 契约 mock：按 api-spec §1.4 / §1.5 / §3.2 / §10.2 / §11 实现三个公开出口。
// 只覆盖博客前台用到的 GET /api/public/articles、GET /api/public/articles/{id}、GET /api/media/{id}；
// 其他 /api/** 一律返回统一 404 体（本 mock 不模拟后台接口，也不存在公开分类 / 标签接口）。
import { articles, categories, tags, media } from './db.js'
import { makeCoverPng, makeDiagramPng, makeWav } from './assets.js'

/** api-spec §3.2：所有 404 逐字节一致 */
export const NOT_FOUND_BODY = JSON.stringify({ code: 40400, message: '资源不存在', data: null })

const ok = (data) => ({ status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ code: 0, message: 'OK', data }) })
const notFound = () => ({ status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: NOT_FOUND_BODY })
const badRequest = (field, reason) => ({
  status: 400,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ code: 40000, message: '参数校验失败', data: { field_errors: [{ field, reason }] } }),
})

const ID_RE = /^[1-9]\d{0,18}$/
const catById = new Map(categories.map((c) => [c.id, c]))
const tagById = new Map(tags.map((t) => [t.id, t]))
const mediaUrl = (id) => (id == null ? null : `/api/media/${id}`)

/** §4.14 白名单投影：内部字段（状态、作者、轮次、驳回/下架原因、预定时间…）一律不出 */
export function toListItem(a) {
  return {
    id: a.id,
    title: a.title,
    excerpt: a.excerpt ?? '',
    cover_url: mediaUrl(a.cover_media_id),
    category: { id: a.category_id, name: catById.get(a.category_id).name },
    tags: a.tag_ids.map((id) => ({ id, name: tagById.get(id).name })),
    published_at: a.published_at,
  }
}

export function toDetail(a) {
  return { ...toListItem(a), content: a.content, audio_url: mediaUrl(a.audio_media_id) }
}

const published = () =>
  articles
    .filter((a) => a.status === 'PUBLISHED')
    .sort((x, y) => Date.parse(y.published_at) - Date.parse(x.published_at) || y.id - x.id)

function intParam(sp, name, { def, min, max }) {
  const raw = sp.get(name)
  if (raw === null || raw === '') return { value: def }
  if (!/^\d+$/.test(raw)) return { error: badRequest(name, '必须是整数') }
  const n = Number(raw)
  if (n < min || (max && n > max)) return { error: badRequest(name, max ? `取值范围 ${min}～${max}` : `不能小于 ${min}`) }
  return { value: n }
}

/** GET /api/public/articles：只给已发布；未知参数（status、author_id…）忽略；tag_ids 交集 */
export function listPublished(sp) {
  const page = intParam(sp, 'page', { def: 1, min: 1 })
  if (page.error) return page.error
  const size = intParam(sp, 'page_size', { def: 20, min: 1, max: 100 })
  if (size.error) return size.error
  const cat = sp.get('category_id')
  if (cat !== null && cat !== '' && !ID_RE.test(cat)) return badRequest('category_id', '必须是正整数')
  const tagIds = sp.getAll('tag_ids').filter((v) => v !== '')
  if (tagIds.some((v) => !ID_RE.test(v))) return badRequest('tag_ids', '必须是正整数')

  let rows = published()
  if (cat) rows = rows.filter((a) => a.category_id === Number(cat))
  for (const t of new Set(tagIds.map(Number))) rows = rows.filter((a) => a.tag_ids.includes(t))
  const start = (page.value - 1) * size.value
  return ok({
    items: rows.slice(start, start + size.value).map(toListItem),
    page: page.value,
    page_size: size.value,
    total: rows.length, // total 基于筛选后的结果集（X-ISO-03）
  })
}

/** GET /api/public/articles/{id}：不存在与非已发布返回完全相同的 404 */
export function getPublished(id) {
  if (!ID_RE.test(id)) return notFound()
  const a = articles.find((x) => x.id === Number(id))
  if (!a || a.status !== 'PUBLISHED') return notFound()
  return ok(toDetail(a))
}

const isReferenced = (m, a) =>
  !m.unreferenced &&
  (a.cover_media_id === m.id || a.audio_media_id === m.id || a.content.includes(`/api/media/${m.id}`))

const byteCache = new Map()
function mediaBytes(m) {
  if (!byteCache.has(m.id)) {
    if (m.kind === 'cover') byteCache.set(m.id, { type: 'image/png', buf: makeCoverPng(m.id, ...m.palette) })
    else if (m.kind === 'diagram') byteCache.set(m.id, { type: 'image/png', buf: makeDiagramPng() })
    else byteCache.set(m.id, { type: 'audio/wav', buf: makeWav() })
  }
  return byteCache.get(m.id)
}

/** GET /api/media/{id}：匿名只有「已发布文章当前引用的媒体」可读，其余一律 404（§10.2） */
export function getMedia(id, range) {
  if (!ID_RE.test(id)) return notFound()
  const m = media.find((x) => x.id === Number(id))
  const a = m && articles.find((x) => x.id === m.article_id)
  if (!m || !a || a.status !== 'PUBLISHED' || !isReferenced(m, a)) return notFound()
  const { type, buf } = mediaBytes(m)
  const headers = {
    'Content-Type': type,
    'Cache-Control': 'no-store', // 不加缓存，下架后立即失效（architecture §4.3）
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
  }
  const r = range && /^bytes=(\d*)-(\d*)$/.exec(range)
  if (r && (r[1] || r[2])) {
    let start = r[1] ? Number(r[1]) : buf.length - Number(r[2])
    let end = r[1] && r[2] ? Number(r[2]) : buf.length - 1
    start = Math.max(0, start)
    end = Math.min(end, buf.length - 1)
    if (start <= end) {
      return { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${buf.length}` }, body: buf.subarray(start, end + 1) }
    }
  }
  return { status: 200, headers, body: buf }
}

/** 路由入口：返回 {status, headers, body}，便于单测 */
export function handle(method, rawUrl, headers = {}) {
  const url = new URL(rawUrl, 'http://mock.local')
  const path = url.pathname.replace(/\/+$/, '')
  if (method !== 'GET' && method !== 'HEAD') return notFound()
  if (path === '/api/public/articles') return listPublished(url.searchParams)
  let m = /^\/api\/public\/articles\/([^/]+)$/.exec(path)
  if (m) return getPublished(decodeURIComponent(m[1]))
  m = /^\/api\/media\/([^/]+)$/.exec(path)
  if (m) return getMedia(decodeURIComponent(m[1]), headers.range)
  return notFound()
}
