// 文章接口（api-spec §6，#6–#13、#32、#42）。编辑与管理员共用列表路径，范围由服务端决定。
import { http } from './http'

function listParams(q = {}) {
  return {
    page: q.page ?? 1,
    page_size: q.page_size ?? 20,
    status: q.status || undefined,
    category_id: q.category_id || undefined,
    tag_ids: q.tag_ids?.length ? q.tag_ids : undefined,
    author_id: q.author_id || undefined,
    keyword: q.keyword || q.title || undefined,
    sort: q.sort || undefined,
    created_from: q.created_from || undefined,
    created_to: q.created_to || undefined,
    updated_from: q.updated_from || undefined,
    updated_to: q.updated_to || undefined,
    published_from: q.published_from || undefined,
    published_to: q.published_to || undefined,
  }
}

/** GET /api/articles (#6) */
export function listArticles(query) {
  return http.get('/api/articles', { params: listParams(query) })
}

/** GET /api/articles/counts (#32) */
export function getArticleCounts(query = {}) {
  const p = listParams(query)
  delete p.page
  delete p.page_size
  delete p.status
  delete p.sort
  return http.get('/api/articles/counts', { params: p })
}

/** GET /api/articles/{id} (#8) */
export function getArticleDetail(id) {
  return http.get(`/api/articles/${encodeURIComponent(id)}`)
}

/** POST /api/articles (#7) */
export function createArticle(body) {
  return http.post('/api/articles', body)
}

/** PUT /api/articles/{id} (#9)，必须带 expected_version */
export function updateArticle(id, body) {
  return http.put(`/api/articles/${encodeURIComponent(id)}`, body)
}

/** DELETE /api/articles/{id}?confirm=true (#10)，逻辑删除 */
export function deleteArticle(id) {
  return http.delete(`/api/articles/${encodeURIComponent(id)}`, { params: { confirm: true } })
}

/** POST /api/articles/batch-delete (#42)，最多 50 条 */
export function batchDeleteArticles(article_ids) {
  return http.post('/api/articles/batch-delete', { article_ids, confirm: true })
}

/** POST /api/articles/{id}/submit (#11) */
export function submitArticle(id) {
  return http.post(`/api/articles/${encodeURIComponent(id)}/submit`, {})
}

/** POST /api/articles/{id}/withdraw (#12) */
export function withdrawArticle(id) {
  return http.post(`/api/articles/${encodeURIComponent(id)}/withdraw`, {})
}

/** POST /api/articles/{id}/reschedule (#13) */
export function rescheduleArticle(id, body) {
  return http.post(`/api/articles/${encodeURIComponent(id)}/reschedule`, body)
}
