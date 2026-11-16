import { describe, expect, it } from 'vitest'
import { handle, NOT_FOUND_BODY } from './handlers'

const json = (r) => JSON.parse(r.body)
const list = (qs) => json(handle('GET', `/api/public/articles?${qs}`)).data
const WHITELIST = ['category', 'cover_url', 'excerpt', 'id', 'published_at', 'tags', 'title']

describe('契约 mock：公开列表', () => {
  it('只给已发布，按 published_at 降序，字段只有白名单', () => {
    const d = list('page_size=100')
    expect(d.items.map((a) => a.id)).not.toEqual(expect.arrayContaining([120, 121, 122, 123, 124]))
    const times = d.items.map((a) => Date.parse(a.published_at))
    expect([...times].sort((a, b) => b - a)).toEqual(times)
    for (const a of d.items) expect(Object.keys(a).sort()).toEqual(WHITELIST)
  })
  it('标签交集 + total 基于筛选后结果', () => {
    const d = list('tag_ids=1&tag_ids=10&page_size=1')
    expect(d.total).toBe(2)
    expect(d.items).toHaveLength(1)
    expect(list('tag_ids=1&tag_ids=10').items.every((a) => [1, 10].every((t) => a.tags.some((x) => x.id === t)))).toBe(true)
  })
  it('无结果返回空列表，不报错；未知参数忽略', () => {
    expect(list('category_id=7')).toEqual({ items: [], page: 1, page_size: 20, total: 0 })
    expect(list('status=DRAFT&author_id=11').total).toBe(list('').total)
  })
  it('分页参数非法返回 400', () => {
    expect(handle('GET', '/api/public/articles?page_size=101').status).toBe(400)
  })
})

describe('契约 mock：详情与媒体 404', () => {
  it('不存在与五种非已发布状态的 404 响应完全一致', () => {
    for (const id of ['99999', '120', '121', '122', '123', '124', 'abc']) {
      const r = handle('GET', `/api/public/articles/${id}`)
      expect(r.status).toBe(404)
      expect(r.body).toBe(NOT_FOUND_BODY)
    }
  })
  it('媒体：已发布当前引用可读，其余一律 404', () => {
    expect(handle('GET', '/api/media/4009').status).toBe(200)
    expect(handle('GET', '/api/media/4201').headers['Cache-Control']).toBe('no-store')
    for (const id of ['4020', '4030', '9999']) expect(handle('GET', `/api/media/${id}`).body).toBe(NOT_FOUND_BODY)
  })
  it('公开分类 / 标签接口不存在', () => {
    expect(handle('GET', '/api/public/categories').status).toBe(404)
  })
})
