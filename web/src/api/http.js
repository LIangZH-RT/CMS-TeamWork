// 全前端共用的 Axios 实例（F / G 复用，不要各自再建）。
// - baseURL 为空：只请求同源 /api/**（开发走 Vite 代理或契约 mock，部署走 Nginx）
// - withCredentials：携带会话 Cookie（JSESSIONID）
// - 写请求的 X-XSRF-TOKEN 由 F 按 api-spec §2.2 接入；公开页只读，不需要 CSRF
// - 统一解包 {code, message, data}：成功返回 data；失败抛 ApiError。message 只给人看，不做分支（§1.4）
// - 字段保持 snake_case，不做驼峰转换
import axios from 'axios'

export class ApiError extends Error {
  constructor(status, code, message, data) {
    super(message || `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status // HTTP 状态码；0 表示网络错误或超时
    this.code = code // 业务码（§3.3），可能为 null
    this.data = data ?? null
  }
}

/** 统一 404（不存在 / 无权限 / 未发布同一响应），调用方据此进入统一 404 页 */
export const isNotFound = (e) => e instanceof ApiError && e.status === 404

export function unwrap(res) {
  const body = res.data
  if (body && typeof body === 'object' && 'code' in body) {
    if (body.code === 0) return body.data
    throw new ApiError(res.status, body.code, body.message, body.data)
  }
  return body
}

export function toApiError(err) {
  if (err instanceof ApiError) return err
  const res = err?.response
  if (res) {
    const b = res.data && typeof res.data === 'object' ? res.data : {}
    return new ApiError(res.status, b.code ?? null, b.message ?? '', b.data ?? null)
  }
  return new ApiError(0, null, err?.message || '网络错误', null)
}

export const http = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 15000,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  // 数组参数按 OpenAPI form + explode 序列化：tag_ids=1&tag_ids=2（不是 tag_ids[]=1）
  paramsSerializer: { indexes: null },
})

http.interceptors.response.use(unwrap, (err) => Promise.reject(toApiError(err)))
