<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listOperationLogs } from '@/api/system'
import { explain } from '@/utils/errors'
import { fmtDateTime } from '@/utils/format'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ page: 1, page_size: 20, module: '', success: '', sort: 'created_at,desc' })

async function load() {
  loading.value = true
  try {
    const data = await listOperationLogs({
      ...query,
      success: query.success === '' ? undefined : query.success === 'true',
    })
    rows.value = data.items
    total.value = data.total
  } catch (e) {
    ElMessage.error(explain(e, '加载日志失败'))
  } finally {
    loading.value = false
  }
}
onMounted(load)
function onSearch() { query.page = 1; load() }
</script>

<template>
  <div>
    <p class="hint">系统操作日志只增不改。这里看不到请求体、密码，登录失败也不会记下尝试的登录名。文章流程留痕在文章的「留痕」页。</p>
    <div class="filters">
      <el-select v-model="query.module" clearable placeholder="模块" style="width: 140px" @change="onSearch">
        <el-option v-for="m in ['AUTH', 'ARTICLE', 'REVIEW', 'TAX', 'MEDIA', 'USER']" :key="m" :label="m" :value="m" />
      </el-select>
      <el-select v-model="query.success" clearable placeholder="结果" style="width: 120px" @change="onSearch">
        <el-option label="成功" value="true" />
        <el-option label="失败" value="false" />
      </el-select>
      <el-select v-model="query.sort" style="width: 150px" @change="onSearch">
        <el-option label="时间 ↓" value="created_at,desc" />
        <el-option label="时间 ↑" value="created_at,asc" />
      </el-select>
    </div>
    <el-table :data="rows" v-loading="loading" size="small">
      <el-table-column label="时间" width="160">
        <template #default="{ row }">{{ fmtDateTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作人" width="120">
        <template #default="{ row }">{{ row.operator?.username || '匿名' }}</template>
      </el-table-column>
      <el-table-column prop="module" label="模块" width="90" />
      <el-table-column prop="operation" label="操作" min-width="140" />
      <el-table-column prop="request_uri" label="路径" min-width="180" />
      <el-table-column label="结果" width="90">
        <template #default="{ row }">
          <el-tag :type="row.success ? 'success' : 'danger'" size="small">{{ row.success ? '成功' : row.error_code }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="client_ip" label="IP" width="120" />
    </el-table>
    <div class="pager">
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.page_size" :total="total" layout="total, prev, pager, next" @current-change="load" />
    </div>
  </div>
</template>

<style scoped>
.hint { color: #6b7280; font-size: 13px; }
.filters { display: flex; gap: 8px; margin-bottom: 12px; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
