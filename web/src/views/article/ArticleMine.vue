<script setup>
// 编辑视角的文章详情。只读正文用 MarkdownView，编辑控件只在 ArticleEdit 里。
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteArticle, getArticleDetail, rescheduleArticle, submitArticle, withdrawArticle } from '@/api/article'
import { isNotFound } from '@/api/http'
import MarkdownView from '@/components/MarkdownView.vue'
import { explain } from '@/utils/errors'
import { fmtDateTime } from '@/utils/format'
import { REJECT_CATEGORY_LABEL, STATUS_LABEL, STATUS_TAG_TYPE } from '@/utils/status'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const missing = ref(false)
const article = ref(null)

async function load(id) {
  loading.value = true
  missing.value = false
  try {
    article.value = await getArticleDetail(id)
  } catch (e) {
    if (isNotFound(e)) missing.value = true
    else ElMessage.error(explain(e, '加载失败'))
  } finally {
    loading.value = false
  }
}

watch(() => route.params.id, (id) => id && load(id), { immediate: true })

function has(action) {
  return article.value?.allowed_actions?.includes(action)
}

async function onSubmit() {
  try {
    await submitArticle(article.value.id)
    ElMessage.success('已提交审核')
    await load(article.value.id)
  } catch (e) {
    ElMessage.error(explain(e))
  }
}

async function onWithdraw() {
  try {
    await ElMessageBox.confirm('撤回后审核结论作废，文章回到草稿，需要重新审核。', '撤回待发布', { type: 'warning' })
  } catch { return }
  try {
    await withdrawArticle(article.value.id)
    ElMessage.success('已撤回')
    await load(article.value.id)
  } catch (e) {
    ElMessage.error(explain(e))
  }
}

async function onReschedule() {
  try {
    const { value } = await ElMessageBox.prompt('新的预定发布时间，须晚于当前时间，并带时区。示例：2026-12-20T09:00:00+08:00', '改期', {
      inputValue: article.value.scheduled_publish_time || '',
    })
    await rescheduleArticle(article.value.id, {
      scheduled_publish_time: value.trim(),
      expected_scheduled_publish_time: article.value.scheduled_publish_time,
    })
    ElMessage.success('已改期')
    await load(article.value.id)
  } catch (e) {
    if (e === 'cancel') return
    ElMessage.error(explain(e))
  }
}

async function onDelete() {
  try {
    await ElMessageBox.confirm('逻辑删除后文章从所有列表消失，本期不能恢复。', '删除草稿', { type: 'warning' })
  } catch { return }
  try {
    await deleteArticle(article.value.id)
    ElMessage.success('已删除')
    router.replace({ name: 'admin-my-articles' })
  } catch (e) {
    ElMessage.error(explain(e))
  }
}
</script>

<template>
  <div v-loading="loading">
    <el-result v-if="missing" icon="warning" title="资源不存在" sub-title="文章不存在，或你无权查看。">
      <template #extra>
        <el-button @click="router.push({ name: 'admin-my-articles' })">返回我的文章</el-button>
      </template>
    </el-result>
    <template v-else-if="article">
      <div class="bar">
        <el-button text @click="router.push({ name: 'admin-my-articles' })">← 返回</el-button>
        <el-tag :type="STATUS_TAG_TYPE[article.status]">{{ STATUS_LABEL[article.status] }}</el-tag>
        <span class="ver">版本 {{ article.version }}</span>
        <div class="grow" />
        <el-button v-if="has('EDIT')" v-permission="'article:update'" @click="router.push({ name: 'admin-article-edit', params: { id: article.id } })">编辑</el-button>
        <el-button v-if="has('SUBMIT')" v-permission="'article:submit'" type="primary" @click="onSubmit">提交审核</el-button>
        <el-button v-if="has('WITHDRAW')" v-permission="'article:withdraw'" @click="onWithdraw">撤回</el-button>
        <el-button v-if="has('RESCHEDULE')" v-permission="'article:reschedule'" @click="onReschedule">改期</el-button>
        <el-button v-if="has('DELETE')" v-permission="'article:delete'" type="danger" plain @click="onDelete">删除</el-button>
        <el-button v-permission="'audit:read'" text @click="router.push({ name: 'admin-audit-logs', params: { id: article.id } })">留痕</el-button>
      </div>

      <el-alert v-if="article.status === 'REJECTED' && article.latest_rejection" type="error" show-icon :closable="false" class="banner"
        :title="`驳回 · ${REJECT_CATEGORY_LABEL[article.latest_rejection.reject_category] || ''}`"
        :description="`${article.latest_rejection.comment}（${fmtDateTime(article.latest_rejection.operated_at)}）`" />
      <el-alert v-if="article.status === 'UNPUBLISHED' && article.latest_unpublish" type="warning" show-icon :closable="false" class="banner"
        title="已下架"
        :description="`${article.latest_unpublish.reason}（${fmtDateTime(article.latest_unpublish.operated_at)}）`" />

      <h1>{{ article.title }}</h1>
      <p class="meta">{{ article.category?.name }} · 更新于 {{ fmtDateTime(article.updated_at) }}
        <template v-if="article.scheduled_publish_time"> · 预定 {{ fmtDateTime(article.scheduled_publish_time) }}</template>
      </p>
      <p v-if="article.excerpt" class="excerpt">{{ article.excerpt }}</p>
      <img v-if="article.cover?.url" :src="article.cover.url" alt="" class="cover" />
      <audio v-if="article.audio?.url" controls :src="article.audio.url" />
      <a v-if="article.audio?.url" class="dl" :href="`${article.audio.url}/download`">下载音频</a>
      <MarkdownView :content="article.content" id="mine-article" />
    </template>
  </div>
</template>

<style scoped>
.bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.grow { flex: 1; }
.ver { color: #6b7280; font-size: 13px; }
.banner { margin-bottom: 12px; }
h1 { margin: 0 0 8px; font-size: 26px; }
.meta, .excerpt { color: #6b7280; }
.cover { max-width: 100%; border-radius: 12px; margin: 12px 0; }
.dl { margin-left: 12px; color: #1e40af; }
</style>
