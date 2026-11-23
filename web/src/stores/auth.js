// 会话 store：当前用户来自 GET /api/auth/me（含权限点），CSRF 令牌只留在内存。
import { defineStore } from 'pinia'
import { fetchCsrf, login as loginApi, logout as logoutApi, me, register as registerApi } from '@/api/auth'
import { setCsrf } from '@/api/csrf'
import { hasPermission } from '@/utils/permissions'

export const useAuth = defineStore('auth', {
  state: () => ({
    user: null,
  }),

  getters: {
    isLoggedIn: (s) => !!s.user,
    isAdmin: (s) => s.user?.role === 'ADMIN',
    can: (s) => (code) => hasPermission(s.user, code),
  },

  actions: {
    async fetchCsrf() {
      const data = await fetchCsrf()
      setCsrf(data?.token)
      return data?.token ?? null
    },

    async fetchMe() {
      try {
        this.user = await me()
        return this.user
      } catch (e) {
        if (e?.status === 401) {
          this.user = null
          return null
        }
        throw e
      }
    },

    async login(body) {
      const data = await loginApi(body)
      this.user = data.user
      await this.fetchCsrf()
      this.user = await me()
      return this.user
    },

    async register(body) {
      if (!(await this.fetchCsrf().catch(() => null))) await this.fetchCsrf()
      return registerApi(body)
    },

    async logout() {
      try {
        await logoutApi()
      } catch {
        // 服务端会话最多留到超时，前端不能因此卡在已登录
      } finally {
        this.user = null
        setCsrf(null)
      }
      try {
        await this.fetchCsrf()
      } catch {
        // 匿名令牌失败不阻塞回到首页
      }
    },
  },
})
