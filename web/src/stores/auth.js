// 认证状态 store。F 负责真实登录/会话，G 先做临时 mock 让管理员页面能跑起来。
// 真实版本需要：调用 GET /api/auth/me（#5）、CSRF 令牌存取（#1）、登出（#4）。
import { defineStore } from 'pinia'
import { logout as logoutApi } from '@/api/auth'

// 写死的 mock 用户只在契约 mock 模式下生效；正式构建初始为未登录，等 F 接 GET /api/auth/me。
// 临时开关 VITE_MOCK_ROLE（EDITOR / ADMIN，默认 ADMIN）：F 的 auth mock 合入前用来验收编辑端菜单，
// 例如 VITE_MOCK_ROLE=EDITOR npm run dev。F 的 auth mock 合入后连同 MOCK_USERS 一起删除。
const MOCK_USERS = {
  ADMIN: { id: 1, username: 'admin', role: 'ADMIN', created_at: '2026-10-19T00:00:00+08:00' },
  EDITOR: { id: 11, username: 'zhangsan', role: 'EDITOR', created_at: '2026-10-19T00:00:00+08:00' },
}
export const mockUserFor = (role) => ({ ...(MOCK_USERS[role] || MOCK_USERS.ADMIN) })
const initialUser = () =>
  import.meta.env.VITE_USE_MOCK === 'true' ? mockUserFor(import.meta.env.VITE_MOCK_ROLE) : null

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

    // POST /api/auth/logout（#4）。不论成功失败都清掉本地会话状态：
    // 失败时服务端会话最多留到超时，前端不能因此卡在已登录状态。
    // F 的 auth mock 合入前，契约 mock 对 #4 返回 404，在这里被吞掉。
    // TODO(F): 登出后重新取 CSRF 令牌（api-spec §2.2）
    async logout() {
      try {
        await logoutApi()
      } catch {
        // 忽略：见上
      } finally {
        this.user = null
        this.csrf_token = null
      }
    },
  },
})
