// 首页筛选状态与 URL 互转：page、category_id、tag_ids（多值，交集语义，BR-SEARCH-005）。
// ID 一律保留为十进制字符串，避免 int64 精度问题。
const ID_RE = /^[1-9]\d{0,18}$/

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])

export function parseListQuery(q = {}) {
  const pageRaw = Array.isArray(q.page) ? q.page[0] : q.page
  const page = /^[1-9]\d{0,5}$/.test(pageRaw ?? '') ? Number(pageRaw) : 1
  const catRaw = Array.isArray(q.category_id) ? q.category_id[0] : q.category_id
  const category_id = ID_RE.test(catRaw ?? '') ? String(catRaw) : null
  const tag_ids = [...new Set(asArray(q.tag_ids).map(String).filter((v) => ID_RE.test(v)))]
  return { page, category_id, tag_ids }
}

/** 生成路由 query；默认值省略，保持 URL 干净 */
export function toRouteQuery({ page = 1, category_id = null, tag_ids = [] }) {
  const q = {}
  if (category_id) q.category_id = String(category_id)
  if (tag_ids.length) q.tag_ids = tag_ids.map(String)
  if (page > 1) q.page = String(page)
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
