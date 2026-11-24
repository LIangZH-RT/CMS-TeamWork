import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import appRouter from './index'
import { resolveBackofficeAccess } from './guard'

const ADMIN = { id: 1, username: 'admin', role: 'ADMIN' }
const EDITOR = { id: 11, username: 'zhangsan', role: 'EDITOR' }
const STRANGER = { id: 99, username: 'x', role: 'AUDITOR' }

const Empty = { render: () => null }

// 模拟 F 的编辑端页面已合入后的路由表
function routerWithEditorPages() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/admin',
        component: Empty,
        meta: { requiresAuth: true },
        children: [
          { path: '', name: 'admin-home', component: Empty, meta: { roles: ['EDITOR', 'ADMIN'] } },
          { path: 'reviews', name: 'admin-reviews', component: Empty, meta: { roles: ['ADMIN'] } },
          { path: 'tags', name: 'admin-tags', component: Empty, meta: { roles: ['EDITOR', 'ADMIN'] } },
          { path: 'my-articles', name: 'admin-my-articles', component: Empty, meta: { roles: ['EDITOR'] } },
          { path: 'no-roles', name: 'admin-no-roles', component: Empty },
        ],
      },
      { path: '/:pathMatch(.*)*', name: 'not-found', component: Empty },
    ],
  })
}

const access = (path, user, router = appRouter) => resolveBackofficeAccess(router.resolve(path), user, router)
const notFound = (path) => ({
  name: 'not-found',
  params: { pathMatch: path.split('?')[0].slice(1).split('/') },
  query: {},
  hash: '',
})

describe('resolveBackofficeAccess：前台与登录页', () => {
  it('不在 requiresAuth 下的路由一律放行（含未登录）', () => {
    for (const p of ['/', '/category/3', '/search?q=vue', '/posts/101', '/login', '/whatever']) {
      expect(access(p, null)).toBe(true)
    }
  })
})

describe('resolveBackofficeAccess：未登录', () => {
  it('访问任何 /admin/** 跳登录页，并带上完整回跳地址', () => {
    for (const p of ['/admin', '/admin/reviews', '/admin/reviews/1', '/admin/tags?page=2']) {
      expect(access(p, null)).toEqual({ path: '/login', query: { redirect: p } })
    }
  })
})

describe('未注册的 /admin 路径', () => {
  it('直接落到前台统一 404（和未知路径同一页面），不经过后台守卫', () => {
    expect(appRouter.resolve('/admin/nope').name).toBe('not-found')
    expect(access('/admin/nope', null)).toBe(true)
  })
})

describe('resolveBackofficeAccess：/admin 按角色重定向', () => {
  it('ADMIN → 审核队列', () => {
    expect(access('/admin', ADMIN)).toEqual({ name: 'admin-reviews' })
  })

  it('EDITOR：跳到我的文章', () => {
    expect(access('/admin', EDITOR)).toEqual({ name: 'admin-my-articles' })
  })

  it('EDITOR：编辑端页面注册后跳到我的文章', () => {
    expect(access('/admin', EDITOR, routerWithEditorPages())).toEqual({ name: 'admin-my-articles' })
  })

  it('未知角色没有可去的页面 → 统一 404', () => {
    expect(access('/admin', STRANGER)).toEqual(notFound('/admin'))
  })
})

describe('resolveBackofficeAccess：角色闸', () => {
  it('ADMIN 能进全部管理员页面和共用页面', () => {
    for (const p of [
      '/admin/reviews', '/admin/reviews/1', '/admin/articles', '/admin/articles/1',
      '/admin/articles/1/audit-logs', '/admin/categories', '/admin/tags',
    ]) {
      expect(access(p, ADMIN)).toBe(true)
    }
  })

  it('EDITOR 访问管理员页面 → 统一 404，保留原地址，不跳登录', () => {
    for (const p of ['/admin/reviews', '/admin/reviews/1', '/admin/articles', '/admin/articles/1', '/admin/categories']) {
      expect(access(p, EDITOR)).toEqual(notFound(p))
    }
  })

  it('EDITOR 能进标签管理和留痕页（归属由服务端判定）', () => {
    expect(access('/admin/tags', EDITOR)).toBe(true)
    expect(access('/admin/articles/101/audit-logs', EDITOR)).toBe(true)
  })

  it('ADMIN 访问编辑端页面 → 统一 404', () => {
    expect(access('/admin/my-articles', ADMIN, routerWithEditorPages())).toEqual(notFound('/admin/my-articles'))
  })

  it('未知角色访问任何后台页面 → 统一 404', () => {
    expect(access('/admin/tags', STRANGER)).toEqual(notFound('/admin/tags'))
    expect(access('/admin/articles/1/audit-logs', STRANGER)).toEqual(notFound('/admin/articles/1/audit-logs'))
  })

  it('子路由忘了声明 meta.roles → 默认拒绝（统一 404）', () => {
    expect(access('/admin/no-roles', ADMIN, routerWithEditorPages())).toEqual(notFound('/admin/no-roles'))
  })

  it('统一 404 保留 query 和 hash', () => {
    expect(access('/admin/reviews?page=2#top', EDITOR)).toEqual({
      name: 'not-found',
      params: { pathMatch: ['admin', 'reviews'] },
      query: { page: '2' },
      hash: '#top',
    })
  })
})

describe('路由表：管理员页面都声明了 meta.roles', () => {
  it('/admin 下每个具名子路由都有 roles，且只用 EDITOR / ADMIN', () => {
    const children = appRouter.getRoutes().filter((r) => r.path.startsWith('/admin') && r.name)
    expect(children.length).toBeGreaterThanOrEqual(8)
    for (const r of children) {
      expect(Array.isArray(r.meta.roles), r.name).toBe(true)
      for (const role of r.meta.roles) expect(['EDITOR', 'ADMIN']).toContain(role)
    }
  })
})
