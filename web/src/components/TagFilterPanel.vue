<script setup>
// 侧栏「按标签筛选」：facets 里的全部标签，可多选，交集语义（BR-SEARCH-005）。
// 标签较多时默认只显示前 TAG_FOLD 个，已选标签始终显示。
import { computed, ref } from 'vue'
import { useTaxonomy } from '@/stores/taxonomy'

const TAG_FOLD = 18
const props = defineProps({ selected: { type: Array, default: () => [] } })
const emit = defineEmits(['toggle', 'clear'])
const taxonomy = useTaxonomy()
const expanded = ref(false)

const isOn = (t) => props.selected.includes(String(t.id))
const visible = computed(() =>
  expanded.value ? taxonomy.tags : taxonomy.tags.filter((t, i) => i < TAG_FOLD || isOn(t)),
)
const foldable = computed(() => taxonomy.tags.length > TAG_FOLD)
</script>

<template>
  <section class="widget" aria-labelledby="tag-panel-title">
    <h4 id="tag-panel-title">按标签筛选</h4>
    <p class="tip">可多选，显示同时包含所选标签的文章</p>
    <p v-if="taxonomy.status === 'error'" class="tip">标签加载失败，可点文章上的标签筛选</p>
    <div class="cloud">
      <button
        v-for="t in visible"
        :key="t.id"
        type="button"
        :class="{ on: isOn(t) }"
        :aria-pressed="isOn(t)"
        @click="emit('toggle', t)"
      >
        {{ t.name }}
      </button>
    </div>
    <div v-if="foldable || selected.length" class="ops">
      <button v-if="foldable" type="button" class="link" @click="expanded = !expanded">{{ expanded ? '收起' : `展开全部 ${taxonomy.tags.length} 个` }}</button>
      <button v-if="selected.length" type="button" class="link" @click="emit('clear')">清除所选（{{ selected.length }}）</button>
    </div>
  </section>
</template>

<style scoped>
.widget { background: #fff; border: 1px solid var(--card-line); border-radius: 14px; padding: 18px 20px; }
h4 { font-family: var(--serif); font-size: 16px; margin: 0 0 4px; }
.tip { font-size: 12px; color: var(--muted); margin: 0 0 14px; }
.cloud { display: flex; flex-wrap: wrap; gap: 8px; }
.cloud button { border: 1px solid #e2dccf; background: #fff; color: var(--ink-2); border-radius: 999px; padding: 4px 12px; font-size: 13px; cursor: pointer; }
.cloud button:hover { border-color: var(--accent); color: var(--accent); }
.cloud button.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); font-weight: 600; }
.ops { display: flex; justify-content: space-between; margin-top: 12px; }
.link { border: 0; background: none; color: var(--accent); cursor: pointer; font-size: 12px; padding: 0; }
</style>
