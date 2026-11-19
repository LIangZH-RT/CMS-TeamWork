// 认证状态 store。F 负责真实登录/会话，G 先做临时 mock 让管理员页面能跑起来。
// 真实版本需要：调用 GET /api/auth/me（#5）、CSRF 令牌存取（#1）、登出（#4）。
import { defineStore } from 'pinia'

// 写死的管理员只在契约 mock 模式下生效；正式构建初始为未登录，等 F 接 GET /api/auth/me
const MOCK_ADMIN = { id: 1, username: 'admin', role: 'ADMIN', created_at: '2026-10-19T00:00:00+08:00' }
const initialUser = () => (import.meta.env.VITE_USE_MOCK === 'true' ? { ...MOCK_ADMIN } : null)

export const useAuth = defineStore('auth', {
  state: () => ({
    user: initialUser(),
    // 真实版本里 csrf_token 从 GET /api/auth/csrf 取，存在内存
    csrf_token: null,
  }),

  getters: {
    isAdmin: (s) => s.user?.role === 'ADMIN',
    isLoggedIn: (s) => !!s.user,
  },

  actions: {
    // 真实版本：GET /api/auth/me；mock 里直接用构造值
    async fetchMe() {
      // TODO(F): const data = await http.get('/api/auth/me'); this.user = data
      return this.user
    },

    // 真实版本：GET /api/auth/csrf → 拿到 token → 写进 CSRF 拦截器
    async fetchCsrf() {
      // TODO(F): const data = await http.get('/api/auth/csrf'); this.csrf_token = data.token
      return this.csrf_token
    },
  },
})
