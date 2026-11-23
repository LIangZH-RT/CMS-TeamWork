<script setup>
// 博客首页（FR-PUBLIC-001、BR-SEARCH-005）：头条、分类胶囊、文章网格、标签多选侧栏、分页。
// 头条 = 最新发布的一篇（第 1 页第 1 条），只在未筛选的第 1 页出现，网格从第 2 条开始。
// 分类筛选走分类页 /category/:id；首页只带 tag_ids、page。不传任何影响可见性的参数（INV-10）。
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePublicList } from '@/composables/usePublicList'
import { parseListQuery, parseSort, toggleTag, toRouteQuery } from '@/utils/query'
import ArticleGrid from '@/components/ArticleGrid.vue'
import ActiveTagFilters from '@/components/ActiveTagFilters.vue'
import CategoryPills from '@/components/CategoryPills.vue'
import HeroFeatured from '@/components/HeroFeatured.vue'
import TagFilterPanel from '@/components/TagFilterPanel.vue'
import AboutCard from '@/components/AboutCard.vue'
import PublishSort from '@/components/PublishSort.vue'

const route = useRoute()
const router = useRouter()

const filter = computed(() => {
  const { page, tag_ids } = parseListQuery(route.query)
  return { page, category_id: null, tag_ids, sort: parseSort(route.query) }
})
const filtered = computed(() => filter.value.tag_ids.length > 0)
const { state, result, reload } = usePublicList(() => (route.name === 'blog-home' ? filter.value : null))
document.title = 'TeamWork 技术博客'

const showHero = computed(() => !filtered.value && filter.value.page === 1)
const featured = computed(() => (showHero.value && state.value === 'ready' ? result.value.items[0] ?? null : null))
const gridItems = computed(() => (featured.value ? result.value.items.slice(1) : result.value.items))

const go = (f) => router.push({ name: 'blog-home', query: toRouteQuery({ ...f, category_id: null }) })
const pickCategory = (c) => router.push({ name: 'blog-category', params: { id: String(c.id) } })
const onToggleTag = (t) => go(toggleTag(filter.value, t.id))
const clearTags = () => go({ page: 1, category_id: null, tag_ids: [] })
const onPage = (p) => go({ ...filter.value, page: p })
const onSort = (sort) => go({ ...filter.value, page: 1, sort })
</script>

<template>
  <main class="home">
    <section v-if="showHero" class="hero" :class="{ solo: !featured }">
      <div>
        <p class="eyebrow">Engineering Notes</p>
        <h1>来自一线的<br />工程实践与复盘</h1>
        <p class="lead">后端、前端、数据库、云原生与 AI 工程。每篇文章都经过团队审核后发布。</p>
      </div>
      <HeroFeatured v-if="featured" :article="featured" />
    </section>

    <div class="body">
      <div class="list">
        <CategoryPills />
        <PublishSort :sort="filter.sort" @change="onSort" />
        <ActiveTagFilters :tag-ids="filter.tag_ids" :total="state === 'ready' ? result.total : null" @toggle="onToggleTag" @clear="clearTags" />
        <ArticleGrid
          :state="state"
          :items="gridItems"
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
      <aside class="aside">
        <TagFilterPanel :selected="filter.tag_ids" @toggle="onToggleTag" @clear="clearTags" />
        <AboutCard />
      </aside>
    </div>
  </main>
</template>

<style scoped>
.home { max-width: 1180px; margin: 0 auto; padding: 0 32px; width: 100%; }
.hero { display: grid; grid-template-columns: 0.9fr 1.3fr; gap: 48px; align-items: center; padding: 56px 0 48px; border-bottom: 1px solid var(--line); }
.hero.solo { grid-template-columns: 1fr; }
.eyebrow { font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); font-weight: 600; margin: 0 0 12px; }
h1 { font-family: var(--serif); font-size: 44px; line-height: 1.25; margin: 0 0 18px; font-weight: 900; }
.lead { color: var(--ink-2); font-size: 16px; line-height: 1.8; margin: 0; }
.body { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 40px; padding-top: 32px; align-items: start; }
.aside { display: grid; gap: 20px; position: sticky; top: 88px; }
@media (max-width: 960px) {
  .hero, .body { grid-template-columns: 1fr; }
  .aside { position: static; }
}
</style>
