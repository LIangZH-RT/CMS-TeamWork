// 公开文章列表的加载状态机（首页、分类页、搜索页共用）。
// source() 返回本次要请求的列表参数；返回 null 表示当前不该请求（例如路由已离开本页）。
// 只保留最后一次请求的结果：快速切换筛选时，先发出的慢请求不会覆盖后发出的结果。
import { ref, watch } from 'vue'
import { listPublicArticles, PUBLIC_PAGE_SIZE } from '@/api/public'

export function usePublicList(source, { onLoaded } = {}) {
  const state = ref('loading') // loading | ready | error
  const result = ref({ items: [], page: 1, page_size: PUBLIC_PAGE_SIZE, total: 0, facets: null })
  let seq = 0
  let last = null

  async function load(params) {
    const my = ++seq
    state.value = 'loading'
    try {
      const r = await listPublicArticles(params)
      if (my !== seq) return
      onLoaded?.(r)
      result.value = r
      state.value = 'ready'
    } catch {
      if (my !== seq) return
      state.value = 'error'
    }
  }

  watch(
    () => {
      const p = source()
      return p ? JSON.stringify(p) : null
    },
    (key) => {
      if (key === null) return
      last = JSON.parse(key)
      load(last)
    },
    { immediate: true },
  )

  const reload = () => last && load(last)
  return { state, result, reload }
}
