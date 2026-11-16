<script setup>
// 已发布文章详情（FR-PUBLIC-002）。只展示 §8.2 / api-spec §4.14 白名单：
// 标题、摘要、封面、分类、标签、published_at、Markdown 正文、音频。
// 不展示作者、状态、轮次、审核意见、下架原因、预定时间。
// 不存在 / 未发布 → 原地渲染统一 404 页，与未知路径同一文案。
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getPublicArticle } from '@/api/public'
import { isNotFound } from '@/api/http'
import { useSeenTaxonomy } from '@/stores/seenTaxonomy'
import { fmtDateTime, fmtOffset } from '@/utils/format'
import MarkdownView from '@/components/MarkdownView.vue'
import NotFound from './NotFound.vue'

const route = useRoute()
const seen = useSeenTaxonomy()
const ID_RE = /^[1-9]\d{0,18}$/

const state = ref('loading') // loading | ready | notfound | error
const article = ref(null)
const coverBroken = ref(false)
const audioBroken = ref(false)
let seq = 0

async function load(id) {
  const my = ++seq
  article.value = null
  coverBroken.value = false
  audioBroken.value = false
  if (!ID_RE.test(id)) {
    state.value = 'notfound'
    return
  }
  state.value = 'loading'
  try {
    const a = await getPublicArticle(id)
    if (my !== seq) return
    seen.remember([a])
    article.value = a
    state.value = 'ready'
    document.title = `${a.title} · TeamWork 技术博客`
  } catch (e) {
    if (my !== seq) return
    state.value = isNotFound(e) ? 'notfound' : 'error'
  }
}

watch(
  () => (route.name === 'blog-article' ? String(route.params.id) : null),
  (id) => id !== null && load(id),
  { immediate: true },
)

const catLink = computed(() => article.value?.category && { name: 'blog-home', query: { category_id: String(article.value.category.id) } })
const tagLink = (t) => ({ name: 'blog-home', query: { tag_ids: [String(t.id)] } })
</script>

<template>
  <NotFound v-if="state === 'notfound'" />

  <main v-else-if="state === 'error'" class="post state">
    <p>文章加载失败，请稍后重试。</p>
    <el-button @click="load(String(route.params.id))">重新加载</el-button>
  </main>

  <main v-else-if="state === 'loading'" class="post">
    <div class="head"><el-skeleton animated :rows="6" /></div>
  </main>

  <main v-else class="post">
    <nav class="crumbs" aria-label="面包屑">
      <router-link to="/">首页</router-link>
      <span>/</span>
      <router-link v-if="catLink" :to="catLink">{{ article.category.name }}</router-link>
      <span>/</span>
      <span class="cur">{{ article.title }}</span>
    </nav>

    <header class="head">
      <router-link v-if="catLink" :to="catLink" class="chip cat">{{ article.category.name }}</router-link>
      <h1>{{ article.title }}</h1>
      <p v-if="article.excerpt" class="excerpt">{{ article.excerpt }}</p>
      <div class="meta">
        <time :datetime="article.published_at">
          发布于 {{ fmtDateTime(article.published_at) }}
          <small>（{{ fmtOffset(article.published_at) }}）</small>
        </time>
      </div>
      <div v-if="article.tags.length" class="tags">
        <router-link v-for="t in article.tags" :key="t.id" :to="tagLink(t)" class="chip">#{{ t.name }}</router-link>
      </div>
    </header>

    <img v-if="article.cover_url && !coverBroken" :src="article.cover_url" class="cover" alt="" @error="coverBroken = true" />

    <div class="col">
      <section v-if="article.audio_url" class="audio" aria-label="文章音频">
        <b>收听本文</b>
        <audio v-if="!audioBroken" controls preload="metadata" :src="article.audio_url" @error="audioBroken = true" />
        <span v-else class="muted">音频暂不可用</span>
      </section>

      <MarkdownView :content="article.content" id="public-article" />

      <footer class="end">
        <router-link to="/">← 返回文章列表</router-link>
      </footer>
    </div>
  </main>
</template>

<style scoped>
.post { max-width: 1180px; margin: 0 auto; padding: 0 32px 64px; width: 100%; }
.post.state { text-align: center; padding: 96px 32px; color: var(--ink-2); }
.crumbs { display: flex; gap: 8px; font-size: 13px; color: var(--muted); padding-top: 24px; max-width: 760px; margin: 0 auto; overflow: hidden; white-space: nowrap; }
.crumbs a:hover { color: var(--accent); }
.crumbs .cur { overflow: hidden; text-overflow: ellipsis; color: var(--ink-2); }
.head { max-width: 760px; margin: 0 auto; padding: 32px 0 28px; text-align: center; }
h1 { font-family: var(--serif); font-weight: 900; font-size: 38px; line-height: 1.35; margin: 16px 0 14px; }
.excerpt { font-size: 17px; color: var(--ink-2); line-height: 1.8; margin: 0 0 16px; }
.meta { font-size: 13px; color: var(--muted); }
.meta small { font-size: 12px; }
.tags { display: flex; justify-content: center; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.cover { width: 100%; max-height: 420px; object-fit: cover; border-radius: 18px; display: block; }
.col { max-width: 760px; margin: 36px auto 0; }
.audio { display: flex; align-items: center; gap: 16px; background: #fff; border: 1px solid var(--card-line); border-radius: 14px; padding: 12px 18px; margin-bottom: 28px; }
.audio b { font-size: 14px; white-space: nowrap; }
.audio audio { flex: 1; height: 40px; }
.muted { color: var(--muted); font-size: 13px; }
.end { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--line); font-size: 14px; color: var(--muted); }
.end a:hover { color: var(--accent); }
</style>
