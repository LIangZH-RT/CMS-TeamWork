<script setup>
// 标签管理（api-spec §4.18）。支持关键字搜索 + 分页。
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { listTags, createTag, renameTag, deleteTag } from '@/api/admin'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ keyword: '', page: 1, page_size: 10 })
const dialog = ref({ open: false, mode: 'create', id: null, name: '', submitting: false })

async function load() {
  loading.value = true
  try {
    const res = await listTags(query)
    rows.value = res.items
    total.value = res.total
  } catch (e) {
    ElMessage.error(e?.message || '加载标签失败')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function onSearch() { query.page = 1; load() }

function openCreate() {
  dialog.value = { open: true, mode: 'create', id: null, name: '', submitting: false }
}
function openRename(r) {
  dialog.value = { open: true, mode: 'rename', id: r.id, name: r.name, submitting: false }
}

async function submit() {
  const name = dialog.value.name.trim()
  if (!name) { ElMessage.warning('标签名不能是空的'); return }
  dialog.value.submitting = true
  try {
    if (dialog.value.mode === 'create') await createTag({ name })
    else await renameTag(dialog.value.id, { name })
    ElMessage.success('已保存')
    dialog.value.open = false
    await load()
  } catch (e) {
    if (e?.code === 40906) ElMessage.error('标签名已存在')
    else if (e?.code === 40904) { ElMessage.error('标签已被文章引用，不能改名，请新建标签'); dialog.value.open = false; await load() }
    else ElMessage.error(e?.message || '操作失败')
  } finally {
    dialog.value.submitting = false
  }
}

async function onDelete(r) {
  if (r.in_use) {
    ElNotification({
      type: 'warning',
      title: '标签被引用',
      message: '该标签仍有文章使用，请先处理完再删除。',
    })
    return
  }
  try {
    await ElMessageBox.confirm(`确定删除标签「${r.name}」？`, '删除确认', { type: 'warning' })
  } catch { return }
  try {
    await deleteTag(r.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    if (e?.code === 40904) ElMessage.error(e?.message || '标签被文章引用，无法删除')
    else ElMessage.error(e?.message || '删除失败')
  }
}
</script>

<template>
  <div class="tag-manage">
    <div class="topbar">
      <div class="search">
        <el-input v-model="query.keyword" placeholder="按名称搜索" clearable @keyup.enter="onSearch" style="width: 240px" />
        <el-button @click="onSearch">搜索</el-button>
      </div>
      <el-button type="primary" @click="openCreate">+ 新建标签</el-button>
    </div>

    <el-table :data="rows" v-loading="loading" stripe style="margin-top: 16px">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="标签名" min-width="200" />
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
            :title="row.in_use ? '被引用，不能改名，请新建标签' : ''"
            @click="openRename(row)"
          >改名</el-button>
          <el-button text size="small" type="danger" :disabled="row.in_use" @click="onDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialog.open" :title="dialog.mode === 'create' ? '新建标签' : '改名'" width="400px" :close-on-click-modal="false">
      <el-input v-model="dialog.name" placeholder="标签名" maxlength="50" show-word-limit @keyup.enter="submit" />
      <template #footer>
        <el-button @click="dialog.open = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.tag-manage .topbar { display: flex; align-items: center; justify-content: space-between; }
.search { display: flex; gap: 8px; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
