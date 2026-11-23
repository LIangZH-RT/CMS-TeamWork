<script setup>
// 留痕页面（api-spec §8.1）。按 operated_at 正序展示，字段按 §4.13 AuditLog。
// 动作只有 §4.1 AuditAction 的 7 类；SYSTEM 操作人（AUTO_PUBLISH）显示为「系统」（BR-AUDIT-004）。
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getAuditLogs } from '@/api/audit'
import { fmtDateTime } from '@/utils/format'
import { AUDIT_ACTION_LABEL, REJECT_CATEGORY_LABEL } from '@/utils/status'

const route = useRoute()
const router = useRouter()
const articleId = route.params.id

const loading = ref(true)
const logs = ref([])

const ACTION_COLOR = {
  SUBMIT: '#f59e0b',
  APPROVE: '#10b981',
  REJECT: '#ef4444',
  UNPUBLISH: '#dc2626',
  WITHDRAW: '#6b7280',
  RESCHEDULE: '#3b82f6',
  AUTO_PUBLISH: '#059669',
}

function operatorText(op) {
  if (!op || op.type === 'SYSTEM') return '系统'
  return `${op.username} #${op.id}`
}

/** 只列出有值的字段（§4.13：未写入的字段为 null） */
function detailRows(log) {
  const rows = []
  if (log.reject_category) rows.push(['驳回类别', REJECT_CATEGORY_LABEL[log.reject_category] || log.reject_category])
  if (log.reason) rows.push([log.action === 'UNPUBLISH' ? '下架原因' : '驳回意见', log.reason])
  if (log.schedule_change) rows.push(['预定时间', `${fmtDateTime(log.schedule_change.from)} → ${fmtDateTime(log.schedule_change.to)}`])
  if (log.published_at) rows.push(['发布时间', fmtDateTime(log.published_at)])
  if (log.review_standard_version) rows.push(['审核标准', log.review_standard_version])
  if (log.related_submission_id != null) rows.push(['对应提交', `#${log.related_submission_id}`])
  if (log.related_approval_id != null) rows.push(['对应审核通过', `#${log.related_approval_id}`])
  return rows
}

async function load() {
  loading.value = true
  try {
    logs.value = await getAuditLogs(articleId) // http.js 已解包，直接是 AuditLog[]
  } catch (e) {
    ElMessage.error(e?.message || '加载留痕失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <div class="audit-logs" v-loading="loading">
    <div class="back">
      <el-button text @click="router.back()">← 返回</el-button>
    </div>

    <div class="timeline" v-if="logs.length">
      <div class="tl-item" v-for="(log, idx) in logs" :key="log.id">
        <div class="tl-dot" :style="{ background: ACTION_COLOR[log.action] || '#6b7280' }" />
        <div class="tl-content">
          <div class="tl-header">
            <span class="tl-action" :style="{ color: ACTION_COLOR[log.action] || '#6b7280' }">
              {{ AUDIT_ACTION_LABEL[log.action] || log.action }}
            </span>
            <span class="tl-operator">#{{ log.id }} · {{ operatorText(log.operator) }}</span>
            <span class="tl-time">{{ fmtDateTime(log.operated_at) }}</span>
          </div>
          <div v-if="detailRows(log).length" class="tl-detail">
            <div class="detail-kv" v-for="[k, v] in detailRows(log)" :key="k">
              <span class="k">{{ k }}</span>
              <span class="v">{{ v }}</span>
            </div>
          </div>
        </div>
        <div class="tl-connector" v-if="idx < logs.length - 1" />
      </div>
    </div>

    <el-empty v-else description="暂无留痕记录" />
  </div>
</template>

<style scoped>
.audit-logs .back { margin-bottom: 12px; }
.timeline {
  background: #fff;
  border-radius: 10px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.tl-item {
  position: relative;
  display: flex;
  gap: 16px;
  padding-bottom: 20px;
}
.tl-item:last-child { padding-bottom: 0; }
.tl-dot {
  width: 14px; height: 14px; border-radius: 50%;
  flex-shrink: 0; margin-top: 4px;
  box-shadow: 0 0 0 3px #fff, 0 0 0 4px rgba(0,0,0,0.06);
}
.tl-content { flex: 1; min-width: 0; }
.tl-header {
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
}
.tl-action { font-weight: 600; font-size: 14px; }
.tl-operator { font-size: 12px; color: #9ca3af; }
.tl-time { font-size: 12px; color: #6b7280; margin-left: auto; }
.tl-detail {
  margin-top: 8px;
  padding: 10px 14px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 13px;
}
.detail-kv { display: flex; gap: 8px; margin-bottom: 4px; }
.detail-kv:last-child { margin-bottom: 0; }
.k { color: #6b7280; min-width: 96px; }
.v { color: #1f2937; word-break: break-all; }
.tl-connector {
  position: absolute;
  left: 6px; top: 20px;
  width: 2px; height: calc(100% - 20px);
  background: #e5e7eb;
}
</style>
