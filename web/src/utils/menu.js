// 后台菜单的单一来源（方案 A：编辑、管理员共用 /admin 与 AdminLayout，按角色切换菜单）。
// 权限只认路由 meta.roles 一处（router/index.js）；这里只定义菜单顺序和文案，不另写角色表。
// 菜单项指向的路由没注册（如 F 的编辑端页面合入前）时自动隐藏，注册后自动出现。

// 顺序即显示顺序；按角色过滤后：
// - EDITOR：我的文章、写文章、标签管理
// - ADMIN：审核队列、全部文章、分类管理、标签管理
export const MENU = [
  { route: 'admin-my-articles', label: '我的文章' },
  { route: 'admin-article-new', label: '写文章' },
  { route: 'admin-reviews', label: '审核队列', badge: 'reviews' },
  { route: 'admin-articles', label: '全部文章' },
  { route: 'admin-categories', label: '分类管理' },
  { route: 'admin-tags', label: '标签管理' },
]

// 各角色的后台首页；未注册时回退到该角色菜单里第一个已注册的项
export const HOME_ROUTE = { EDITOR: 'admin-my-articles', ADMIN: 'admin-reviews' }

/** 路由记录上声明的 meta.roles；路由未注册或没声明时返回 null */
export function rolesOf(router, name) {
  if (!name || !router.hasRoute(name)) return null
  const record = router.getRoutes().find((r) => r.name === name)
  return Array.isArray(record?.meta?.roles) ? record.meta.roles : null
}

/** 该角色能否进入这个具名路由（只看 meta.roles，体验用，不承担权限职责） */
export function canEnter(router, name, role) {
  const roles = rolesOf(router, name)
  return !!roles && roles.includes(role)
}

/** 该角色可见的菜单：未注册的路由、角色不在 meta.roles 里的都过滤掉 */
export function menuFor(role, router) {
  if (!role) return []
  return MENU.filter((item) => canEnter(router, item.route, role))
}

/** 角色的后台首页 { name }；该角色一个可进入的菜单项都没有（含未知角色）时返回 null */
export function homeRouteFor(role, router) {
  const preferred = HOME_ROUTE[role]
  if (preferred && canEnter(router, preferred, role)) return { name: preferred }
  const first = menuFor(role, router)[0]
  return first ? { name: first.route } : null
}

// 顶栏角色标签，文案按 api-spec §3.1
export const ROLE_LABEL = { EDITOR: '内容编辑', ADMIN: '管理员' }

/** 菜单项是否高亮：当前路由就是它，或当前路由用 meta.menu 指向它（详情、留痕等子页面） */
export function isMenuActive(item, route) {
  return route?.name === item.route || route?.meta?.menu === item.route
}
