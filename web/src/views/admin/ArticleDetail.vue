<script setup>
// 管理员视角文章详情。只读正文，可下架（只有 PUBLISHED 状态允许）。
// 审核动作（通过/驳回）走审核详情页 ReviewDetail。
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getArticleDetail, unpublishArticle } from '@/api/admin'
import MarkdownView from '@/components/MarkdownView.vue'
import { fmtDateTime } from '@/utils/format'
import { ARTICLE_STATUS, STATUS_LABEL, STATUS_TAG_TYPE } from '@/utils/status'

const route = useRoute()
const router = useRouter()
const articleId = route.params.id

const loading = ref(true)
const article = ref(null)

async function load() {
  loading.value = true
  try {
    const res = await getArticleDetail(articleId)
    article.value = res  // http.js 已解包
  } catch (e) {
    if (e?.code === 40400) {
      ElMessage.error('文章不存在')
      router.replace({ name: 'admin-articles' })
    } else {
      ElMessage.error(e?.message || '加载失败')
    }
  } finally {
    loading.value = false
  }
}
onMounted(load)

const canUnpublish = computed(() => article.value?.status === ARTICLE_STATUS.PUBLISHED)

async function onUnpublish() {
  try {
    const { value } = await ElMessageBox.prompt(
      '请填写下架原因',
      '下架确认',
      {
        confirmButtonText: '确认下架',
        cancelButtonText: '取消',
        inputPattern: /\S+/,
        inputErrorMessage: '下架原因不能为空',
        inputPlaceholder: '例如：涉及敏感信息 / 临时维护',
        type: 'warning',
      }
    )
    await unpublishArticle(articleId, { reason: value.trim() })
    ElMessage.success('已下架')
    await load()
  } catch (e) {
    if (e === 'cancel') return
    if (e?.code === 40900) {
      ElMessage.error('文章状态已变更，无法下架')
      await load()
    } else ElMessage.error(e?.message || '下架失败')
  }
}

function goAudit() {
  router.push({ name: 'admin-audit-logs', params: { id: articleId } })
}
</script>

<template>
  <div class="article-detail" v-loading="loading">
    <div class="back">
      <el-button text @click="router.push({ name: 'admin-articles' })">← 返回全部文章</el-button>
      <el-button text @click="goAudit">查看留痕</el-button>
    </div>

    <template v-if="article">
      <div class="header card">
        <div class="title-row">
          <h2 class="title">{{ article.title }}</h2>
          <el-tag :type="STATUS_TAG_TYPE[article.status]">{{ STATUS_LABEL[article.status] }}</el-tag>
        </div>
        <div class="meta">
          <span>作者：<b>{{ article.author.username }}</b></span>
          <span>· 分类：<b>{{ article.category.name }}</b></span>
          <span v-if="article.tags.length">· 标签：
            <el-tag v-for="t in article.tags" :key="t.id" size="small" style="margin-right: 4px">{{ t.name }}</el-tag>
          </span>
          <span v-if="article.published_at">· 发布时间：{{ fmtDateTime(article.published_at) }}</span>
          <span v-if="article.created_at">· 创建：{{ fmtDateTime(article.created_at) }}</span>
          <span v-if="article.updated_at">· 更新：{{ fmtDateTime(article.updated_at) }}</span>
        </div>
        <p v-if="article.excerpt" class="excerpt">{{ article.excerpt }}</p>
        <div class="action-row" v-if="canUnpublish">
          <el-button type="danger" @click="onUnpublish">下架</el-button>
        </div>
        <div v-if="article.status === ARTICLE_STATUS.PENDING_REVIEW" class="pending-hint">
          <span class="hint-icon" aria-hidden="true">ⓘ</span>
          <span>此文章正在审核中，请前往审核详情页处理。</span>
          <el-button type="primary" size="small" link @click="router.push({ name: 'admin-review-detail', params: { id: article.id } })">去审核 →</el-button>
        </div>
      </div>

      <div class="content card">
        <div class="content-title">文章正文</div>
        <MarkdownView :content="article.content" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.article-detail .back { margin-bottom: 12px; display: flex; gap: 12px; }
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
  font-size: 14px; color: #374151; margin: 12px 0 0;
  padding: 10px 14px; background: #f9fafb;
  border-left: 3px solid #d1d5db; border-radius: 4px;
}
.action-row { margin-top: 14px; }
.pending-hint {
  margin-top: 14px;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; background: #fffbeb; border-radius: 6px;
  font-size: 13px; color: #92400e;
}
.content-title {
  font-size: 14px; font-weight: 600; color: #374151;
  margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;
}
.hint-icon { font-size: 15px; line-height: 1; }
</style>
