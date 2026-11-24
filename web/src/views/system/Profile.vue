<script setup>
import { computed } from 'vue'
import { useAuth } from '@/stores/auth'
import { MODULE_LABEL, PERMISSION_DEFS } from '@/utils/permissions'
import { fmtDateTime } from '@/utils/format'

const auth = useAuth()
const user = computed(() => auth.user)
const grouped = computed(() => {
  const have = new Set(user.value?.permissions || [])
  const map = new Map()
  for (const p of PERMISSION_DEFS) {
    if (!have.has(p.code)) continue
    if (!map.has(p.module)) map.set(p.module, [])
    map.get(p.module).push(p)
  }
  return [...map.entries()]
})
</script>

<template>
  <div v-if="user" class="profile">
    <h2>个人资料</h2>
    <p class="lead">本期不采集邮箱、昵称，也不能自助改密。这里只展示当前会话里的账号、角色和权限点。</p>
    <el-descriptions :column="1" border>
      <el-descriptions-item label="登录名">{{ user.username }}</el-descriptions-item>
      <el-descriptions-item label="角色">{{ user.role_name || user.role }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ user.status === 'DISABLED' ? '停用' : '启用' }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ fmtDateTime(user.created_at) }}</el-descriptions-item>
    </el-descriptions>
    <h3>我的权限点（{{ user.permissions?.length || 0 }}）</h3>
    <section v-for="[module, items] in grouped" :key="module" class="block">
      <h4>{{ MODULE_LABEL[module] || module }}</h4>
      <el-tag v-for="p in items" :key="p.code" class="tag">{{ p.name }} · {{ p.code }}</el-tag>
    </section>
  </div>
</template>

<style scoped>
.lead { color: #6b7280; }
.block { margin-top: 16px; }
h4 { margin: 0 0 8px; }
.tag { margin: 0 8px 8px 0; }
</style>
