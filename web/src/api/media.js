// 媒体上传（api-spec #28）。下载与在线阅读走浏览器直接请求 /api/media/{id}。
import { http } from './http'

export function uploadMedia(articleId, file, usage) {
  const form = new FormData()
  form.append('file', file)
  form.append('usage', usage)
  return http.post(`/api/articles/${encodeURIComponent(articleId)}/media`, form)
}
