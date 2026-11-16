import { describe, expect, it } from 'vitest'
import { ApiError, http, isNotFound, unwrap } from './http'
import { listPublicArticles, pickDetail, pickListItem } from './public'

describe('http 封装', () => {
  it('解包 {code,message,data}', () => {
    expect(unwrap({ status: 200, data: { code: 0, message: 'OK', data: { a: 1 } } })).toEqual({ a: 1 })
    expect(() => unwrap({ status: 200, data: { code: 40000, message: 'x', data: null } })).toThrow(ApiError)
  })
  it('tag_ids 按 form + explode 序列化', () => {
    const uri = http.getUri({ url: '/api/public/articles', params: { page: 1, tag_ids: ['1', '10'] } })
    expect(uri).toBe('/api/public/articles?page=1&tag_ids=1&tag_ids=10')
  })
  it('q、with_facets 一起序列化；空关键字不传', () => {
    const uri = http.getUri({ url: '/api/public/articles', params: { q: '100% _x', with_facets: true, tag_ids: ['3'] } })
    expect(uri).toBe('/api/public/articles?q=100%25+_x&with_facets=true&tag_ids=3')
  })
  it('不从 Cookie 读取 CSRF 令牌（§2.2 令牌只经响应体下发）', () => {
    expect(http.defaults.withXSRFToken).toBe(false)
    expect(http.defaults.xsrfCookieName).toBeNull()
  })
  it('404 判定', () => {
    expect(isNotFound(new ApiError(404, 40400, '资源不存在'))).toBe(true)
    expect(isNotFound(new ApiError(500, 50000, 'x'))).toBe(false)
  })
})

describe('§4.14 白名单投影', () => {
  const raw = {
    id: 1, title: 't', excerpt: '', cover_url: '/api/media/2', category: { id: 3, name: 'c', in_use: true },
    tags: [{ id: 4, name: 'g', created_at: 'x' }], published_at: '2026-01-01T00:00:00+08:00',
    content: '# hi', audio_url: 'https://evil.example.com/a.mp3',
    status: 'PUBLISHED', author_id: 9, reject_reason: 'r', scheduled_publish_time: 'x', submission_id: 5,
  }
  it('详情只保留白名单字段，外部媒体地址置空', () => {
    expect(pickDetail(raw)).toEqual({
      id: 1, title: 't', excerpt: '', cover_url: '/api/media/2', category: { id: 3, name: 'c' },
      tags: [{ id: 4, name: 'g' }], published_at: '2026-01-01T00:00:00+08:00', content: '# hi', audio_url: null,
    })
  })
  it('列表项不含正文与音频', () => {
    const item = pickListItem(raw)
    expect(item).not.toHaveProperty('content')
    expect(item).not.toHaveProperty('audio_url')
    expect(item).not.toHaveProperty('status')
  })
})

describe('公开列表请求', () => {
  it('只发白名单参数；facets 只保留 id 与 name', async () => {
    let seen
    const adapter = async (config) => {
      seen = config.params
      const data = { code: 0, message: 'OK', data: { items: [], page: 1, page_size: 10, total: 0, facets: { categories: [{ id: 1, name: 'c', in_use: true }], tags: [{ id: 2, name: 't', created_at: 'x' }] } } }
      return { data, status: 200, statusText: 'OK', headers: {}, config }
    }
    const orig = http.defaults.adapter
    http.defaults.adapter = adapter
    try {
      // 多余的 status、author_id 不会被发出（INV-10）
      const ok = await listPublicArticles({ q: 'jvm', tag_ids: ['1'], with_facets: true, status: 'DRAFT', author_id: 3 })
      expect(Object.keys(seen).sort()).toEqual(['category_id', 'page', 'page_size', 'q', 'tag_ids', 'with_facets'])
      expect(seen.status).toBeUndefined()
      expect(ok.facets).toEqual({ categories: [{ id: 1, name: 'c' }], tags: [{ id: 2, name: 't' }] })
    } finally {
      http.defaults.adapter = orig
    }
  })
})
