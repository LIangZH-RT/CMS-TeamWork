import { describe, expect, it } from 'vitest'
import MarkdownIt from 'markdown-it'
import { classifyHref, isVideoHref, safeMarkdown } from './markdown'

// 与 md-editor-v3 v7 一致：html:false、linkify:true
const md = new MarkdownIt({ html: false, linkify: true }).use(safeMarkdown)
const render = (s) => md.render(s)

describe('classifyHref', () => {
  it.each([
    ['https://example.com/a', 'https'],
    ['/posts/1', 'site'],
    ['http://example.com', 'blocked'],
    ['//example.com/a', 'blocked'],
    ['/\\example.com', 'blocked'],
    ['javascript:alert(1)', 'blocked'],
    ['data:text/html,x', 'blocked'],
    ['vbscript:x', 'blocked'],
    ['movie.mp4', 'blocked'],
    ['#top', 'blocked'],
  ])('%s → %s', (href, kind) => expect(classifyHref(href)).toBe(kind))
})

describe('isVideoHref', () => {
  it('只认 https 视频直链', () => {
    expect(isVideoHref('https://cdn.example.com/a.mp4')).toBe(true)
    expect(isVideoHref('https://cdn.example.com/a.WEBM?x=1#t=3')).toBe(true)
    expect(isVideoHref('https://cdn.example.com/a.ogg')).toBe(true)
    expect(isVideoHref('http://cdn.example.com/a.mp4')).toBe(false)
    expect(isVideoHref('/api/media/1.mp4')).toBe(false)
    expect(isVideoHref('https://www.youtube.com/watch?v=xxxx')).toBe(false)
  })
})

describe('safeMarkdown 渲染', () => {
  it('https 视频直链内嵌为 <video controls preload=metadata>，不自动播放、不生成 iframe', () => {
    const html = render('[演示](https://cdn.example.com/demo.mp4)')
    expect(html).toContain('<video controls preload="metadata" playsinline src="https://cdn.example.com/demo.mp4"></video>')
    expect(html).not.toMatch(/autoplay|<iframe/i)
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('视频平台页面链接仍是普通外链', () => {
    const html = render('[演示](https://www.youtube.com/watch?v=xxxx)')
    expect(html).not.toMatch(/<video|<iframe/)
    expect(html).toContain('target="_blank" rel="noopener noreferrer"')
  })

  it('https 外链新窗口 + noopener noreferrer；站内链接同窗口', () => {
    expect(render('[a](https://example.com)')).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">a</a>')
    expect(render('[b](/posts/2)')).toContain('<a href="/posts/2">b</a>')
  })

  it.each([
    '[x](http://example.com)',
    '[x](//example.com)',
    '[x](javascript:alert(1))',
    '[x](data:text/html;base64,PHNjcmlwdD4=)',
    '[x](vbscript:msgbox)',
    '[x](http://example.com/a.mp4)',
    '[x](a.mp4)',
  ])('不跟从：%s', (src) => {
    const html = render(src)
    expect(html).not.toMatch(/<a |<video/)
  })

  it('图片只加载 /api/media/{id}，外部图片不加载', () => {
    expect(render('![ok](/api/media/4101)')).toMatch(/<img src="\/api\/media\/4101" alt="ok" loading="lazy">/)
    const ext = render('![外部](https://picsum.photos/200) ![d](data:image/png;base64,AAAA) ![h](http://x/y.png)')
    expect(ext).not.toContain('<img')
    expect(ext).toContain('［图片未显示：外部］')
  })

  it('原始 HTML 与代码示例都只作文本', () => {
    const html = render('<script>alert(1)</script>\n\n<iframe src="https://x"></iframe>\n\n```html\n<script>x</script>\n```\n\n`<img onerror=1>`')
    expect(html).not.toMatch(/<script|<iframe|<img/)
    expect(html).toContain('&lt;script&gt;')
  })

  it('属性值被转义', () => {
    const html = render('[x"><b>](https://cdn.example.com/a.mp4?q="x")')
    expect(html).not.toContain('"><b>')
  })
})
