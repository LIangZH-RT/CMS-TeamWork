<script setup>
defineProps({ sort: { type: String, default: 'desc' } })
defineEmits(['change'])
</script>

<template>
  <div class="sortbar" aria-label="发布时间排序">
    <span>排序</span>
    <button type="button" :class="{ on: sort !== 'asc' }" @click="$emit('change', 'desc')">最新发布</button>
    <button type="button" :class="{ on: sort === 'asc' }" @click="$emit('change', 'asc')">最早发布</button>
  </div>
</template>

<style scoped>
.sortbar { display: flex; align-items: center; gap: 8px; margin: 4px 0 16px; font-size: 13px; color: var(--muted); }
button { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 4px 12px; cursor: pointer; color: var(--ink-2); }
button.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
</style>
