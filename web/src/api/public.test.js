import { describe, expect, it } from 'vitest'
import { ApiError, http, isNotFound, unwrap } from './http'
import { pickDetail, pickListItem } from './public'

describe('http 封装', () => {
  it('解包 {code,message,data}', () => {
    expect(unwrap({ status: 200, data: { code: 0, message: 'OK', data: { a: 1 } } })).toEqual({ a: 1 })
    expect(() => unwrap({ status: 200, data: { code: 40000, message: 'x', data: null } })).toThrow(ApiError)
  })
  it('tag_ids 按 form + explode 序列化', () => {
    const uri = http.getUri({ url: '/api/public/articles', params: { page: 1, tag_ids: ['1', '10'] } })
    expect(uri).toBe('/api/public/articles?page=1&tag_ids=1&tag_ids=10')
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
