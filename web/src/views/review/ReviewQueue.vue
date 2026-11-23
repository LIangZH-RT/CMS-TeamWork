<script setup>
// 审核队列（api-spec §7.1）。列出所有 PENDING_REVIEW，按 submitted_at 升序；队列项字段见 §4.12。
// 不返回正文，正文在详情页读取（§6.3）。
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getReviewQueue } from '@/api/review'
import { getArticleCounts } from '@/api/article'
import { fmtDateTime } from '@/utils/format'

const router = useRouter()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const counts = ref(null) // §6.9：{ by_status: { DRAFT… }, total }
const query = reactive({ page: 1, page_size: 10, category_id: null, author_id: null, title: '' })

async function load() {
  loading.value = true
  try {
    const [q, c] = await Promise.all([getReviewQueue(query), getArticleCounts()])
    // http.js unwrap 已自动解包 {code,message,data} → 这里直接是接口 data 字段
    rows.value = q.items
    total.value = q.total
    counts.value = c
  } catch (e) {
    ElMessage.error(e?.message || '加载审核队列失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function onSearch() { query.page = 1; load() }
function goDetail(row) { router.push({ name: 'admin-review-detail', params: { id: row.id } }) }
</script>

<template>
  <div class="review-queue">
    <div class="stats" v-if="counts">
      <div class="stat-card pending">
        <div class="num">{{ counts.by_status.PENDING_REVIEW }}</div>
        <div class="label">待审核</div>
      </div>
      <div class="stat-card published">
        <div class="num">{{ counts.by_status.PUBLISHED }}</div>
        <div class="label">已发布</div>
      </div>
      <div class="stat-card rejected">
        <div class="num">{{ counts.by_status.REJECTED }}</div>
        <div class="label">驳回</div>
      </div>
      <div class="stat-card scheduled">
        <div class="num">{{ counts.by_status.SCHEDULED }}</div>
        <div class="label">待发布</div>
      </div>
    </div>

    <div class="filters">
      <el-input v-model="query.title" placeholder="按标题搜索" clearable style="width: 220px" @keyup.enter="onSearch" />
      <el-input v-model="query.author_id" placeholder="作者 ID" style="width: 140px" @keyup.enter="onSearch" />
      <el-button type="primary" @click="onSearch">搜索</el-button>
      <el-button @click="() => { query.title=''; query.author_id=null; onSearch() }">重置</el-button>
    </div>

    <el-table :data="rows" v-loading="loading" stripe empty-text="暂无待审核文章" style="margin-top: 16px">
      <el-table-column label="标题" min-width="260">
        <template #default="{ row }">
          <el-link type="primary" @click="goDetail(row)">{{ row.title }}</el-link>
          <div class="meta">
            作者 {{ row.author.username }} · 分类 {{ row.category.name }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="预定发布" width="180">
        <template #default="{ row }">{{ row.scheduled_publish_time ? fmtDateTime(row.scheduled_publish_time) : '—' }}</template>
      </el-table-column>
      <el-table-column label="提交时间" width="180">
        <template #default="{ row }">{{ fmtDateTime(row.submitted_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="goDetail(row)">审核</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.page_size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="load"
        @current-change="load"
      />
    </div>
  </div>
</template>

<style scoped>
.review-queue .stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.stat-card {
  background: #fff;
  border-radius: 10px;
  padding: 16px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border-left: 4px solid;
}
.stat-card .num { font-size: 28px; font-weight: 700; }
.stat-card .label { font-size: 13px; color: #6b7280; margin-top: 4px; }
.stat-card.pending { border-color: #f59e0b; }
.stat-card.pending .num { color: #b45309; }
.stat-card.published { border-color: #10b981; }
.stat-card.published .num { color: #047857; }
.stat-card.rejected { border-color: #ef4444; }
.stat-card.rejected .num { color: #b91c1c; }
.stat-card.scheduled { border-color: #3b82f6; }
.stat-card.scheduled .num { color: #1d4ed8; }

.filters {
  display: flex;
  gap: 8px;
  align-items: center;
}
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
</style>
