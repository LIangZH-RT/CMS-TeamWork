// 分类与标签接口模块（api-spec §9，#20–#27）。分类写操作仅管理员，标签对编辑开放。
// 复用 http.js 单例，ID 用字符串传。
import { http } from './http'

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
