// 博客前台公开接口（api-spec §11）。只读、匿名、不传任何影响可见性的参数（INV-10）。
// 返回值在这里按 §4.14 白名单投影：即使后端多给了字段，也不会流到页面上。
import { http } from './http'
import { safeMediaUrl } from '@/utils/media'

export const PUBLIC_PAGE_SIZE = 10

const brief = (x) => (x ? { id: x.id, name: x.name } : null)

export function pickListItem(a) {
  return {
    id: a.id,
    title: a.title,
    excerpt: a.excerpt ?? '',
    cover_url: safeMediaUrl(a.cover_url),
    category: brief(a.category),
    tags: Array.isArray(a.tags) ? a.tags.map(brief) : [],
    published_at: a.published_at,
  }
}

export function pickDetail(a) {
  return {
    ...pickListItem(a),
    content: a.content ?? '',
    audio_url: safeMediaUrl(a.audio_url),
  }
}

const pickFacets = (f) =>
  f
    ? {
        categories: Array.isArray(f.categories) ? f.categories.map(brief) : [],
        tags: Array.isArray(f.tags) ? f.tags.map(brief) : [],
      }
    : null

/**
 * GET /api/public/articles
 * @param {{page?: number, page_size?: number, category_id?: string|null, tag_ids?: string[], q?: string, with_facets?: boolean}} p
 * ID 以字符串传递，避免 int64 在 JS 里丢精度；q 为标题 + 摘要关键字（§11.1，范围延伸）
 */
export async function listPublicArticles({ page = 1, page_size = PUBLIC_PAGE_SIZE, category_id = null, tag_ids = [], q = '', with_facets = false, sort = 'desc' } = {}) {
  const params = {
    page,
    page_size,
    category_id: category_id || undefined,
    tag_ids: tag_ids.length ? tag_ids : undefined,
    q: q || undefined,
    with_facets: with_facets ? true : undefined,
  }
  if (sort === 'asc') params.sort = 'published_at,asc'
  const data = await http.get('/api/public/articles', { params })
  return {
    items: (data.items || []).map(pickListItem),
    page: data.page,
    page_size: data.page_size,
    total: data.total,
    facets: pickFacets(data.facets),
  }
}

/** 分类 / 标签导航（§4.14 PublicFacets）：借公开列表取 1 条并带 with_facets=true，不另开匿名接口 */
export async function getPublicFacets() {
  const r = await listPublicArticles({ page: 1, page_size: 1, with_facets: true })
  return r.facets ?? { categories: [], tags: [] }
}

/** GET /api/public/articles/{id}；不存在与未发布都是同一个 404（抛 ApiError，status=404） */
export async function getPublicArticle(id) {
  const data = await http.get(`/api/public/articles/${encodeURIComponent(id)}`)
  return pickDetail(data)
}
