// 管理员端接口模块（api-spec v0.1）。
// 全部复用 http.js 单例，不新建 axios 实例。ID 用字符串传避免 JS int64 精度丢失。
import { http } from './http'

// ─── 审核 REVIEW ────────────────────────────────────────────────────

/** GET /api/reviews/queue (#14)：分页，固定按 submitted_at 升序 */
export function getReviewQueue({ page = 1, page_size = 20, category_id = null, tag_ids = [], author_id = null, title = '' } = {}) {
  return http.get('/api/reviews/queue', {
    params: {
      page, page_size,
      category_id: category_id || undefined,
      tag_ids: tag_ids.length ? tag_ids : undefined,
      author_id: author_id || undefined,
      title: title || undefined,
    },
  })
}

/** GET /api/reviews/standard (#15)：审核标准版本 + 驳回类别字典 */
export function getReviewStandard() {
  return http.get('/api/reviews/standard')
}

/** POST /api/articles/{id}/approve (#16)：审核通过，请求体只有 submission_id */
export function approveArticle(id, { submission_id }) {
  return http.post(`/api/articles/${encodeURIComponent(id)}/approve`, { submission_id })
}

/** POST /api/articles/{id}/reject (#17)：驳回 */
export function rejectArticle(id, { submission_id, reject_category, comment }) {
  return http.post(`/api/articles/${encodeURIComponent(id)}/reject`, { submission_id, reject_category, comment })
}

/** POST /api/articles/{id}/unpublish (#18)：下架，reason 必填 */
export function unpublishArticle(id, { reason }) {
  return http.post(`/api/articles/${encodeURIComponent(id)}/unpublish`, { reason })
}

// ─── 文章 ARTICLE（管理员视角） ─────────────────────────────────────

/** GET /api/articles (#6)：管理员不传 author_id → 全部 */
export function listArticles({ page = 1, page_size = 20, status = null, category_id = null, tag_ids = [], author_id = null, title = '' } = {}) {
  return http.get('/api/articles', {
    params: {
      page, page_size,
      status: status || undefined,
      category_id: category_id || undefined,
      tag_ids: tag_ids.length ? tag_ids : undefined,
      author_id: author_id || undefined,
      title: title || undefined,
    },
  })
}

/** GET /api/articles/{id} (#8)：管理员可看全部状态；待审核时返回 current_submission_id */
export function getArticleDetail(id) {
  return http.get(`/api/articles/${encodeURIComponent(id)}`)
}

/** GET /api/articles/counts (#32)：6 状态计数 */
export function getArticleCounts({ category_id = null, tag_ids = [], author_id = null, title = '' } = {}) {
  return http.get('/api/articles/counts', {
    params: {
      category_id: category_id || undefined,
      tag_ids: tag_ids.length ? tag_ids : undefined,
      author_id: author_id || undefined,
      title: title || undefined,
    },
  })
}

/** GET /api/articles/{id}/audit-logs (#19)：按 operated_at 正序 */
export function getAuditLogs(id) {
  return http.get(`/api/articles/${encodeURIComponent(id)}/audit-logs`)
}

// ─── 分类 TAX ───────────────────────────────────────────────────────

export function listCategories() {
  return http.get('/api/categories')
}

export function createCategory({ name }) {
  return http.post('/api/categories', { name })
}

export function renameCategory(id, { name }) {
  return http.put(`/api/categories/${encodeURIComponent(id)}`, { name })
}

export function deleteCategory(id) {
  return http.delete(`/api/categories/${encodeURIComponent(id)}`)
}

// ─── 标签 TAG ───────────────────────────────────────────────────────

export function listTags({ keyword = '', page = 1, page_size = 20 } = {}) {
  return http.get('/api/tags', { params: { keyword: keyword || undefined, page, page_size } })
}

export function createTag({ name }) {
  return http.post('/api/tags', { name })
}

export function renameTag(id, { name }) {
  return http.put(`/api/tags/${encodeURIComponent(id)}`, { name })
}

export function deleteTag(id) {
  return http.delete(`/api/tags/${encodeURIComponent(id)}`)
}
