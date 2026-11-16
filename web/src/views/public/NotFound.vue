<script setup>
// 前台统一 404：未知路径、文章不存在、文章未发布 / 已下架，全部同一文案（BR-ISO-004、api-spec §11.2），
// 不出现「已下架」「审核中」「曾经存在」等任何暗示
import { onMounted } from 'vue'

onMounted(() => {
  document.title = '页面不存在 · TeamWork 技术博客'
})
</script>

<template>
  <main class="nf">
    <p class="code">404</p>
    <h1>页面不存在</h1>
    <p class="msg">你访问的页面不存在，或暂时无法查看。</p>
    <router-link to="/" class="home">返回首页</router-link>
  </main>
</template>

<style scoped>
.nf { max-width: 560px; margin: 0 auto; padding: 120px 32px 96px; text-align: center; }
.code { font-family: var(--serif); font-size: 88px; font-weight: 900; color: #e7dfd2; margin: 0; line-height: 1; }
h1 { font-family: var(--serif); font-size: 28px; margin: 18px 0 10px; }
.msg { color: var(--ink-2); margin: 0 0 28px; }
.home { display: inline-block; background: var(--ink); color: var(--paper); border-radius: 999px; padding: 9px 22px; font-size: 14px; }
</style>
