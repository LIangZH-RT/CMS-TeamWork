<script setup>
// 公开文章卡片：只用 §4.14 白名单字段。分类 / 标签是按钮，点击后由父组件更新 URL 筛选。
// 卡片本身不是一个大链接（避免链接里嵌按钮），标题和封面各自是链接。
import { ref } from 'vue'
import { fmtDate } from '@/utils/format'
import { splitHighlight } from '@/utils/query'

const props = defineProps({
  article: { type: Object, required: true },
  activeCategory: { type: String, default: null },
  activeTags: { type: Array, default: () => [] },
  highlight: { type: String, default: '' }, // 搜索关键字：标题、摘要里的命中段用 <mark> 标出（纯文本渲染）
})
const emit = defineEmits(['pick-category', 'toggle-tag'])
const coverBroken = ref(false)
const to = `/posts/${props.article.id}`
</script>

<template>
  <article class="card">
    <router-link :to="to" class="thumb" :class="{ none: !article.cover_url || coverBroken }" tabindex="-1" aria-hidden="true">
      <img v-if="article.cover_url && !coverBroken" :src="article.cover_url" alt="" loading="lazy" @error="coverBroken = true" />
      <span v-else>{{ article.category?.name }}</span>
    </router-link>
    <div class="body">
      <div class="meta">
        <button
          v-if="article.category"
          type="button"
          class="chip cat"
          :class="{ on: activeCategory === String(article.category.id) }"
          :title="`筛选分类：${article.category.name}`"
          @click="emit('pick-category', article.category)"
        >
          {{ article.category.name }}
        </button>
        <time :datetime="article.published_at">{{ fmtDate(article.published_at) }}</time>
      </div>
      <h3>
        <router-link :to="to"><template v-for="(s, i) in splitHighlight(article.title, highlight)" :key="i"><mark v-if="s.hit">{{ s.text }}</mark><template v-else>{{ s.text }}</template></template></router-link>
      </h3>
      <p v-if="article.excerpt" class="excerpt">
        <template v-for="(s, i) in splitHighlight(article.excerpt, highlight)" :key="i"><mark v-if="s.hit">{{ s.text }}</mark><template v-else>{{ s.text }}</template></template>
      </p>
      <div v-if="article.tags.length" class="tags">
        <button
          v-for="t in article.tags"
          :key="t.id"
          type="button"
          class="chip"
          :class="{ on: activeTags.includes(String(t.id)) }"
          :title="activeTags.includes(String(t.id)) ? `取消标签：${t.name}` : `加入标签筛选：${t.name}`"
          @click="emit('toggle-tag', t)"
        >
          #{{ t.name }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card { background: #fff; border-radius: 14px; overflow: hidden; border: 1px solid var(--card-line); display: flex; flex-direction: column; transition: box-shadow 0.2s, transform 0.2s; }
.card:hover { transform: translateY(-2px); box-shadow: 0 14px 30px -20px rgba(60, 40, 10, 0.4); }
.thumb { display: block; height: 160px; }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb.none { background: repeating-linear-gradient(135deg, #f3efe7 0 12px, #efe9de 12px 24px); display: grid; place-items: center; font-family: var(--serif); font-size: 22px; color: #a39783; }
.body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 8px; }
.meta { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--muted); }
h3 { font-family: var(--serif); font-size: 18px; line-height: 1.45; margin: 2px 0 0; }
h3 a:hover { color: var(--accent); }
.excerpt { font-size: 13px; color: #6b6458; line-height: 1.7; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
mark { background: #fde7d6; color: inherit; border-radius: 3px; padding: 0 1px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
