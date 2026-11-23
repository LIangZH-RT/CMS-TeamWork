<script setup>
// 分类管理（api-spec §4.17）。G 负责。
// 校验策略：长度/空白前端只做最小防御（去首尾空白、非空），真正的重名/引用校验让后端返回 409。
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { listCategories, createCategory, renameCategory, deleteCategory } from '@/api/taxonomy'

const loading = ref(false)
const rows = ref([])
const dialog = ref({ open: false, mode: 'create', id: null, name: '', submitting: false })

async function load() {
  loading.value = true
  try {
    const res = await listCategories()
    rows.value = res // { id, name, in_use }
  } catch (e) {
    ElMessage.error(e?.message || '加载分类失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openCreate() {
  dialog.value = { open: true, mode: 'create', id: null, name: '', submitting: false }
}
function openRename(r) {
  dialog.value = { open: true, mode: 'rename', id: r.id, name: r.name, submitting: false }
}

async function submit() {
  const name = dialog.value.name.trim()
  if (!name) {
    ElMessage.warning('分类名不能是空的')
    return
  }
  dialog.value.submitting = true
  try {
    if (dialog.value.mode === 'create') {
      await createCategory({ name })
      ElMessage.success('已创建')
    } else {
      await renameCategory(dialog.value.id, { name })
      ElMessage.success('已更新')
    }
    dialog.value.open = false
    await load()
  } catch (e) {
    const code = e?.code
    if (code === 40906) ElMessage.error('分类名已存在')
    else if (code === 40904) { ElMessage.error('分类已被文章引用，不能改名，请新建分类'); dialog.value.open = false; await load() }
    else ElMessage.error(e?.message || '操作失败')
  } finally {
    dialog.value.submitting = false
  }
}

async function onDelete(r) {
  if (r.in_use) {
    ElNotification({
      type: 'warning',
      title: '分类被引用',
      message: '该分类下还有文章，请先处理完再删除。',
    })
    return
  }
  try {
    await ElMessageBox.confirm(`确定删除分类「${r.name}」？`, '删除确认', { type: 'warning' })
  } catch { return }
  try {
    await deleteCategory(r.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    const code = e?.code
    if (code === 40904) ElMessage.error(e?.message || '分类下还有文章，无法删除')
    else ElMessage.error(e?.message || '删除失败')
  }
}
</script>

<template>
  <div class="category-manage">
    <div class="topbar">
      <div class="tip">
        分类名去首尾空白后同类内不区分大小写去重（api-spec §16-2）。被文章引用的分类不能改名或删除（BR-TAX-004）。
      </div>
      <el-button type="primary" @click="openCreate">+ 新建分类</el-button>
    </div>

    <el-table :data="rows" v-loading="loading" stripe style="margin-top: 16px">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="分类名" min-width="200" />
      <el-table-column label="被引用" width="120">
        <template #default="{ row }">
          <el-tag :type="row.in_use ? 'danger' : 'info'" size="small">
            {{ row.in_use ? '使用中' : '未使用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button
            text
            size="small"
            :disabled="row.in_use"
            :title="row.in_use ? '被引用，不能改名，请新建分类' : ''"
            @click="openRename(row)"
          >改名</el-button>
          <el-button text size="small" type="danger" :disabled="row.in_use" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialog.open"
      :title="dialog.mode === 'create' ? '新建分类' : '改名'"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-input
        v-model="dialog.name"
        placeholder="分类名"
        maxlength="50"
        show-word-limit
        @keyup.enter="submit"
      />
      <template #footer>
        <el-button @click="dialog.open = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.category-manage .topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tip {
  font-size: 13px;
  color: #6b7280;
}
</style>
