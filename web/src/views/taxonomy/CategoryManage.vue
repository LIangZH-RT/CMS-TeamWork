<script setup>
// 两级分类：创建、改名、改父级、启停、同级排序、逻辑删除（#20–#23、#38、#39）。
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createCategory, deleteCategory, listCategories, sortCategories, updateCategory, updateCategoryStatus } from '@/api/taxonomy'
import { explain } from '@/utils/errors'

const loading = ref(false)
const rows = ref([])
const dialog = reactive({ open: false, id: null, name: '', parent_id: null, submitting: false })

const roots = computed(() => rows.value.filter((c) => !c.parent_id))

async function load() {
  loading.value = true
  try {
    rows.value = await listCategories()
  } catch (e) {
    ElMessage.error(explain(e, '加载分类失败'))
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openCreate(parent) {
  Object.assign(dialog, { open: true, id: null, name: '', parent_id: parent?.id ?? null, submitting: false })
}
function openEdit(row) {
  Object.assign(dialog, { open: true, id: row.id, name: row.name, parent_id: row.parent_id, submitting: false })
}

async function submit() {
  const name = dialog.name.trim()
  if (!name) { ElMessage.warning('请填写分类名'); return }
  dialog.submitting = true
  try {
    if (dialog.id == null) await createCategory({ name, parent_id: dialog.parent_id, sort_order: 0 })
    else await updateCategory(dialog.id, { name, parent_id: dialog.parent_id })
    dialog.open = false
    ElMessage.success('已保存')
    await load()
  } catch (e) {
    ElMessage.error(explain(e))
  } finally {
    dialog.submitting = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`逻辑删除「${row.name}」？名称可以再次使用。被文章引用或仍有子分类时会失败。`, '删除分类', { type: 'warning' })
  } catch { return }
  try {
    await deleteCategory(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error(explain(e))
  }
}

async function onStatus(row) {
  const next = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
  try {
    await updateCategoryStatus(row.id, next)
    ElMessage.success(next === 'DISABLED' ? '已停用' : '已启用')
    await load()
  } catch (e) {
    ElMessage.error(explain(e))
  }
}

function siblingsOf(row) {
  if (!row.parent_id) return rows.value
  const parent = rows.value.find((c) => c.id === row.parent_id)
  return parent?.children || []
}

async function move(row, delta) {
  const siblings = siblingsOf(row).slice()
  const index = siblings.findIndex((c) => c.id === row.id)
  const next = index + delta
  if (next < 0 || next >= siblings.length) return
  const swapped = siblings.slice()
  const [item] = swapped.splice(index, 1)
  swapped.splice(next, 0, item)
  try {
    await sortCategories({
      parent_id: row.parent_id,
      items: swapped.map((c, i) => ({ id: c.id, sort_order: (i + 1) * 10 })),
    })
    await load()
  } catch (e) {
    ElMessage.error(explain(e))
  }
}
</script>

<template>
  <div>
    <div class="top">
      <p class="hint">分类最多两级。被未删除文章引用时不能改名、改父级或删除。排序和启停不受引用限制。删除是逻辑删除，没有回收站。</p>
      <el-button v-permission="'category:create'" type="primary" @click="openCreate(null)">新建一级分类</el-button>
    </div>
    <el-table :data="rows" v-loading="loading" row-key="id" :tree-props="{ children: 'children' }" default-expand-all>
      <el-table-column prop="name" label="名称" min-width="180" />
      <el-table-column prop="sort_order" label="排序" width="80" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" size="small">{{ row.status === 'ENABLED' ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="引用" width="100">
        <template #default="{ row }">
          <el-tag :type="row.in_use ? 'warning' : 'info'" size="small">{{ row.in_use ? '使用中' : '未使用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="360" fixed="right">
        <template #default="{ row }">
          <el-button v-if="!row.parent_id" v-permission="'category:create'" text size="small" @click="openCreate(row)">加子类</el-button>
          <el-button v-permission="'category:update'" text size="small" @click="openEdit(row)">编辑</el-button>
          <el-button v-permission="'category:update'" text size="small" @click="move(row, -1)">上移</el-button>
          <el-button v-permission="'category:update'" text size="small" @click="move(row, 1)">下移</el-button>
          <el-button v-permission="'category:update'" text size="small" @click="onStatus(row)">{{ row.status === 'ENABLED' ? '停用' : '启用' }}</el-button>
          <el-button v-permission="'category:delete'" text size="small" type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog.open" :title="dialog.id ? '编辑分类' : '新建分类'" width="420px">
      <el-form label-position="top">
        <el-form-item label="名称">
          <el-input v-model="dialog.name" maxlength="50" />
        </el-form-item>
        <el-form-item label="父分类">
          <el-select v-model="dialog.parent_id" clearable placeholder="不选则为一级分类" style="width: 100%">
            <el-option v-for="c in roots.filter((c) => c.id !== dialog.id)" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.open = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.hint { color: #6b7280; font-size: 13px; margin: 0; max-width: 720px; }
</style>
