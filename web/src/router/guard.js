// 后台体验守卫的判定逻辑（纯函数，便于单测；beforeEach 只负责取用户并调用它）。
// 守卫只做体验，不承担任何权限职责（architecture §3.3）：服务端仍按 api-spec §2.3 独立判定。
import { homeRouteFor } from '@/utils/menu'

/** 统一 404：保留原地址，和「文章不存在」同一页面同一文案（api-spec §3.2、INV-09），不提示无权限 */
export function notFoundFor(to) {
  return { name: 'not-found', params: { pathMatch: to.path.slice(1).split('/') }, query: to.query, hash: to.hash }
}

/**
 * 判定后台路由能否进入。
 * @param to     目标路由（RouteLocationNormalized）
 * @param user   当前用户（GET /api/auth/me 的 data），未登录为 null
 * @param router 路由实例（admin-home 重定向时查已注册的路由）
 * @returns true 放行，或一个重定向目标
 */
export function resolveBackofficeAccess(to, user, router) {
  // 1. 不在 requiresAuth 下（前台、/login）→ 放行
  if (!to.matched.some((r) => r.meta?.requiresAuth)) return true
  // 2. 未登录 → 登录页，带回跳地址
  if (!user) return { path: '/login', query: { redirect: to.fullPath } }
  // 3. /admin → 按角色跳到各自首页；没有可去的页面（含未知角色）→ 统一 404
  if (to.name === 'admin-home') return homeRouteFor(user.role, router) ?? notFoundFor(to)
  // 4. 取最深一层声明了 meta.roles 的记录；角色不在其中，或子路由忘了声明 → 统一 404
  const record = [...to.matched].reverse().find((r) => Array.isArray(r.meta?.roles))
  if (!record || !record.meta.roles.includes(user.role)) return notFoundFor(to)
  return true
}
