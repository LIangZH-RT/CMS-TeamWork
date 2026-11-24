<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listUsers, updateUserRole, updateUserStatus } from '@/api/system'
import { useAuth } from '@/stores/auth'
import { explain } from '@/utils/errors'
import { fmtDateTime } from '@/utils/format'

const auth = useAuth()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ page: 1, page_size: 10, keyword: '', role: '', status: '', sort: 'created_at,desc' })

async function load() {
  loading.value = true
  try {
    const data = await listUsers(query)
    rows.value = data.items
    total.value = data.total
  } catch (e) {
    ElMessage.error(explain(e, '加载用户失败'))
  } finally {
    loading.value = false
  }
}
onMounted(load)

function onSearch() { query.page = 1; load() }

async function toggle(row) {
  const next = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
  const verb = next === 'DISABLED' ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(`确定${verb}账号 ${row.username}？停用后该账号下次请求会失效。账号不能删除。`, verb, { type: 'warning' })
  } catch { return }
  try {
    await updateUserStatus(row.id, next)
    ElMessage.success(`已${verb}`)
    await load()
  } catch (e) {
    ElMessage.error(explain(e))
  }
}

async function assign(row, role_code) {
  if (row.role === role_code) return
  try {
    await updateUserRole(row.id, role_code)
    ElMessage.success('角色已更新，对方下次请求生效')
    await load()
  } catch (e) {
    ElMessage.error(explain(e))
    await load()
  }
}
</script>

<template>
  <div>
    <p class="hint">账号只能停用，不能删除。名下有文章（含已逻辑删除）的编辑不能提升为管理员。至少保留一个启用的管理员。</p>
    <div class="filters">
      <el-input v-model="query.keyword" placeholder="登录名" clearable style="width: 180px" @keyup.enter="onSearch" />
      <el-select v-model="query.role" clearable placeholder="角色" style="width: 140px" @change="onSearch">
        <el-option label="内容编辑" value="EDITOR" />
        <el-option label="管理员" value="ADMIN" />
      </el-select>
      <el-select v-model="query.status" clearable placeholder="状态" style="width: 120px" @change="onSearch">
        <el-option label="启用" value="ENABLED" />
        <el-option label="停用" value="DISABLED" />
      </el-select>
      <el-select v-model="query.sort" style="width: 160px" @change="onSearch">
        <el-option label="创建时间 ↓" value="created_at,desc" />
        <el-option label="创建时间 ↑" value="created_at,asc" />
        <el-option label="登录名 A→Z" value="username,asc" />
        <el-option label="登录名 Z→A" value="username,desc" />
      </el-select>
      <el-button type="primary" @click="onSearch">筛选</el-button>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column prop="username" label="登录名" min-width="140" />
      <el-table-column label="角色" width="180">
        <template #default="{ row }">
          <el-select v-permission="'user:assign-role'" :model-value="row.role" :disabled="row.id === auth.user?.id" style="width: 140px" @change="(v) => assign(row, v)">
            <el-option label="内容编辑" value="EDITOR" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" size="small">{{ row.status === 'ENABLED' ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ fmtDateTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button v-permission="'user:status'" text size="small" @click="toggle(row)">
            {{ row.status === 'ENABLED' ? '停用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="pager">
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.page_size" :total="total" layout="total, prev, pager, next" @current-change="load" />
    </div>
  </div>
</template>

<style scoped>
.hint { color: #6b7280; font-size: 13px; }
.filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
