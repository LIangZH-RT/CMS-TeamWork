import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import appRouter from '@/router'
import { MENU, ROLE_LABEL, homeRouteFor, isMenuActive, menuFor } from './menu'

const Empty = { render: () => null }
const child = (path, name, roles) => ({ path, name, component: Empty, meta: { roles } })

// 模拟 F 的编辑端页面已合入后的路由表
function fullRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/admin',
        component: Empty,
        meta: { requiresAuth: true },
        children: [
          child('my-articles', 'admin-my-articles', ['EDITOR']),
          child('my-articles/new', 'admin-article-new', ['EDITOR']),
          child('reviews', 'admin-reviews', ['ADMIN']),
          child('articles', 'admin-articles', ['ADMIN']),
          child('categories', 'admin-categories', ['ADMIN']),
          child('tags', 'admin-tags', ['EDITOR', 'ADMIN']),
        ],
      },
    ],
  })
}

const labels = (items) => items.map((i) => i.label)

describe('menuFor：按角色和已注册路由生成菜单', () => {
  it('ADMIN：审核队列、全部文章、分类管理、标签管理', () => {
    expect(labels(menuFor('ADMIN', appRouter))).toEqual(['审核队列', '全部文章', '分类管理', '标签管理'])
  })

  it('EDITOR：编辑端页面未注册时只有标签管理', () => {
    expect(labels(menuFor('EDITOR', appRouter))).toEqual(['标签管理'])
  })

  it('EDITOR：编辑端页面注册后为我的文章、写文章、标签管理', () => {
    expect(labels(menuFor('EDITOR', fullRouter()))).toEqual(['我的文章', '写文章', '标签管理'])
  })

  it('ADMIN 在完整路由表下也看不到编辑端菜单', () => {
    expect(labels(menuFor('ADMIN', fullRouter()))).toEqual(['审核队列', '全部文章', '分类管理', '标签管理'])
  })

  it('未登录或未知角色：空菜单', () => {
    expect(menuFor(undefined, appRouter)).toEqual([])
    expect(menuFor('AUDITOR', fullRouter())).toEqual([])
  })

  it('MENU 只定义顺序和文案，不带角色字段', () => {
    for (const item of MENU) expect(item).not.toHaveProperty('roles')
  })
})

describe('homeRouteFor', () => {
  it('首选路由已注册时直接用', () => {
    expect(homeRouteFor('ADMIN', appRouter)).toEqual({ name: 'admin-reviews' })
    expect(homeRouteFor('EDITOR', fullRouter())).toEqual({ name: 'admin-my-articles' })
  })

  it('首选路由未注册时回退到菜单第一项；什么都没有返回 null', () => {
    expect(homeRouteFor('EDITOR', appRouter)).toEqual({ name: 'admin-tags' })
    expect(homeRouteFor('AUDITOR', appRouter)).toBeNull()
  })
})

describe('ROLE_LABEL 与高亮', () => {
  it('角色标签按 api-spec §3.1', () => {
    expect(ROLE_LABEL).toEqual({ EDITOR: '内容编辑', ADMIN: '管理员' })
  })

  it('当前路由或 meta.menu 指向菜单项时高亮', () => {
    const reviews = { route: 'admin-reviews' }
    expect(isMenuActive(reviews, { name: 'admin-reviews', meta: {} })).toBe(true)
    expect(isMenuActive(reviews, appRouter.resolve('/admin/reviews/1'))).toBe(true)
    expect(isMenuActive(reviews, appRouter.resolve('/admin/articles/1'))).toBe(false)
    expect(isMenuActive({ route: 'admin-articles' }, appRouter.resolve('/admin/articles/1/audit-logs'))).toBe(true)
  })
})
