// 博客前台的分类 / 标签导航数据，来自公开列表的 facets（api-spec §4.14、§11.1 with_facets）。
// 只在一次浏览会话（页面不刷新）内复用，不落 localStorage：下架导致分类消失时，刷新即可看到最新导航。
// 加载失败时导航留空、列表照常可用；再次调用 ensure() 会重试。
import { defineStore } from 'pinia'
import { getPublicFacets } from '@/api/public'

let pending = null

export const useTaxonomy = defineStore('taxonomy', {
  state: () => ({ status: 'idle', categories: [], tags: [] }), // idle | loading | ready | error
  getters: {
    categoryById: (s) => (id) => s.categories.find((c) => String(c.id) === String(id)) ?? null,
    tagById: (s) => (id) => s.tags.find((t) => String(t.id) === String(id)) ?? null,
  },
  actions: {
    /** 幂等：并发调用共用同一个请求 */
    ensure() {
      if (this.status === 'ready') return Promise.resolve()
      if (pending) return pending
      this.status = 'loading'
      pending = getPublicFacets()
        .then((f) => {
          this.categories = f.categories
          this.tags = f.tags
          this.status = 'ready'
        })
        .catch(() => {
          this.status = 'error'
        })
        .finally(() => {
          pending = null
        })
      return pending
    },
  },
})
