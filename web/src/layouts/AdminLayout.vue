<script setup>
// 后台共用布局（方案 A：编辑与管理员共用，G 负责）。与博客前台 PublicLayout 完全隔离。
// 侧边栏菜单和顶栏角色标签按 auth.user.role 切换；菜单只由 utils/menu.js 生成，不在这里写死。
// 登录与角色判断在 router/index.js 的全局 beforeEach（guard.js）里，这里不再重复。
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { ROLE_LABEL, isMenuActive, menuFor } from '@/utils/menu'

const route = useRoute()
const router = useRouter()
const auth = useAuth()

const role = computed(() => auth.user?.role)
const nav = computed(() => menuFor(role.value, router))
const roleLabel = computed(() => ROLE_LABEL[role.value] || '')

// 登出（mock 占位，F 接真实 #4 接口）
function onLogout() {
  auth.user = null
  auth.csrf_token = null
  router.replace({ name: 'blog-home' })
}
</script>

<template>
  <div class="admin">
    <aside class="sidebar">
      <div class="brand">
        <span class="mark">C</span>
        <span class="txt">CMS 后台</span>
      </div>
      <nav class="nav">
        <router-link
          v-for="n in nav"
          :key="n.route"
          :to="{ name: n.route }"
          class="nav-item"
          :class="{ on: isMenuActive(n, route) }"
        >
          <span class="dot" />
          {{ n.label }}
        </router-link>
      </nav>
      <div class="sidebar-foot">v0.1</div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="crumbs">{{ $route.meta?.title || 'CMS 后台' }}</div>
        <div class="user">
          <span class="u-name">{{ auth.user?.username || '加载中...' }}</span>
          <el-tag v-if="roleLabel" size="small" type="primary">{{ roleLabel }}</el-tag>
          <el-button size="small" text @click="onLogout">退出</el-button>
        </div>
      </header>
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin {
  min-height: 100vh;
  display: flex;
  background: #f3f4f6;
}
.sidebar {
  width: 220px;
  background: #1f2937;
  color: #d1d5db;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 22px;
  border-bottom: 1px solid #374151;
}
.brand .mark {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #1e40af;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-family: var(--serif);
}
.brand .txt { font-weight: 700; font-size: 15px; color: #fff; letter-spacing: 0.04em; }
.nav { padding: 12px 0; flex: 1; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 22px;
  font-size: 14px;
  color: #d1d5db;
  border-left: 3px solid transparent;
  transition: background 0.15s;
}
.nav-item:hover { background: #374151; color: #fff; }
.nav-item.on { background: #374151; color: #fff; border-left-color: #3b82f6; font-weight: 600; }
.nav-item .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: currentColor; opacity: 0.4;
}
.nav-item.on .dot { opacity: 1; background: #3b82f6; }
.sidebar-foot {
  padding: 14px 22px;
  font-size: 11px;
  color: #6b7280;
  border-top: 1px solid #374151;
}

.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  position: sticky;
  top: 0;
  z-index: 5;
}
.crumbs { font-size: 15px; font-weight: 600; color: #111827; }
.user { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #374151; }
.user .u-name { font-weight: 500; }

.content { padding: 24px 28px; flex: 1; }

/* 覆盖 Element Plus primary 色到冷钢蓝 */
.main :deep(.el-button--primary),
.main :deep(.el-tag--primary),
.main :deep(.el-menu-item.is-active) {
  --el-color-primary: #1e40af;
}
</style>
