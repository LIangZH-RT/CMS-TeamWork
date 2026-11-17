<script setup>
// 审核详情（api-spec §4.5 #15 / §4.12 #16-17）。
// 管理员**只读正文**，不能编辑内容（INV-03）。审核动作只有通过 / 驳回，都需要 submission_id。
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getArticleDetail, getReviewStandard, approveArticle, rejectArticle } from '@/api/admin'
import MarkdownView from '@/components/MarkdownView.vue'
import { fmtDateTime } from '@/utils/format'
import { STATUS_LABEL } from '@/utils/status'

const route = useRoute()
const router = useRouter()
const articleId = route.params.id

const loading = ref(true)
const article = ref(null)
const standard = ref(null) // review_standard
const rejectDialog = reactive({ open: false, category: '', comment: '', submitting: false })

async function load() {
  loading.value = true
  try {
    const [a, s] = await Promise.all([getArticleDetail(articleId), getReviewStandard()])
    article.value = a  // http.js 已解包，直接是接口 data 字段
    standard.value = s
  } catch (e) {
    if (e?.code === 40400) {
      ElMessage.error('文章不存在或已被处理')
      router.replace({ name: 'admin-reviews' })
    } else {
      ElMessage.error(e?.message || '加载失败')
    }
  } finally {
    loading.value = false
  }
}
onMounted(load)

/** 只有 PENDING_REVIEW 才能审核（状态闸） */
const canReview = computed(() => article.value?.status === 'PENDING_REVIEW')

async function doApprove() {
  try {
    await ElMessageBox.confirm(
      `通过「${article.value.title}」的第 ${article.value.submission_round || 1} 轮审核？`,
      '审核通过确认',
      { type: 'success', confirmButtonText: '通过' }
    )
  } catch { return }
  try {
    await approveArticle(articleId, { submission_id: article.value.current_submission_id })
    ElMessage.success('已通过，文章将进入发布队列')
    router.push({ name: 'admin-reviews' })
  } catch (e) {
    if (e?.code === 40901) ElMessage.error(e?.message || '文章状态已变更')
    else ElMessage.error(e?.message || '操作失败')
  }
}

function openReject() {
  rejectDialog.open = true
  rejectDialog.category = ''
  rejectDialog.comment = ''
}
async function doReject() {
  if (!rejectDialog.category) { ElMessage.warning('请选择驳回类别'); return }
  rejectDialog.submitting = true
  try {
    await rejectArticle(articleId, {
      submission_id: article.value.current_submission_id,
      reject_category: rejectDialog.category,
      comment: rejectDialog.comment.trim(),
    })
    ElMessage.success('已驳回')
    rejectDialog.open = false
    router.push({ name: 'admin-reviews' })
  } catch (e) {
    if (e?.code === 40901) ElMessage.error(e?.message || '文章状态已变更')
    else ElMessage.error(e?.message || '操作失败')
  } finally {
    rejectDialog.submitting = false
  }
}
</script>

<template>
  <div class="review-detail" v-loading="loading">
    <div class="back">
      <el-button text @click="router.push({ name: 'admin-reviews' })">← 返回审核队列</el-button>
    </div>

    <template v-if="article && standard">
      <div class="header card">
        <div class="title-row">
          <h2 class="title">{{ article.title }}</h2>
          <el-tag v-if="article.status !== 'PENDING_REVIEW'" type="danger">当前状态：{{ STATUS_LABEL[article.status] }}</el-tag>
        </div>
        <div class="meta">
          <span>作者：<b>{{ article.author.username }}</b></span>
          <span>· 分类：<b>{{ article.category.name }}</b></span>
          <span v-if="article.tags.length">· 标签：
            <el-tag v-for="t in article.tags" :key="t.id" size="small" style="margin-right: 4px">{{ t.name }}</el-tag>
          </span>
          <span>· 第 {{ article.submission_round || 1 }} 轮</span>
          <span v-if="article.submitted_at">· 提交时间：{{ fmtDateTime(article.submitted_at) }}</span>
        </div>
        <p v-if="article.excerpt" class="excerpt">{{ article.excerpt }}</p>
      </div>

      <div class="action-bar card" v-if="canReview">
        <div class="action-hint">
          <el-icon><InfoFilled /></el-icon>
          <span>文章正文只读，不能编辑。审核通过后自动进入发布流程。</span>
        </div>
        <div class="action-buttons">
          <el-button type="danger" @click="openReject">驳回</el-button>
          <el-button type="success" @click="doApprove">审核通过</el-button>
        </div>
      </div>

      <div class="content card">
        <div class="content-title">文章正文</div>
        <MarkdownView :content="article.content" />
      </div>

      <el-dialog
        v-model="rejectDialog.open"
        title="驳回审核"
        width="500px"
        :close-on-click-modal="false"
      >
        <el-form label-width="90px">
          <el-form-item label="驳回类别" required>
            <el-select v-model="rejectDialog.category" placeholder="请选择" style="width: 100%">
              <el-option
                v-for="c in standard.categories"
                :key="c.code"
                :label="c.name"
                :value="c.code"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="说明">
            <el-input
              v-model="rejectDialog.comment"
              type="textarea"
              :rows="4"
              placeholder="给编辑的反馈（可选）"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="rejectDialog.open = false">取消</el-button>
          <el-button type="danger" :loading="rejectDialog.submitting" @click="doReject">确认驳回</el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<style scoped>
.review-detail .back { margin-bottom: 12px; }
.card {
  background: #fff;
  border-radius: 10px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  margin-bottom: 16px;
}
.title-row { display: flex; align-items: center; gap: 12px; }
.title { font-size: 20px; font-weight: 700; margin: 0; color: #111827; }
.meta { font-size: 13px; color: #6b7280; margin-top: 10px; }
.meta span { margin-right: 12px; }
.excerpt {
  font-size: 14px;
  color: #374151;
  margin: 12px 0 0;
  padding: 10px 14px;
  background: #f9fafb;
  border-left: 3px solid #d1d5db;
  border-radius: 4px;
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fffbeb;
  border-color: #fcd34d;
  border: 1px solid #fcd34d;
}
.action-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #92400e;
}
.action-buttons { display: flex; gap: 10px; }

.content-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.content :deep(.markdown-body) { font-size: 14px; }
</style>
