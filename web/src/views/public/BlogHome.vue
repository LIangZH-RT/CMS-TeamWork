<script setup>
// 博客首页（FR-PUBLIC-001、BR-SEARCH-005）：已发布文章列表、分类 + 多标签交集筛选、分页。
// 没有公开分类 / 标签列表接口（用户决定），所以不做完整分类导航：
// 筛选入口就是文章卡片上的分类 / 标签；当前筛选写在 URL（category_id、tag_ids、page），可一键清除。
// 不传任何影响可见性的参数（status、author_id…），只展示接口返回项。
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSeenTaxonomy } from '@/stores/seenTaxonomy'
import { usePublicList } from '@/composables/usePublicList'
import { hasFilter, parseListQuery, toggleTag, toRouteQuery, withCategory } from '@/utils/query'
import ArticleCard from '@/components/ArticleCard.vue'

const route = useRoute()
const router = useRouter()
const seen = useSeenTaxonomy()

const filter = computed(() => parseListQuery(route.query))
const filtered = computed(() => hasFilter(filter.value))
const { state, result, reload: load } = usePublicList(
  () => (route.name === 'blog-home' ? filter.value : null),
  { onLoaded: (r) => seen.remember(r.items) },
)
document.title = 'TeamWork 技术博客'

const go = (f) => router.push({ name: 'blog-home', query: toRouteQuery(f) })
const pickCategory = (c) => go(withCategory(filter.value, c.id))
const onToggleTag = (t) => go(toggleTag(filter.value, t.id))
const clearCategory = () => go({ ...filter.value, page: 1, category_id: null })
const clearAll = () => go({ page: 1, category_id: null, tag_ids: [] })
const onPage = (p) => go({ ...filter.value, page: p })

const catName = (id) => seen.categories[id] ?? `ID ${id}`
const tagName = (id) => seen.tags[id] ?? `ID ${id}`
const outOfRange = computed(() => state.value === 'ready' && !result.value.items.length && result.value.total > 0)
</script>

<template>
  <main class="home">
    <section v-if="!filtered && filter.page === 1" class="hero">
      <p class="eyebrow">Engineering Notes</p>
      <h1>来自一线的工程实践与复盘</h1>
      <p class="lead">每篇文章都经过团队审核后发布。点文章上的分类或标签，就能筛出同类文章。</p>
    </section>

    <section v-if="filtered" class="filters" aria-label="当前筛选">
      <span class="label">当前筛选</span>
      <button v-if="filter.category_id" type="button" class="chip on" @click="clearCategory">
        分类：{{ catName(filter.category_id) }} <i aria-hidden="true">×</i>
      </button>
      <button
        v-for="id in filter.tag_ids"
        :key="id"
        type="button"
        class="chip on"
        @click="onToggleTag({ id })"
      >
        标签：{{ tagName(id) }} <i aria-hidden="true">×</i>
      </button>
      <span v-if="filter.tag_ids.length > 1" class="hint">同时包含所选标签</span>
      <button type="button" class="clear" @click="clearAll">清除筛选</button>
      <span v-if="state === 'ready'" class="count">共 {{ result.total }} 篇</span>
    </section>

    <div v-if="state === 'loading'" class="grid">
      <div v-for="n in 4" :key="n" class="skeleton"><el-skeleton animated :rows="3" /></div>
    </div>

    <div v-else-if="state === 'error'" class="state">
      <p>文章列表加载失败，请稍后重试。</p>
      <el-button @click="load">重新加载</el-button>
    </div>

    <template v-else>
      <div v-if="result.items.length" class="grid">
        <ArticleCard
          v-for="a in result.items"
          :key="a.id"
          :article="a"
          :active-category="filter.category_id"
          :active-tags="filter.tag_ids"
          @pick-category="pickCategory"
          @toggle-tag="onToggleTag"
        />
      </div>
      <div v-else class="state">
        <el-empty :description="outOfRange ? '这一页没有文章了' : filtered ? '没有符合当前筛选的文章' : '还没有已发布的文章'" />
        <el-button v-if="outOfRange" @click="onPage(1)">回到第 1 页</el-button>
        <el-button v-else-if="filtered" @click="clearAll">清除筛选</el-button>
      </div>

      <div v-if="result.total > result.page_size" class="pager">
        <el-pagination
          layout="prev, pager, next"
          background
          :total="result.total"
          :page-size="result.page_size"
          :current-page="filter.page"
          @current-change="onPage"
        />
      </div>
    </template>
  </main>
</template>

<style scoped>
.home { max-width: 1180px; margin: 0 auto; padding: 0 32px 64px; width: 100%; }
.hero { padding: 56px 0 36px; border-bottom: 1px solid var(--line); margin-bottom: 32px; }
.eyebrow { font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); font-weight: 600; margin: 0 0 12px; }
h1 { font-family: var(--serif); font-size: 40px; line-height: 1.3; margin: 0 0 14px; font-weight: 900; }
.lead { color: var(--ink-2); font-size: 16px; line-height: 1.8; margin: 0; }
.filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 28px 0 20px; margin-bottom: 20px; border-bottom: 1px solid var(--line); }
.filters .label { font-size: 13px; color: var(--muted); margin-right: 4px; }
.filters .chip { font-size: 13px; padding: 4px 12px; }
.filters .chip i { font-style: normal; opacity: 0.7; }
.hint { font-size: 12px; color: var(--muted); }
.clear { border: 0; background: none; color: var(--accent); cursor: pointer; font-size: 13px; padding: 4px 6px; }
.count { margin-left: auto; font-size: 13px; color: var(--muted); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; }
.skeleton { background: #fff; border: 1px solid var(--card-line); border-radius: 14px; padding: 20px; height: 300px; }
.state { text-align: center; padding: 48px 0; color: var(--ink-2); }
.pager { display: flex; justify-content: center; margin-top: 36px; }
</style>
