<script setup>
// 只读 Markdown 渲染（博客前台；F 的预览、G 的审核页可复用）。
// 不含任何编辑控件，不得改成可写组件（architecture §3.3、BR-007）。
// 渲染安全规则见 utils/markdown.js；这里只处理媒体加载失败的展示。
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({
  content: { type: String, default: '' },
  id: { type: String, default: 'md-view' },
})

const root = ref(null)

// 媒体出口拒绝一律 404：图片失效时换成占位文字，不抛内部错误
function onMediaError(e) {
  const el = e.target
  if (el instanceof HTMLImageElement) {
    const ph = document.createElement('span')
    ph.className = 'md-blocked'
    ph.textContent = `［图片暂不可用${el.alt ? `：${el.alt}` : ''}］`
    el.replaceWith(ph)
  } else if (el instanceof HTMLVideoElement) {
    el.closest('.md-video')?.classList.add('is-broken')
  }
}

onMounted(() => root.value?.addEventListener('error', onMediaError, true))
onBeforeUnmount(() => root.value?.removeEventListener('error', onMediaError, true))
</script>

<template>
  <div ref="root" class="md-view">
    <MdPreview
      :id="id"
      :model-value="content"
      preview-theme="default"
      code-theme="github"
      language="zh-CN"
      no-mermaid
      no-katex
      no-echarts
      no-img-zoom-in
      :show-code-row-number="false"
    />
  </div>
</template>

<style scoped>
.md-view :deep(.md-editor),
.md-view :deep(.md-editor-previewOnly) { background: transparent; }
.md-view :deep(.md-editor-preview-wrapper) { padding: 0; }
.md-view :deep(.md-editor-preview) { font-size: 17px; line-height: 1.9; color: #2b2f33; font-family: var(--sans); }
.md-view :deep(.md-editor-preview h2) { font-family: var(--serif); font-size: 24px; border: 0; margin-top: 1.8em; }
.md-view :deep(.md-editor-preview blockquote) { border-left: 3px solid var(--accent); background: var(--accent-soft); color: #7c2d12; border-radius: 0 10px 10px 0; padding: 12px 18px; }
.md-view :deep(.md-editor-preview img) { border-radius: 12px; max-width: 100%; }
.md-view :deep(.md-editor-preview code) { font-size: 14px; }
.md-view :deep(.md-blocked) { display: inline-block; color: var(--muted); background: #f3efe7; border-radius: 6px; padding: 0 8px; font-size: 14px; }
.md-view :deep(.md-video) { display: block; margin: 12px 0 4px; }
.md-view :deep(.md-video video) { display: block; width: 100%; max-height: 480px; background: #111; border-radius: 12px; }
.md-view :deep(.md-video-link) { display: inline-block; margin-top: 6px; font-size: 13px; color: var(--muted); }
.md-view :deep(.md-video.is-broken video) { display: none; }
.md-view :deep(.md-video.is-broken .md-video-link)::before { content: '视频暂不可播放，'; }
</style>
