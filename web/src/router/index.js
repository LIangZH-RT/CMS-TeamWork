import { createRouter, createWebHistory } from 'vue-router'
import PublicLayout from '@/layouts/PublicLayout.vue'
import { isId } from '@/utils/query'

// 路由分区（全前端共用，A 维护）：
// - /                博客前台（PublicLayout，匿名只读）
//   /category/:id    分类页；tag_ids、page 走 query
//   /search          搜索页；q、tag_ids、page 走 query（q 为范围延伸，api-spec §11.1）
// - /login 等        认证页（F 实现）。前台顶栏「作者登录」已链到 /login，页面合入前落到统一 404
// - /admin/**        编辑与管理员后台（F / G 实现，使用独立 AdminLayout，不挂在 PublicLayout 下）
// 预留分区在对应页面合入前不注册路由，访问时落到前台统一 404。
// 守卫只做体验，不承担任何权限职责（architecture §3.3）。
import AdminLayout from '@/layouts/AdminLayout.vue'

const routes = [
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAdmin: true },
    children: [
      { path: '', redirect: { name: 'admin-reviews' } },
      { path: 'reviews', name: 'admin-reviews', component: () => import('@/views/admin/ReviewQueue.vue'), meta: { title: '审核队列' } },
      { path: 'reviews/:id', name: 'admin-review-detail', component: () => import('@/views/admin/ReviewDetail.vue'), meta: { title: '审核详情' } },
      { path: 'articles', name: 'admin-articles', component: () => import('@/views/admin/ArticleList.vue'), meta: { title: '全部文章' } },
      { path: 'articles/:id', name: 'admin-article-detail', component: () => import('@/views/admin/ArticleDetail.vue'), meta: { title: '文章详情' } },
      { path: 'articles/:id/audit-logs', name: 'admin-audit-logs', component: () => import('@/views/admin/AuditLogs.vue'), meta: { title: '留痕' } },
      { path: 'categories', name: 'admin-categories', component: () => import('@/views/admin/CategoryManage.vue'), meta: { title: '分类管理' } },
      { path: 'tags', name: 'admin-tags', component: () => import('@/views/admin/TagManage.vue'), meta: { title: '标签管理' } },
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

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
})
