import { createRouter, createWebHistory } from 'vue-router'
import PublicLayout from '@/layouts/PublicLayout.vue'

// 路由分区（全前端共用，A 维护）：
// - /            博客前台（PublicLayout，匿名只读）
// - /login 等    认证页（F 实现，预留，本期不在前台放入口）
// - /admin/**    编辑与管理员后台（F / G 实现，使用独立 AdminLayout，不挂在 PublicLayout 下）
// 预留分区在对应页面合入前不注册路由，访问时落到前台统一 404。
// 守卫只做体验，不承担任何权限职责（architecture §3.3）。
const routes = [
  {
    path: '/',
    component: PublicLayout,
    children: [
      { path: '', name: 'blog-home', component: () => import('@/views/public/BlogHome.vue') },
      // 前台统一 404：未知路径与「文章不存在 / 未发布」同一文案，不暗示是否曾经存在
      { path: ':pathMatch(.*)*', name: 'not-found', component: () => import('@/views/public/NotFound.vue') },
    ],
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
})
