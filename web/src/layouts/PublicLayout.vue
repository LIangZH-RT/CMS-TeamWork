<script setup>
// 博客前台布局：只有品牌与「首页」；不放作者登录入口（用户决定），没有公开分类接口所以不做分类导航
const useMock = import.meta.env.VITE_USE_MOCK === 'true'
</script>

<template>
  <div class="pub">
    <header class="nav">
      <div class="wrap">
        <router-link to="/" class="logo"><span class="mark">T</span>TeamWork<em>技术博客</em></router-link>
        <nav>
          <router-link to="/" class="nav-link" exact-active-class="on">首页</router-link>
        </nav>
      </div>
    </header>
    <router-view />
    <footer class="foot">
      <div class="wrap">
        <span>© 2026 CMS-TeamWork</span>
        <span>
          仅展示已发布文章
          <b v-if="useMock" class="mock" title="VITE_USE_MOCK=true：数据来自前端契约 mock">契约 Mock 数据</b>
        </span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.pub { min-height: 100vh; display: flex; flex-direction: column; }
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; width: 100%; }
.nav { height: 64px; background: rgba(250, 248, 244, 0.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 10; }
.nav .wrap { height: 100%; }
.logo { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 19px; font-family: var(--serif); }
.mark { width: 32px; height: 32px; border-radius: 8px; background: var(--ink); color: var(--paper); display: grid; place-items: center; font-family: var(--sans); }
.logo em { font-style: normal; font-weight: 400; color: var(--muted); font-size: 14px; margin-left: 2px; }
nav { display: flex; gap: 28px; font-size: 15px; color: var(--ink-2); }
.nav-link { padding: 6px 0; border-bottom: 2px solid transparent; }
.nav-link.on { color: var(--ink); font-weight: 600; border-bottom-color: var(--accent); }
.foot { margin-top: auto; border-top: 1px solid var(--line); padding: 24px 0; font-size: 13px; color: var(--muted); }
.mock { margin-left: 10px; font-weight: 600; color: #92400e; background: #fef3c7; border-radius: 6px; padding: 2px 8px; font-size: 12px; }
</style>
