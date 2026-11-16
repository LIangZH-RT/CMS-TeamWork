<script setup>
// 博客首页（FR-PUBLIC-001、BR-SEARCH-005）：已发布文章列表、分类胶囊、多标签交集筛选、分页。
// 分类筛选走分类页 /category/:id；首页只带 tag_ids、page。不传任何影响可见性的参数（INV-10）。
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePublicList } from '@/composables/usePublicList'
import { parseListQuery, toggleTag, toRouteQuery } from '@/utils/query'
import ArticleGrid from '@/components/ArticleGrid.vue'
import ActiveTagFilters from '@/components/ActiveTagFilters.vue'
import CategoryPills from '@/components/CategoryPills.vue'

const route = useRoute()
const router = useRouter()

const filter = computed(() => {
  const { page, tag_ids } = parseListQuery(route.query)
  return { page, category_id: null, tag_ids }
})
const filtered = computed(() => filter.value.tag_ids.length > 0)
const { state, result, reload } = usePublicList(() => (route.name === 'blog-home' ? filter.value : null))
document.title = 'TeamWork 技术博客'

const go = (f) => router.push({ name: 'blog-home', query: toRouteQuery({ ...f, category_id: null }) })
const pickCategory = (c) => router.push({ name: 'blog-category', params: { id: String(c.id) } })
const onToggleTag = (t) => go(toggleTag(filter.value, t.id))
const clearTags = () => go({ page: 1, category_id: null, tag_ids: [] })
const onPage = (p) => go({ ...filter.value, page: p })
</script>

<template>
  <main class="home">
    <section v-if="!filtered && filter.page === 1" class="hero">
      <p class="eyebrow">Engineering Notes</p>
      <h1>来自一线的工程实践与复盘</h1>
      <p class="lead">后端、前端、数据库、云原生与 AI 工程。每篇文章都经过团队审核后发布。</p>
    </section>

    <div class="body">
      <CategoryPills />
      <ActiveTagFilters :tag-ids="filter.tag_ids" :total="state === 'ready' ? result.total : null" @toggle="onToggleTag" @clear="clearTags" />
      <ArticleGrid
        :state="state"
        :items="result.items"
        :total="result.total"
        :page="filter.page"
        :page-size="result.page_size"
        :active-tags="filter.tag_ids"
        :empty-text="filtered ? '没有同时包含所选标签的文章' : '还没有已发布的文章'"
        :can-clear="filtered"
        @pick-category="pickCategory"
        @toggle-tag="onToggleTag"
        @page="onPage"
        @clear="clearTags"
        @retry="reload"
      />
    </div>
  </main>
</template>

<style scoped>
.home { max-width: 1180px; margin: 0 auto; padding: 0 32px; width: 100%; }
.hero { padding: 56px 0 36px; border-bottom: 1px solid var(--line); }
.eyebrow { font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); font-weight: 600; margin: 0 0 12px; }
h1 { font-family: var(--serif); font-size: 40px; line-height: 1.3; margin: 0 0 14px; font-weight: 900; }
.lead { color: var(--ink-2); font-size: 16px; line-height: 1.8; margin: 0; }
.body { padding-top: 32px; }
</style>
