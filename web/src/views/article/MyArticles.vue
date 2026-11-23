<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchDeleteArticles, deleteArticle, getArticleCounts, listArticles } from '@/api/article'
import BatchResultDialog from '@/components/BatchResultDialog.vue'
import { explain } from '@/utils/errors'
import { fmtDateTime } from '@/utils/format'
import { ALL_STATUSES, STATUS_LABEL, STATUS_TAG_TYPE } from '@/utils/status'

const router = useRouter()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const counts = ref(null)
const selected = ref([])
const batchOpen = ref(false)
const batchResult = ref(null)
const query = reactive({
  page: 1,
  page_size: 10,
  status: '',
  keyword: '',
  sort: 'updated_at,desc',
})

const sorts = [
  { value: 'updated_at,desc', label: '最近更新' },
  { value: 'updated_at,asc', label: '最早更新' },
  { value: 'created_at,desc', label: '最近创建' },
  { value: 'published_at,desc', label: '最近发布' },
  { value: 'title,asc', label: '标题 A→Z' },
]

async function load() {
  loading.value = true
  try {
    const [list, count] = await Promise.all([
      listArticles(query),
      getArticleCounts({ keyword: query.keyword }),
    ])
    rows.value = list.items
    total.value = list.total
    counts.value = count
  } catch (e) {
    ElMessage.error(explain(e, '加载文章失败'))
  } finally {
    loading.value = false
  }
}
onMounted(load)

function onSearch() { query.page = 1; load() }
function canDelete(row) { return row.allowed_actions?.includes('DELETE') }

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `逻辑删除「${row.title}」后，文章会从所有列表中消失，本期不能恢复。`,
      '删除草稿',
      { type: 'warning', confirmButtonText: '确认删除' },
    )
  } catch { return }
  try {
    await deleteArticle(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error(explain(e))
  }
}

async function onBatchDelete() {
  const ids = selected.value.map((r) => r.id)
  if (!ids.length) return
  if (ids.length > 50) {
    ElMessage.warning('一次最多删除 50 篇')
    return
  }
  try {
    await ElMessageBox.confirm(`将逻辑删除 ${ids.length} 篇从未提交过的草稿，且不能恢复。`, '批量删除', { type: 'warning' })
  } catch { return }
  try {
    batchResult.value = await batchDeleteArticles(ids)
    batchOpen.value = true
    selected.value = []
    await load()
  } catch (e) {
    ElMessage.error(explain(e))
  }
}
</script>

<template>
  <div>
    <p class="hint">这里只显示你自己的文章。删除是逻辑删除，只适用于从未提交过的草稿，删除后不可恢复。</p>
    <el-tabs v-model="query.status" @tab-change="onSearch">
      <el-tab-pane name="" :label="`全部 ${counts?.total ?? ''}`" />
      <el-tab-pane v-for="s in ALL_STATUSES" :key="s" :name="s" :label="`${STATUS_LABEL[s]} ${counts?.by_status?.[s] ?? ''}`" />
    </el-tabs>
    <div class="filters">
      <el-input v-model="query.keyword" placeholder="标题或摘要" clearable style="width: 220px" @keyup.enter="onSearch" />
      <el-select v-model="query.sort" style="width: 150px" @change="onSearch">
        <el-option v-for="s in sorts" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <el-button type="primary" @click="onSearch">筛选</el-button>
      <el-button v-permission="'article:delete'" type="danger" plain :disabled="!selected.length" @click="onBatchDelete">
        批量删除（{{ selected.length }}/50）
      </el-button>
      <el-button v-permission="'article:create'" type="primary" plain @click="router.push({ name: 'admin-article-new' })">写文章</el-button>
    </div>
    <el-table :data="rows" v-loading="loading" row-key="id" @selection-change="(v) => selected = v">
      <el-table-column type="selection" width="46" :selectable="canDelete" />
      <el-table-column label="标题" min-width="240">
        <template #default="{ row }">
          <el-link type="primary" @click="router.push({ name: 'admin-my-article', params: { id: row.id } })">{{ row.title }}</el-link>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="STATUS_TAG_TYPE[row.status]" size="small">{{ STATUS_LABEL[row.status] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="170">
        <template #default="{ row }">{{ fmtDateTime(row.updated_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" @click="router.push({ name: 'admin-my-article', params: { id: row.id } })">详情</el-button>
          <el-button v-if="row.allowed_actions?.includes('EDIT')" v-permission="'article:update'" text size="small" @click="router.push({ name: 'admin-article-edit', params: { id: row.id } })">编辑</el-button>
          <el-button v-if="canDelete(row)" v-permission="'article:delete'" text size="small" type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="pager">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.page_size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="onSearch"
      />
    </div>
    <BatchResultDialog v-model="batchOpen" :result="batchResult" />
  </div>
</template>

<style scoped>
.hint { color: #6b7280; font-size: 13px; margin: 0 0 8px; }
.filters { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 12px; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
