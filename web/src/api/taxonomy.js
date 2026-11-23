// 分类与标签（api-spec §9，#20–#27、#38、#39）。
import { http } from './http'

export function listCategories({ status } = {}) {
  return http.get('/api/categories', { params: { status: status || undefined } })
}

export function createCategory(body) {
  return http.post('/api/categories', body)
}

export function updateCategory(id, body) {
  return http.put(`/api/categories/${encodeURIComponent(id)}`, body)
}

export function deleteCategory(id) {
  return http.delete(`/api/categories/${encodeURIComponent(id)}`)
}

export function updateCategoryStatus(id, status) {
  return http.put(`/api/categories/${encodeURIComponent(id)}/status`, { status })
}

export function sortCategories(body) {
  return http.put('/api/categories/sort', body)
}

export function listTags({ keyword = '', page = 1, page_size = 20, sort = '' } = {}) {
  return http.get('/api/tags', {
    params: { keyword: keyword || undefined, page, page_size, sort: sort || undefined },
  })
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
