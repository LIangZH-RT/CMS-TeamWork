<script setup>
// 搜索页 /search?q=&tag_ids=&page=【补充·范围延伸】：按关键字匹配已发布文章的标题或摘要（api-spec §11.1 q）。
// 不检索正文；可与标签多选叠加（AND）。没有关键字时不请求列表，只提示输入。
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePublicList } from '@/composables/usePublicList'
import { parseSearchQuery, parseSort, toggleTag, toSearchRouteQuery } from '@/utils/query'
import ArticleGrid from '@/components/ArticleGrid.vue'
import ActiveTagFilters from '@/components/ActiveTagFilters.vue'
import TagFilterPanel from '@/components/TagFilterPanel.vue'
import AboutCard from '@/components/AboutCard.vue'
import PublishSort from '@/components/PublishSort.vue'

const route = useRoute()
const router = useRouter()

const filter = computed(() => ({ ...parseSearchQuery(route.query), sort: parseSort(route.query) }))
const { state, result, reload } = usePublicList(() =>
  route.name === 'blog-search' && filter.value.q ? filter.value : null,
)

watch(
  () => filter.value.q,
  (q) => {
    document.title = q ? `搜索「${q}」 · TeamWork 技术博客` : '搜索 · TeamWork 技术博客'
  },
  { immediate: true },
)

const go = (f) => router.push({ name: 'blog-search', query: toSearchRouteQuery(f) })
const pickCategory = (c) => router.push({ name: 'blog-category', params: { id: String(c.id) } })
const onToggleTag = (t) => go(toggleTag(filter.value, t.id))
const clearTags = () => go({ ...filter.value, page: 1, tag_ids: [] })
const onPage = (p) => go({ ...filter.value, page: p })
const onSort = (sort) => go({ ...filter.value, page: 1, sort })
</script>

<template>
  <main class="page">
    <header class="head">
      <p class="eyebrow">搜索</p>
      <h1 v-if="filter.q">「{{ filter.q }}」</h1>
      <h1 v-else>搜索文章</h1>
      <p class="lead">
        <template v-if="!filter.q">在顶栏输入关键字，匹配已发布文章的标题或摘要。</template>
        <template v-else-if="state === 'ready'">在标题或摘要中找到 {{ result.total }} 篇已发布文章</template>
        <template v-else>正在搜索…</template>
      </p>
    </header>

    <div class="body">
      <div class="list">
        <template v-if="filter.q">
          <PublishSort :sort="filter.sort" @change="onSort" />
          <ActiveTagFilters :tag-ids="filter.tag_ids" :total="state === 'ready' ? result.total : null" @toggle="onToggleTag" @clear="clearTags" />
          <ArticleGrid
            :state="state"
            :items="result.items"
            :total="result.total"
            :page="filter.page"
            :page-size="result.page_size"
            :active-tags="filter.tag_ids"
            :highlight="filter.q"
            :empty-text="filter.tag_ids.length ? `没有同时包含所选标签、且标题或摘要含「${filter.q}」的文章` : `没有标题或摘要含「${filter.q}」的文章，换个关键字试试`"
            :can-clear="filter.tag_ids.length > 0"
            @pick-category="pickCategory"
            @toggle-tag="onToggleTag"
            @page="onPage"
            @clear="clearTags"
            @retry="reload"
          />
          <p v-if="state === 'ready' && !result.total && !filter.tag_ids.length" class="back"><router-link to="/">← 回到首页浏览全部文章</router-link></p>
        </template>
        <el-empty v-else description="输入关键字开始搜索" />
      </div>
      <aside class="aside">
        <TagFilterPanel v-if="filter.q" :selected="filter.tag_ids" @toggle="onToggleTag" @clear="clearTags" />
        <AboutCard />
      </aside>
    </div>
  </main>
</template>

<style scoped>
.page { max-width: 1180px; margin: 0 auto; padding: 0 32px; width: 100%; }
.head { padding: 48px 0 28px; border-bottom: 1px solid var(--line); }
.eyebrow { font-size: 13px; letter-spacing: 0.18em; color: var(--accent); font-weight: 600; margin: 0 0 10px; }
h1 { font-family: var(--serif); font-size: 34px; margin: 0 0 8px; font-weight: 900; word-break: break-all; }
.lead { color: var(--muted); font-size: 14px; margin: 0; }
.body { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 40px; padding-top: 32px; align-items: start; }
.aside { display: grid; gap: 20px; position: sticky; top: 88px; }
.back { text-align: center; font-size: 14px; color: var(--accent); }
@media (max-width: 960px) {
  .body { grid-template-columns: 1fr; }
  .aside { position: static; }
}
</style>
