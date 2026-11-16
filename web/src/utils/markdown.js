// 博客前台 Markdown 安全渲染规则（SRS §6.4 BR-MEDIA-001/006/007、FR-MEDIA-004 验收⑨）。
// 作为 markdown-it 插件挂到 md-editor-v3 的预览上（见 setupMarkdown），只读渲染共用一套规则。
//
// - 原始 HTML：md-editor-v3 v7 默认 html:false，源文本里的 HTML 一律按文本转义
// - 图片：只加载 /api/media/{id}；其他地址（外部 https、http、data: 等）不加载，显示替代文字
// - 链接：只跟从绝对 https 与站内相对地址（单个 / 开头、非 //）；https 外链新窗口 + noopener noreferrer；
//   http:、协议相对、javascript: / data: / vbscript: 及其他地址只保留文字，不生成链接
// - 视频【前台约定，api-spec §16 问题 9 尚无专门语法】：链接目标是 https 且路径以
//   .mp4 / .webm / .ogg 结尾的视频直链时，渲染为 <video controls preload="metadata">（不自动播放），
//   下方保留原链接；永不生成 iframe，视频平台页面链接（如 YouTube 页面）仍是普通外链
// - 代码块 / 行内代码：按文本显示，不执行
import { MEDIA_SRC_RE } from './media'

export const VIDEO_PATH_RE = /\.(mp4|webm|ogg)$/i

/** 'https' | 'site' | 'blocked' */
export function classifyHref(href) {
  const h = String(href ?? '').trim()
  if (/^https:\/\//i.test(h)) {
    try {
      const u = new URL(h)
      return u.protocol === 'https:' && u.hostname ? 'https' : 'blocked'
    } catch {
      return 'blocked'
    }
  }
  if (/^\/(?![/\\])/.test(h)) return 'site'
  return 'blocked'
}

export function isVideoHref(href) {
  if (classifyHref(href) !== 'https') return false
  return VIDEO_PATH_RE.test(new URL(String(href).trim()).pathname)
}

export const isMediaSrc = (src) => MEDIA_SRC_RE.test(String(src ?? '').trim())

function textOf(tokens) {
  return tokens
    .map((t) => (t.type === 'text' || t.type === 'code_inline' ? t.content : t.children ? textOf(t.children) : ''))
    .join('')
}

function html(state, content) {
  const t = new state.Token('html_inline', '', 0)
  t.content = content
  return t
}

function transform(state, children) {
  const esc = state.md.utils.escapeHtml
  const out = []
  for (let i = 0; i < children.length; i++) {
    const tok = children[i]
    if (tok.type === 'image') {
      const src = tok.attrGet('src')
      if (isMediaSrc(src)) {
        tok.attrSet('loading', 'lazy')
        out.push(tok)
      } else {
        const alt = textOf(tok.children || []) || tok.content || '图片'
        out.push(html(state, `<span class="md-blocked">［图片未显示：${esc(alt)}］</span>`))
      }
      continue
    }
    if (tok.type === 'link_open') {
      let j = i + 1
      while (j < children.length && children[j].type !== 'link_close') j++
      const inner = children.slice(i + 1, j)
      const close = children[j]
      const href = tok.attrGet('href')
      const kind = classifyHref(href)
      i = j
      if (kind === 'blocked') {
        out.push(...transform(state, inner)) // 只保留文字
        continue
      }
      if (isVideoHref(href)) {
        const src = esc(String(href).trim())
        const label = esc(textOf(inner) || href)
        out.push(
          html(
            state,
            `<span class="md-video"><video controls preload="metadata" playsinline src="${src}"></video>` +
              `<a class="md-video-link" href="${src}" target="_blank" rel="noopener noreferrer">${label}</a></span>`,
          ),
        )
        continue
      }
      if (kind === 'https') {
        tok.attrSet('target', '_blank')
        tok.attrSet('rel', 'noopener noreferrer')
      }
      out.push(tok, ...transform(state, inner))
      if (close) out.push(close)
      continue
    }
    out.push(tok)
  }
  return out
}

/** markdown-it 插件 */
export function safeMarkdown(md) {
  md.set({ html: false })
  md.core.ruler.push('cms_safe_media_links', (state) => {
    for (const block of state.tokens) {
      if (block.type === 'inline' && block.children) block.children = transform(state, block.children)
    }
  })
}
