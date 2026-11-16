// 记住本次浏览中「从文章数据里见过」的分类 / 标签名称，只用于给 URL 里的筛选 ID 显示名字。
// 这不是分类导航：没有公开分类 / 标签列表接口（用户决定），不能把这里的数据当成完整集合展示。
import { defineStore } from 'pinia'

export const useSeenTaxonomy = defineStore('seenTaxonomy', {
  state: () => ({ categories: {}, tags: {} }),
  actions: {
    remember(articles) {
      for (const a of articles) {
        if (a.category) this.categories[String(a.category.id)] = a.category.name
        for (const t of a.tags || []) this.tags[String(t.id)] = t.name
      }
    },
  },
})
