<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listPermissions, listRoles } from '@/api/system'
import { MODULE_LABEL } from '@/utils/permissions'
import { explain } from '@/utils/errors'

const roles = ref([])
const permissions = ref([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const [r, p] = await Promise.all([listRoles(), listPermissions()])
    roles.value = r
    permissions.value = p
  } catch (e) {
    ElMessage.error(explain(e, '加载失败'))
  } finally {
    loading.value = false
  }
})

function holds(role, code) {
  return role.permissions?.includes(code)
}
</script>

<template>
  <div v-loading="loading">
    <el-alert type="info" :closable="false" show-icon title="角色权限只读" description="本期不能修改角色持有的权限点，也不能新建角色。矩阵由数据库初始化脚本维护。" />
    <div class="roles">
      <el-card v-for="role in roles" :key="role.code" shadow="never">
        <template #header>{{ role.name }} · {{ role.code }}（{{ role.permissions.length }}）</template>
        <el-tag v-for="code in role.permissions" :key="code" class="tag" size="small">{{ code }}</el-tag>
      </el-card>
    </div>
    <h3>全部 {{ permissions.length }} 个权限点</h3>
    <el-table :data="permissions" size="small">
      <el-table-column prop="module" label="模块" width="120">
        <template #default="{ row }">{{ MODULE_LABEL[row.module] || row.module }}</template>
      </el-table-column>
      <el-table-column prop="code" label="权限点" min-width="180" />
      <el-table-column prop="name" label="说明" min-width="180" />
      <el-table-column v-for="role in roles" :key="role.code" :label="role.name" width="110" align="center">
        <template #default="{ row }">{{ holds(role, row.code) ? '✓' : '—' }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.roles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
.tag { margin: 0 6px 6px 0; }
@media (max-width: 800px) { .roles { grid-template-columns: 1fr; } }
</style>
