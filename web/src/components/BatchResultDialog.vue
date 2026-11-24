<script setup>
import { ERROR_TEXT } from '@/utils/errors'

defineProps({
  modelValue: { type: Boolean, default: false },
  result: { type: Object, default: null },
})
defineEmits(['update:modelValue'])

function text(row) {
  if (row.success) return '成功'
  return ERROR_TEXT[row.code] || row.message || '失败'
}
</script>

<template>
  <el-dialog :model-value="modelValue" title="批量处理结果" width="640px" @update:model-value="$emit('update:modelValue', $event)">
    <template v-if="result">
      <p class="sum">共 {{ result.total }} 条，成功 {{ result.succeeded }} 条，失败 {{ result.failed }} 条。每条单独处理，一条失败不影响其他条。</p>
      <el-table :data="result.results" size="small" max-height="360">
        <el-table-column prop="id" label="文章编号" width="120" />
        <el-table-column label="结果" width="90">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">{{ row.success ? '成功' : '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="错误码" width="100" />
        <el-table-column label="说明" min-width="220">
          <template #default="{ row }">{{ text(row) }}</template>
        </el-table-column>
      </el-table>
    </template>
  </el-dialog>
</template>

<style scoped>
.sum { margin: 0 0 12px; color: #374151; }
</style>
