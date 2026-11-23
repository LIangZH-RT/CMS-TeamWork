import { createRouter, createWebHistory } from 'vue-router'
import PublicLayout from '@/layouts/PublicLayout.vue'
import { isId } from '@/utils/query'

// 路由分区（全前端共用，A 维护）：
// - /                博客前台（PublicLayout，匿名只读）
//   /category/:id    分类页；tag_ids、page 走 query
//   /search          搜索页；q、tag_ids、page 走 query（q 为范围延伸，api-spec §11.1）
// - /login 等        认证页（F 实现）。前台顶栏「作者登录」已链到 /login，页面合入前落到统一 404
// - /admin/**        编辑与管理员后台（F / G 实现，使用独立 AdminLayout，不挂在 PublicLayout 下）
//   目前 /admin 整段由 G 的管理员页面占用（meta.requiresAdmin），与 F 的编辑端如何分区待 F / G 对齐
// 尚未合入的分区（如 /login）不注册路由，访问时落到前台统一 404。
// 守卫只做体验，不承担任何权限职责（architecture §3.3）：服务端仍按 api-spec §2.3 独立判定。
import AdminLayout from '@/layouts/AdminLayout.vue'
import { useAuth } from '@/stores/auth'

const routes = [
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAdmin: true },
    children: [
      { path: '', redirect: { name: 'admin-reviews' } },
      { path: 'reviews', name: 'admin-reviews', component: () => import('@/views/review/ReviewQueue.vue'), meta: { title: '审核队列' } },
      { path: 'reviews/:id', name: 'admin-review-detail', component: () => import('@/views/review/ReviewDetail.vue'), meta: { title: '审核详情' } },
      { path: 'articles', name: 'admin-articles', component: () => import('@/views/review/ArticleList.vue'), meta: { title: '全部文章' } },
      { path: 'articles/:id', name: 'admin-article-detail', component: () => import('@/views/review/ArticleDetail.vue'), meta: { title: '文章详情' } },
      { path: 'articles/:id/audit-logs', name: 'admin-audit-logs', component: () => import('@/views/article/AuditLogs.vue'), meta: { title: '留痕' } },
      { path: 'categories', name: 'admin-categories', component: () => import('@/views/taxonomy/CategoryManage.vue'), meta: { title: '分类管理' } },
      { path: 'tags', name: 'admin-tags', component: () => import('@/views/taxonomy/TagManage.vue'), meta: { title: '标签管理' } },
    ],
  },
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
          const { category_id, ...query } = to.query
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

// 体验守卫：requiresAdmin 的页面先取当前用户。未登录（401 / 无会话）→ /login；已登录但不是管理员 → 统一 404
router.beforeEach(async (to) => {
  if (!to.matched.some((r) => r.meta.requiresAdmin)) return true
  const auth = useAuth()
  let user = null
  try {
    user = await auth.fetchMe()
  } catch (e) {
    if (e?.status !== 401) throw e
  }
  if (!user) return { path: '/login', query: { redirect: to.fullPath } }
  if (user.role !== 'ADMIN') return { name: 'not-found', params: { pathMatch: to.path.slice(1).split('/') } }
  return true
})

export default router
