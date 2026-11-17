<script setup>
// 分类胶囊行：「全部」+ facets 里的分类。分类页的分类固定在路径 /category/:id 里。
import { useTaxonomy } from '@/stores/taxonomy'

defineProps({ active: { type: String, default: null } })
const taxonomy = useTaxonomy()
</script>

<template>
  <nav class="pills" aria-label="文章分类">
    <router-link to="/" class="pill" :class="{ on: !active }">全部</router-link>
    <router-link
      v-for="c in taxonomy.categories"
      :key="c.id"
      :to="{ name: 'blog-category', params: { id: String(c.id) } }"
      class="pill"
      :class="{ on: active === String(c.id) }"
    >
      {{ c.name }}
    </router-link>
  </nav>
</template>

<style scoped>
.pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
.pill { border: 1px solid #e2dccf; background: #fff; color: var(--ink-2); border-radius: 999px; padding: 6px 16px; font-size: 14px; }
.pill:hover { border-color: var(--accent); color: var(--accent); }
.pill.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
</style>
