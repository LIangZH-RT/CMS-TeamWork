<script setup>
// 留痕页面（api-spec #19）。按 operated_at 正序展示。
// admin_handlers 追加的 auditLogs 包含 CREATE / EDIT / SUBMIT / REJECT / APPROVE / UNPUBLISH 六种动作。
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getAuditLogs } from '@/api/admin'
import { fmtDateTime } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const articleId = route.params.id

const loading = ref(true)
const logs = ref([])

const ACTION_META = {
  CREATE:       { label: '创建',       color: '#6b7280', icon: 'Edit' },
  EDIT:         { label: '编辑',       color: '#3b82f6', icon: 'Edit' },
  SUBMIT:       { label: '提交审核',   color: '#f59e0b', icon: 'Document' },
  REJECT:       { label: '驳回',       color: '#ef4444', icon: 'Warning' },
  APPROVE:      { label: '审核通过',   color: '#10b981', icon: 'CircleCheck' },
  UNPUBLISH:    { label: '下架',       color: '#dc2626', icon: 'Download' },
}

async function load() {
  loading.value = true
  try {
    const res = await getAuditLogs(articleId)
    logs.value = res.data
  } catch (e) {
    ElMessage.error(e?.data?.message || '加载留痕失败')
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
        <div class="tl-dot" :style="{ background: ACTION_META[log.action]?.color || '#6b7280' }" />
        <div class="tl-content">
          <div class="tl-header">
            <span class="tl-action" :style="{ color: ACTION_META[log.action]?.color || '#6b7280' }">
              {{ ACTION_META[log.action]?.label || log.action }}
            </span>
            <span class="tl-operator">
              by {{ log.operator_role === 'ADMIN' ? '管理员' : '编辑' }} #{{ log.operator_id }}
            </span>
            <span class="tl-time">{{ fmtDateTime(log.operated_at) }}</span>
          </div>
          <div v-if="Object.keys(log.detail).length" class="tl-detail">
            <div class="detail-kv" v-for="(v, k) in log.detail" :key="k">
              <span class="k">{{ k }}</span>
              <span class="v">{{ typeof v === 'object' ? JSON.stringify(v) : v }}</span>
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
.k { color: #6b7280; font-family: monospace; min-width: 120px; }
.v { color: #1f2937; word-break: break-all; }
.tl-connector {
  position: absolute;
  left: 6px; top: 20px;
  width: 2px; height: calc(100% - 20px);
  background: #e5e7eb;
}
</style>
