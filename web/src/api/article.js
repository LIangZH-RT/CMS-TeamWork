// 文章接口模块（api-spec §6，#6、#8、#32）。编辑、管理员共用同一套路径，服务端按角色和归属判定。
// 编辑端的 #7、#9–#13 由 F 追加，不改已有函数签名。复用 http.js 单例，ID 用字符串传。
import { http } from './http'

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
