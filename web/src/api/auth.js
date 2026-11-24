// 认证接口（api-spec §5，#1–#5）。
import { http } from './http'

/** GET /api/auth/csrf (#1) */
export function fetchCsrf() {
  return http.get('/api/auth/csrf')
}

/** POST /api/auth/register (#2)，成功不建立会话 */
export function register(body) {
  return http.post('/api/auth/register', body)
}

/** POST /api/auth/login (#3)，不带 CSRF */
export function login(body) {
  return http.post('/api/auth/login', body)
}

/** POST /api/auth/logout (#4) */
export function logout() {
  return http.post('/api/auth/logout')
}

/** GET /api/auth/me (#5)，含 permissions */
export function me() {
  return http.get('/api/auth/me')
}
