import { createRouter, createWebHistory } from 'vue-router'
import PublicLayout from '@/layouts/PublicLayout.vue'
import { isId } from '@/utils/query'

// 路由分区（全前端共用，A 维护）：
// - /                博客前台（PublicLayout，匿名只读）
//   /category/:id    分类页；tag_ids、page 走 query
//   /search          搜索页；q、tag_ids、page 走 query（q 为范围延伸，api-spec §11.1）
// - /login 等        认证页（F 实现）。前台顶栏「作者登录」已链到 /login，页面合入前落到统一 404
// - /admin/**        后台，方案 A：编辑（EDITOR）与管理员（ADMIN）共用 AdminLayout（architecture §3.2），
//                    菜单和可进入的页面按 auth.user.role 切换（SRS FR-AUTH-005）。父路由 meta.requiresAuth，
//                    每个子路由用 meta.roles 声明角色；菜单由 utils/menu.js 按 meta.roles 生成，不另写角色表
// 尚未合入的分区（如 /login、编辑端页面）不注册路由，访问时落到前台统一 404。
// 守卫只做体验，不承担任何权限职责（architecture §3.3）：服务端仍按 api-spec §2.3 独立判定。
import AdminLayout from '@/layouts/AdminLayout.vue'
import { useAuth } from '@/stores/auth'
import { resolveBackofficeAccess } from './guard'

const BOTH = ['EDITOR', 'ADMIN']
const ADMIN = ['ADMIN']

const routes = [
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true },
    children: [
      // /admin 不渲染页面：守卫按角色重定向（EDITOR → 我的文章，ADMIN → 审核队列，未注册时取菜单第一项）
      { path: '', name: 'admin-home', component: { render: () => null }, meta: { roles: BOTH } },

      // ── 管理员端与共用页面（G）
      { path: 'reviews', name: 'admin-reviews', component: () => import('@/views/review/ReviewQueue.vue'), meta: { title: '审核队列', roles: ADMIN, permission: 'review:queue' } },
      { path: 'reviews/:id', name: 'admin-review-detail', component: () => import('@/views/review/ReviewDetail.vue'), meta: { title: '审核详情', roles: ADMIN, permission: 'review:queue', menu: 'admin-reviews' } },
      { path: 'articles', name: 'admin-articles', component: () => import('@/views/review/ArticleList.vue'), meta: { title: '全部文章', roles: ADMIN, permission: 'article:read:all' } },
      { path: 'articles/:id', name: 'admin-article-detail', component: () => import('@/views/review/ArticleDetail.vue'), meta: { title: '文章详情', roles: ADMIN, permission: 'article:read:all', menu: 'admin-articles' } },
      { path: 'articles/:id/audit-logs', name: 'admin-audit-logs', component: () => import('@/views/article/AuditLogs.vue'), meta: { title: '留痕', roles: BOTH, permission: 'audit:read', menu: 'admin-articles' } },
      { path: 'categories', name: 'admin-categories', component: () => import('@/views/taxonomy/CategoryManage.vue'), meta: { title: '分类管理', roles: ADMIN, permission: 'category:update' } },
      { path: 'tags', name: 'admin-tags', component: () => import('@/views/taxonomy/TagManage.vue'), meta: { title: '标签管理', roles: BOTH, permission: 'tag:read' } },
      { path: 'users', name: 'admin-users', component: () => import('@/views/system/UserManage.vue'), meta: { title: '用户管理', roles: ADMIN, permission: 'user:read' } },
      { path: 'roles', name: 'admin-roles', component: () => import('@/views/system/RolePermissions.vue'), meta: { title: '角色与权限', roles: ADMIN, permission: 'role:read' } },
      { path: 'operation-logs', name: 'admin-oplogs', component: () => import('@/views/system/OperationLogs.vue'), meta: { title: '操作日志', roles: ADMIN, permission: 'oplog:read' } },
      { path: 'profile', name: 'admin-profile', component: () => import('@/views/system/Profile.vue'), meta: { title: '个人资料', roles: BOTH } },

      { path: 'my-articles', name: 'admin-my-articles', component: () => import('@/views/article/MyArticles.vue'), meta: { title: '我的文章', roles: ['EDITOR'], permission: 'article:create' } },
      { path: 'my-articles/new', name: 'admin-article-new', component: () => import('@/views/article/ArticleEdit.vue'), meta: { title: '写文章', roles: ['EDITOR'], permission: 'article:create', menu: 'admin-article-new' } },
      { path: 'my-articles/:id/edit', name: 'admin-article-edit', component: () => import('@/views/article/ArticleEdit.vue'), meta: { title: '编辑文章', roles: ['EDITOR'], permission: 'article:update', menu: 'admin-my-articles' } },
      { path: 'my-articles/:id', name: 'admin-my-article', component: () => import('@/views/article/ArticleMine.vue'), meta: { title: '文章详情', roles: ['EDITOR'], permission: 'article:create', menu: 'admin-my-articles' } },
    ],
  },
  { path: '/login', name: 'login', component: () => import('@/views/auth/Login.vue'), meta: { title: '登录' } },
  { path: '/register', name: 'register', component: () => import('@/views/auth/Register.vue'), meta: { title: '注册' } },
  {
    path: '/',
    component: PublicLayout,
    children: [
      {
        path: '',
        name: 'blog-home',
        component: () => import('@/views/public/BlogHome.vue'),
        // 兼容旧链接 /?category_id=3 → /category/3（保留标签与页码）
        beforeEnter: (to) => {
          const raw = Array.isArray(to.query.category_id) ? to.query.category_id[0] : to.query.category_id
          if (raw == null) return true
          const query = { ...to.query }
          delete query.category_id
          return isId(raw) ? { name: 'blog-category', params: { id: raw }, query } : { name: 'blog-home', query }
        },
      },
      { path: 'category/:id', name: 'blog-category', component: () => import('@/views/public/BlogCategory.vue') },
      { path: 'search', name: 'blog-search', component: () => import('@/views/public/BlogSearch.vue') },
      { path: 'posts/:id', name: 'blog-article', component: () => import('@/views/public/BlogArticle.vue') },
      // 前台统一 404：未知路径、未知分类与「文章不存在 / 未发布」同一文案，不暗示是否曾经存在
      { path: ':pathMatch(.*)*', name: 'not-found', component: () => import('@/views/public/NotFound.vue') },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
})

// 体验守卫：后台页面先取当前用户，再交给 guard.js 判定。
// 未登录（401 / 无会话）→ /login?redirect=；角色不符或未知角色 → 统一 404；/admin → 按角色重定向
router.beforeEach(async (to) => {
  if (!to.matched.some((r) => r.meta.requiresAuth)) return true
  const auth = useAuth()
  let user = null
  try {
    user = await auth.fetchMe()
  } catch (e) {
    if (e?.status !== 401) throw e
  }
  return resolveBackofficeAccess(to, user, router)
})

export default router
