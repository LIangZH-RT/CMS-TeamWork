<script setup>
// 当前已选标签（交集）。名称来自 facets；facets 里没有的 ID（已不再被任何已发布文章引用）显示为 ID。
import { useTaxonomy } from '@/stores/taxonomy'

defineProps({
  tagIds: { type: Array, required: true },
  total: { type: Number, default: null },
})
const emit = defineEmits(['toggle', 'clear'])
const taxonomy = useTaxonomy()
const tagName = (id) => taxonomy.tagById(id)?.name ?? `ID ${id}`
</script>

<template>
  <section v-if="tagIds.length" class="filters" aria-label="当前标签筛选">
    <span class="label">已选标签</span>
    <button v-for="id in tagIds" :key="id" type="button" class="chip on" :title="`取消标签：${tagName(id)}`" @click="emit('toggle', { id })">
      #{{ tagName(id) }} <i aria-hidden="true">×</i>
    </button>
    <span v-if="tagIds.length > 1" class="hint">同时包含所选标签</span>
    <button type="button" class="clear" @click="emit('clear')">清除标签</button>
    <span v-if="total !== null" class="count">共 {{ total }} 篇</span>
  </section>
</template>

<style scoped>
.filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 20px; }
.label { font-size: 13px; color: var(--muted); margin-right: 4px; }
.chip { font-size: 13px; padding: 4px 12px; }
.chip i { font-style: normal; opacity: 0.7; }
.hint { font-size: 12px; color: var(--muted); }
.clear { border: 0; background: none; color: var(--accent); cursor: pointer; font-size: 13px; padding: 4px 6px; }
.count { margin-left: auto; font-size: 13px; color: var(--muted); }
</style>
