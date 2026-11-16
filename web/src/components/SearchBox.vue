<script setup>
// 顶栏搜索框：回车或点按钮跳到 /search?q=。在搜索页时与 URL 里的 q 同步；空关键字不跳转。
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { normalizeKeyword, Q_MAX } from '@/utils/query'

const route = useRoute()
const router = useRouter()
const text = ref('')

watch(
  () => (route.name === 'blog-search' ? normalizeKeyword(route.query.q) : null),
  (q) => {
    if (q !== null) text.value = q
  },
  { immediate: true },
)

function submit() {
  const q = normalizeKeyword(text.value)
  if (!q) return
  router.push({ name: 'blog-search', query: { q } })
}
</script>

<template>
  <form class="search" role="search" @submit.prevent="submit">
    <input
      v-model="text"
      type="search"
      :maxlength="Q_MAX"
      placeholder="搜索标题或摘要"
      aria-label="搜索标题或摘要"
      enterkeyhint="search"
    />
    <button type="submit" aria-label="搜索">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" /><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
    </button>
  </form>
</template>

<style scoped>
.search { display: flex; align-items: center; border: 1px solid #e2dccf; background: #fff; border-radius: 999px; padding: 0 4px 0 14px; height: 34px; }
.search:focus-within { border-color: var(--accent); }
input { border: 0; outline: 0; background: transparent; font: inherit; font-size: 13px; width: 160px; color: var(--ink); }
input::-webkit-search-cancel-button { cursor: pointer; }
button { border: 0; background: none; color: var(--muted); cursor: pointer; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; }
button:hover { color: var(--accent); }
</style>
