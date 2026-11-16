<script setup>
// 首页头条：最新发布的一篇（公开列表第 1 页第 1 条，默认按 published_at 降序）。只用 §4.14 白名单字段。
import { ref } from 'vue'
import { fmtDate } from '@/utils/format'

const props = defineProps({ article: { type: Object, required: true } })
const coverBroken = ref(false)
const to = () => `/posts/${props.article.id}`
</script>

<template>
  <router-link :to="to()" class="feature" :aria-label="`头条：${article.title}`">
    <div class="cover" :class="{ none: !article.cover_url || coverBroken }">
      <img v-if="article.cover_url && !coverBroken" :src="article.cover_url" alt="" @error="coverBroken = true" />
      <span v-else>{{ article.category?.name }}</span>
    </div>
    <div class="fbody">
      <span v-if="article.category" class="cat">{{ article.category.name }}</span>
      <h2>{{ article.title }}</h2>
      <p v-if="article.excerpt">{{ article.excerpt }}</p>
      <span class="date"><time :datetime="article.published_at">{{ fmtDate(article.published_at) }}</time> · 阅读全文 →</span>
    </div>
  </router-link>
</template>

<style scoped>
.feature { display: block; background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 40px -24px rgba(60, 40, 10, 0.35); border: 1px solid var(--card-line); transition: transform 0.2s; }
.feature:hover { transform: translateY(-2px); }
.cover { height: 230px; }
.cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover.none { background: repeating-linear-gradient(135deg, #f3efe7 0 12px, #efe9de 12px 24px); display: grid; place-items: center; font-family: var(--serif); font-size: 26px; color: #a39783; }
.fbody { padding: 22px 26px 24px; }
.cat { font-size: 12px; color: var(--accent); font-weight: 600; }
h2 { font-family: var(--serif); font-size: 24px; margin: 8px 0; line-height: 1.4; }
p { color: var(--ink-2); font-size: 14px; line-height: 1.7; margin: 0 0 12px; }
.date { font-size: 13px; color: var(--muted); }
</style>
