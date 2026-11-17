<script setup>
// 文章网格 + 加载 / 失败 / 空状态 + 分页。首页、分类页、搜索页共用；筛选怎么改由父组件决定。
import { computed } from 'vue'
import ArticleCard from '@/components/ArticleCard.vue'

const props = defineProps({
  state: { type: String, required: true }, // loading | ready | error
  items: { type: Array, required: true },
  total: { type: Number, default: 0 },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  activeCategory: { type: String, default: null },
  activeTags: { type: Array, default: () => [] },
  emptyText: { type: String, default: '还没有已发布的文章' },
  canClear: { type: Boolean, default: false },
  highlight: { type: String, default: '' },
})
const emit = defineEmits(['pick-category', 'toggle-tag', 'page', 'clear', 'retry'])
const outOfRange = computed(() => props.state === 'ready' && !props.items.length && props.total > 0)
</script>

<template>
  <div v-if="state === 'loading'" class="grid">
    <div v-for="n in 4" :key="n" class="skeleton"><el-skeleton animated :rows="3" /></div>
  </div>

  <div v-else-if="state === 'error'" class="state">
    <p>文章列表加载失败，请稍后重试。</p>
    <el-button @click="emit('retry')">重新加载</el-button>
  </div>

  <template v-else>
    <div v-if="items.length" class="grid">
      <ArticleCard
        v-for="a in items"
        :key="a.id"
        :article="a"
        :active-category="activeCategory"
        :active-tags="activeTags"
        :highlight="highlight"
        @pick-category="emit('pick-category', $event)"
        @toggle-tag="emit('toggle-tag', $event)"
      />
    </div>
    <div v-else class="state">
      <el-empty :description="outOfRange ? '这一页没有文章了' : emptyText" />
      <el-button v-if="outOfRange" @click="emit('page', 1)">回到第 1 页</el-button>
      <el-button v-else-if="canClear" @click="emit('clear')">清除筛选</el-button>
    </div>

    <div v-if="total > pageSize" class="pager">
      <el-pagination
        layout="prev, pager, next"
        background
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="emit('page', $event)"
      />
    </div>
  </template>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
.skeleton { background: #fff; border: 1px solid var(--card-line); border-radius: 14px; padding: 20px; height: 300px; }
.state { text-align: center; padding: 48px 0; color: var(--ink-2); }
.pager { display: flex; justify-content: center; margin-top: 36px; }
</style>
