<script setup>
// 分类页 /category/:id（BR-TAX-003「前台导航」）：分类固定在路径里，tag_ids、page 走 query。
// 分类是否存在以 facets 为准：不在 facets 里（不存在、或没有已发布文章）与未知路径同一个 404，
// 不区分「分类存在但没有公开文章」，避免暴露空分类。facets 加载失败时不判 404，照常请求列表。
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTaxonomy } from '@/stores/taxonomy'
import { usePublicList } from '@/composables/usePublicList'
import { isId, parseListQuery, parseSort, toggleTag, toRouteQuery } from '@/utils/query'
import ArticleGrid from '@/components/ArticleGrid.vue'
import ActiveTagFilters from '@/components/ActiveTagFilters.vue'
import CategoryPills from '@/components/CategoryPills.vue'
import TagFilterPanel from '@/components/TagFilterPanel.vue'
import AboutCard from '@/components/AboutCard.vue'
import PublishSort from '@/components/PublishSort.vue'
import NotFound from '@/views/public/NotFound.vue'

const route = useRoute()
const router = useRouter()
const taxonomy = useTaxonomy()
taxonomy.ensure()

const id = computed(() => String(route.params.id ?? ''))
const category = computed(() => taxonomy.categoryById(id.value))
const notFound = computed(() => !isId(id.value) || (taxonomy.status === 'ready' && !category.value))
const filter = computed(() => {
  const { page, tag_ids } = parseListQuery(route.query)
  return { page, category_id: id.value, tag_ids, sort: parseSort(route.query) }
})
// 先等 facets 有结论（成功或失败）再请求列表，未知分类不会多发一次列表请求
const decided = computed(() => taxonomy.status === 'ready' || taxonomy.status === 'error')
const { state, result, reload } = usePublicList(() =>
  route.name === 'blog-category' && decided.value && !notFound.value ? filter.value : null,
)

watch(
  () => [notFound.value, category.value?.name],
  ([nf, name]) => {
    if (!nf) document.title = `${name ?? '分类'} · TeamWork 技术博客`
  },
  { immediate: true },
)

const go = (f) => router.push({ name: 'blog-category', params: { id: id.value }, query: toRouteQuery({ ...f, category_id: null }) })
const pickCategory = (c) => router.push({ name: 'blog-category', params: { id: String(c.id) } })
const onToggleTag = (t) => go(toggleTag(filter.value, t.id))
const clearTags = () => go({ ...filter.value, page: 1, tag_ids: [] })
const onPage = (p) => go({ ...filter.value, page: p })
const onSort = (sort) => go({ ...filter.value, page: 1, sort })
</script>

<template>
  <NotFound v-if="notFound" />
  <main v-else class="page">
    <header class="head">
      <p class="eyebrow">分类</p>
      <h1>{{ category?.name ?? '分类文章' }}</h1>
      <p v-if="state === 'ready'" class="lead">共 {{ result.total }} 篇已发布文章</p>
    </header>

    <div class="body">
      <div class="list">
        <CategoryPills :active="id" />
        <PublishSort :sort="filter.sort" @change="onSort" />
        <ActiveTagFilters :tag-ids="filter.tag_ids" :total="state === 'ready' ? result.total : null" @toggle="onToggleTag" @clear="clearTags" />
        <ArticleGrid
          :state="state"
          :items="result.items"
          :total="result.total"
          :page="filter.page"
          :page-size="result.page_size"
          :active-category="id"
          :active-tags="filter.tag_ids"
          :empty-text="filter.tag_ids.length ? '该分类下没有同时包含所选标签的文章' : '该分类下还没有已发布的文章'"
          :can-clear="filter.tag_ids.length > 0"
          @pick-category="pickCategory"
          @toggle-tag="onToggleTag"
          @page="onPage"
          @clear="clearTags"
          @retry="reload"
        />
      </div>
      <aside class="aside">
        <TagFilterPanel :selected="filter.tag_ids" @toggle="onToggleTag" @clear="clearTags" />
        <AboutCard />
      </aside>
    </div>
  </main>
</template>

<style scoped>
.page { max-width: 1180px; margin: 0 auto; padding: 0 32px; width: 100%; }
.head { padding: 48px 0 28px; border-bottom: 1px solid var(--line); }
.eyebrow { font-size: 13px; letter-spacing: 0.18em; color: var(--accent); font-weight: 600; margin: 0 0 10px; }
h1 { font-family: var(--serif); font-size: 34px; margin: 0 0 8px; font-weight: 900; }
.lead { color: var(--muted); font-size: 14px; margin: 0; }
.body { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 40px; padding-top: 32px; align-items: start; }
.aside { display: grid; gap: 20px; position: sticky; top: 88px; }
@media (max-width: 960px) {
  .body { grid-template-columns: 1fr; }
  .aside { position: static; }
}
</style>
