// 审核接口模块（api-spec §7，#14–#18，仅管理员）。
// 复用 http.js 单例，ID 用字符串传避免 JS int64 精度丢失。
import { http } from './http'

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

/** POST /api/reviews/batch-approve (#40)，去重后最多 50 条 */
export function batchApprove(items) {
  return http.post('/api/reviews/batch-approve', { items })
}

/** POST /api/reviews/batch-unpublish (#41) */
export function batchUnpublish(article_ids, reason) {
  return http.post('/api/reviews/batch-unpublish', { article_ids, reason })
}
