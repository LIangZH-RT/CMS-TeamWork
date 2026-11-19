<script setup>
// 全量文章列表（api-spec #6 管理员视角）。
// 6 状态 Tab 切换，默认按 updated_at 降序。管理员在此列表可执行下架动作。
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listArticles, unpublishArticle } from '@/api/admin'
import { fmtDateTime } from '@/utils/format'
import { ARTICLE_STATUS, ALL_STATUSES, STATUS_LABEL, STATUS_TAG_TYPE } from '@/utils/status'

const router = useRouter()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ page: 1, page_size: 15, status: '', category_id: null, author_id: null, title: '' })

const tabList = computed(() => [
  { value: '', label: '全部' },
  ...ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
])

async function load() {
  loading.value = true
  try {
    const res = await listArticles(query)
    rows.value = res.items
    total.value = res.total
  } catch (e) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function onTabChange(v) { query.status = v; query.page = 1; load() }
function onSearch() { query.page = 1; load() }
function goDetail(row) { router.push({ name: 'admin-article-detail', params: { id: row.id } }) }
function goAudit(row) { router.push({ name: 'admin-audit-logs', params: { id: row.id } }) }

async function onUnpublish(row) {
  try {
    const { value } = await ElMessageBox.prompt(
      `下架「${row.title}」？请填写下架原因。`,
      '下架确认',
      {
        confirmButtonText: '确认下架',
        cancelButtonText: '取消',
        inputPattern: /\S+/,
        inputErrorMessage: '下架原因不能为空',
        inputPlaceholder: '例如：涉及敏感信息 / 临时维护 / 内容过时',
        type: 'warning',
      }
    )
    await unpublishArticle(row.id, { reason: value.trim() })
    ElMessage.success('已下架')
    await load()
  } catch (e) {
    if (e === 'cancel') return
    if (e?.code === 40900) {
      // STATE_CONFLICT：状态已被别人改变，刷新列表看最新状态
      ElMessage.error('文章状态已变更，无法下架')
      await load()
    } else ElMessage.error(e?.message || '下架失败')
  }
}
</script>

<template>
  <div class="article-list">
    <el-tabs v-model="query.status" @tab-change="onTabChange" class="tabs">
      <el-tab-pane v-for="t in tabList" :key="t.value" :name="t.value" :label="t.label" />
    </el-tabs>

    <div class="filters">
      <el-input v-model="query.title" placeholder="按标题搜索" clearable style="width: 220px" @keyup.enter="onSearch" />
      <el-input v-model="query.author_id" placeholder="作者 ID" style="width: 140px" @keyup.enter="onSearch" />
      <el-button type="primary" @click="onSearch">搜索</el-button>
      <el-button @click="() => { query.title=''; query.author_id=null; onSearch() }">重置</el-button>
    </div>

    <el-table :data="rows" v-loading="loading" stripe style="margin-top: 16px">
      <el-table-column label="标题" min-width="260">
        <template #default="{ row }">
          <el-link type="primary" @click="goDetail(row)">{{ row.title }}</el-link>
          <div class="meta">作者 {{ row.author.username }} · 分类 {{ row.category.name }}</div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="STATUS_TAG_TYPE[row.status]" size="small">{{ STATUS_LABEL[row.status] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最后更新" width="170">
        <template #default="{ row }">{{ fmtDateTime(row.updated_at) }}</template>
      </el-table-column>
      <el-table-column label="发布时间" width="170">
        <template #default="{ row }">{{ row.published_at ? fmtDateTime(row.published_at) : '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" @click="goDetail(row)">详情</el-button>
          <el-button text size="small" @click="goAudit(row)">留痕</el-button>
          <el-button text size="small" type="danger" :disabled="row.status !== ARTICLE_STATUS.PUBLISHED" @click="onUnpublish(row)">下架</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.page_size"
        :total="total"
        :page-sizes="[15, 30, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="load"
        @current-change="load"
      />
    </div>
  </div>
</template>

<style scoped>
.article-list .tabs { margin-bottom: 8px; }
.filters { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
</style>
