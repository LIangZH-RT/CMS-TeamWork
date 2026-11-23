<script setup>
// 编辑页只给归属编辑。审核页不得引用本组件（BR-007、architecture §3.3）。
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { createArticle, getArticleDetail, updateArticle } from '@/api/article'
import { uploadMedia } from '@/api/media'
import { listCategories } from '@/api/taxonomy'
import { listTags } from '@/api/taxonomy'
import { isNotFound } from '@/api/http'
import { explain } from '@/utils/errors'

const route = useRoute()
const router = useRouter()
const isNew = computed(() => route.name === 'admin-article-new')
const saving = ref(false)
const loading = ref(false)
const categories = ref([])
const tags = ref([])
const form = reactive({
  title: '',
  excerpt: '',
  content: '',
  category_id: null,
  tag_ids: [],
  scheduled_publish_time: '',
  cover_media_id: null,
  audio_media_id: null,
  expected_version: 0,
})

function flatCategories(nodes, depth = 0, out = []) {
  for (const n of nodes || []) {
    out.push({ id: n.id, name: `${depth ? '└ ' : ''}${n.name}`, disabled: n.status === 'DISABLED' })
    if (depth === 0) flatCategories(n.children, 1, out)
  }
  return out
}
const categoryOptions = computed(() => flatCategories(categories.value))

function withOffset(value) {
  if (!value) return null
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) return value
  return value.length === 16 ? `${value}:00+08:00` : `${value}+08:00`
}

async function loadTaxonomy() {
  const [cats, tagPage] = await Promise.all([
    listCategories({ status: 'ENABLED' }),
    listTags({ page: 1, page_size: 100, sort: 'name,asc' }),
  ])
  categories.value = cats
  tags.value = tagPage.items
}

async function loadArticle() {
  if (isNew.value) return
  loading.value = true
  try {
    const a = await getArticleDetail(route.params.id)
    if (!a.allowed_actions?.includes('EDIT')) {
      ElMessage.warning('当前状态不能编辑')
      router.replace({ name: 'admin-my-article', params: { id: a.id } })
      return
    }
    form.title = a.title
    form.excerpt = a.excerpt || ''
    form.content = a.content || ''
    form.category_id = a.category?.id ?? null
    form.tag_ids = (a.tags || []).map((t) => t.id)
    form.scheduled_publish_time = a.scheduled_publish_time ? a.scheduled_publish_time.slice(0, 16) : ''
    form.cover_media_id = a.cover?.media_id ?? null
    form.audio_media_id = a.audio?.media_id ?? null
    form.expected_version = a.version ?? 0
  } catch (e) {
    if (isNotFound(e)) router.replace({ name: 'not-found', params: { pathMatch: route.path.slice(1).split('/') } })
    else ElMessage.error(explain(e, '加载失败'))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try { await loadTaxonomy() } catch (e) { ElMessage.error(explain(e, '分类加载失败')) }
  await loadArticle()
})

function payload() {
  return {
    title: form.title,
    content: form.content,
    excerpt: form.excerpt,
    category_id: form.category_id,
    tag_ids: form.tag_ids,
    scheduled_publish_time: withOffset(form.scheduled_publish_time),
    cover_media_id: form.cover_media_id,
    audio_media_id: form.audio_media_id,
    expected_version: form.expected_version,
  }
}

async function onVersionConflict() {
  await ElMessageBox.alert(
    '这篇文章已在另一处保存，你这次的修改没有写入。请刷新页面，基于最新版本重新修改。',
    '版本冲突（40907）',
    { type: 'warning', confirmButtonText: '刷新' },
  )
  await loadArticle()
}

async function save() {
  if (!form.title.trim() || !form.content.trim() || !form.category_id) {
    ElMessage.warning('请填写标题、正文并选择分类')
    return
  }
  saving.value = true
  try {
    if (isNew.value) {
      const { expected_version, cover_media_id, audio_media_id, ...createBody } = payload()
      void expected_version
      void cover_media_id
      void audio_media_id
      const created = await createArticle(createBody)
      ElMessage.success('草稿已创建')
      router.replace({ name: 'admin-article-edit', params: { id: created.id } })
      return
    }
    const updated = await updateArticle(route.params.id, payload())
    form.expected_version = updated.version
    ElMessage.success('已保存')
  } catch (e) {
    if (e?.code === 40907) await onVersionConflict()
    else ElMessage.error(explain(e))
  } finally {
    saving.value = false
  }
}

async function onUploadImg(files, callback) {
  if (isNew.value) {
    ElMessage.warning('请先保存草稿，再插入图片')
    callback([])
    return
  }
  const urls = []
  for (const file of files) {
    try {
      const media = await uploadMedia(route.params.id, file, 'INLINE_IMAGE')
      urls.push(media.url)
    } catch (e) {
      ElMessage.error(explain(e, '图片上传失败'))
    }
  }
  callback(urls)
}

async function uploadBound(file, usage, field) {
  if (isNew.value) {
    ElMessage.warning('请先保存草稿，再上传封面或音频')
    return
  }
  try {
    const media = await uploadMedia(route.params.id, file, usage)
    form[field] = media.media_id
    ElMessage.success('已上传，保存文章后才会关联')
  } catch (e) {
    ElMessage.error(explain(e, '上传失败'))
  }
}
</script>

<template>
  <div v-loading="loading">
    <div class="bar">
      <el-button text @click="router.back()">← 返回</el-button>
      <span v-if="!isNew" class="ver">当前版本 {{ form.expected_version }}。保存时会带上 expected_version，若别人已保存会提示冲突。</span>
      <div class="grow" />
      <el-button type="primary" :loading="saving" @click="save">{{ isNew ? '创建草稿' : '保存' }}</el-button>
    </div>
    <el-form label-position="top">
      <el-form-item label="标题">
        <el-input v-model="form.title" maxlength="200" show-word-limit />
      </el-form-item>
      <el-form-item label="摘要">
        <el-input v-model="form.excerpt" type="textarea" :rows="2" maxlength="500" show-word-limit />
      </el-form-item>
      <div class="grid">
        <el-form-item label="分类（最多两级，停用的不可选）">
          <el-select v-model="form.category_id" placeholder="选择分类" style="width: 100%">
            <el-option v-for="c in categoryOptions" :key="c.id" :label="c.name" :value="c.id" :disabled="c.disabled" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="form.tag_ids" multiple filterable placeholder="可多选" style="width: 100%">
            <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="预定发布时间（可选，保存时不要求晚于现在）">
        <el-date-picker v-model="form.scheduled_publish_time" type="datetime" value-format="YYYY-MM-DDTHH:mm" placeholder="不预定则审核通过后立即发布" />
      </el-form-item>
      <div class="grid">
        <el-form-item label="封面">
          <el-upload :show-file-list="false" accept=".jpg,.jpeg,.png,.gif,.webp" :http-request="({ file }) => uploadBound(file, 'COVER', 'cover_media_id')">
            <el-button>上传封面</el-button>
          </el-upload>
          <span v-if="form.cover_media_id" class="id">媒体 {{ form.cover_media_id }}</span>
          <el-button v-if="form.cover_media_id" text type="danger" @click="form.cover_media_id = null">移除</el-button>
        </el-form-item>
        <el-form-item label="音频">
          <el-upload :show-file-list="false" accept=".mp3,.m4a,.wav,.ogg" :http-request="({ file }) => uploadBound(file, 'AUDIO', 'audio_media_id')">
            <el-button>上传音频</el-button>
          </el-upload>
          <span v-if="form.audio_media_id" class="id">媒体 {{ form.audio_media_id }}</span>
          <el-button v-if="form.audio_media_id" text type="danger" @click="form.audio_media_id = null">移除</el-button>
        </el-form-item>
      </div>
      <el-form-item label="正文（Markdown 原文，不保存 HTML）">
        <MdEditor v-model="form.content" language="zh-CN" style="height: 480px" @onUploadImg="onUploadImg" />
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.grow { flex: 1; }
.ver { color: #6b7280; font-size: 13px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.id { margin-left: 8px; color: #6b7280; font-size: 13px; }
@media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
</style>
