// md-editor-v3 全局配置：本地 highlight.js（不走 CDN），挂上前台安全渲染插件。
// 全应用只调用一次（main.js）。F 的编辑器预览也会套用同一套渲染规则。
import { config } from 'md-editor-v3'
import hljs from 'highlight.js/lib/common'
import { safeMarkdown } from './markdown'

export function setupMarkdown() {
  config({
    editorExtensions: { highlight: { instance: hljs } },
    markdownItConfig(md) {
      md.set({ html: false })
    },
    markdownItPlugins(plugins) {
      return [...plugins, { type: 'cmsSafeMediaLinks', plugin: safeMarkdown, options: {} }]
    },
  })
}
