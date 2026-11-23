<script setup>
// 博客前台布局：顶栏（品牌、分类导航、搜索框、作者登录）+ 页脚。
// 分类导航来自公开列表 facets（api-spec §4.14），前 6 个直接显示，其余收进「更多」。
// 「作者登录」只链到预留的 /login：登录 / 注册页由 F 实现，合入前该路由落到统一 404。
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTaxonomy } from '@/stores/taxonomy'
import { useAuth } from '@/stores/auth'
import SearchBox from '@/components/SearchBox.vue'

const NAV_MAX = 6
const useMock = import.meta.env.VITE_USE_MOCK === 'true'
const route = useRoute()
const router = useRouter()
const taxonomy = useTaxonomy()
const auth = useAuth()
onMounted(() => {
  taxonomy.ensure()
  auth.fetchMe().catch(() => {})
})

const shown = computed(() => taxonomy.categories.slice(0, NAV_MAX))
const more = computed(() => taxonomy.categories.slice(NAV_MAX))
const activeCat = computed(() => (route.name === 'blog-category' ? String(route.params.id) : null))
const moreActive = computed(() => more.value.some((c) => String(c.id) === activeCat.value))
const goCategory = (id) => router.push({ name: 'blog-category', params: { id: String(id) } })
</script>

<template>
  <div class="pub">
    <header class="nav">
      <div class="wrap">
        <router-link to="/" class="logo"><span class="mark">T</span>TeamWork<em>技术博客</em></router-link>
        <nav aria-label="主导航">
          <router-link to="/" class="nav-link" :class="{ on: route.name === 'blog-home' }">首页</router-link>
          <router-link
            v-for="c in shown"
            :key="c.id"
            :to="{ name: 'blog-category', params: { id: String(c.id) } }"
            class="nav-link"
            :class="{ on: activeCat === String(c.id) }"
          >
            {{ c.name }}
          </router-link>
          <el-dropdown v-if="more.length" trigger="click" @command="goCategory">
            <button type="button" class="nav-link more" :class="{ on: moreActive }">更多 ▾</button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="c in more" :key="c.id" :command="String(c.id)">{{ c.name }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </nav>
        <div class="tools">
          <SearchBox />
          <router-link v-if="auth.user" to="/admin" class="login">{{ auth.user.username }} · 进入后台</router-link>
          <router-link v-else to="/login" class="login">作者登录</router-link>
        </div>
      </div>
    </header>
    <router-view />
    <footer class="foot">
      <div class="wrap">
        <span>© 2026 CMS-TeamWork · 8 人小组出品</span>
        <span>
          仅展示已发布文章 · 内容经审核后公开
          <b v-if="useMock" class="mock" title="VITE_USE_MOCK=true：数据来自前端契约 mock">契约 Mock 数据</b>
        </span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.pub { min-height: 100vh; display: flex; flex-direction: column; }
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; gap: 24px; width: 100%; }
.nav { height: 68px; background: rgba(250, 248, 244, 0.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 10; }
.nav .wrap { height: 100%; }
.logo { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 19px; font-family: var(--serif); flex-shrink: 0; }
.mark { width: 32px; height: 32px; border-radius: 8px; background: var(--ink); color: var(--paper); display: grid; place-items: center; font-family: var(--sans); }
.logo em { font-style: normal; font-weight: 400; color: var(--muted); font-size: 14px; margin-left: 2px; }
nav { display: flex; align-items: center; gap: 24px; font-size: 15px; color: var(--ink-2); min-width: 0; overflow: hidden; }
.nav-link { padding: 6px 0; border-bottom: 2px solid transparent; white-space: nowrap; }
.nav-link:hover { color: var(--ink); }
.nav-link.on { color: var(--ink); font-weight: 600; border-bottom-color: var(--accent); }
.more { background: none; border-top: 0; border-left: 0; border-right: 0; color: inherit; cursor: pointer; font-size: 15px; }
.tools { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.login { font-size: 13px; color: var(--muted); border: 1px solid #e2dccf; padding: 6px 14px; border-radius: 999px; white-space: nowrap; }
.login:hover { color: var(--accent); border-color: var(--accent); }
.foot { margin-top: 64px; border-top: 1px solid var(--line); padding: 28px 0; font-size: 13px; color: var(--muted); }
.mock { margin-left: 10px; font-weight: 600; color: #92400e; background: #fef3c7; border-radius: 6px; padding: 2px 8px; font-size: 12px; }
</style>
