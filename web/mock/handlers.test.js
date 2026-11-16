import { describe, expect, it } from 'vitest'
import { handle, likeMatch, NOT_FOUND_BODY, toLikePattern } from './handlers'

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
    expect(list('category_id=7')).toEqual({ items: [], page: 1, page_size: 20, total: 0, facets: null })
    expect(list('status=DRAFT&author_id=11').total).toBe(list('').total)
  })
  it('分页参数非法返回 400', () => {
    expect(handle('GET', '/api/public/articles?page_size=101').status).toBe(400)
  })
})

describe('契约 mock：facets', () => {
  it('只含已发布文章引用的分类、标签，按 id 升序', () => {
    const f = list('with_facets=true').facets
    expect(f.categories.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(f.tags.map((t) => t.id)).not.toContain(15)
    expect(Object.keys(f.categories[0]).sort()).toEqual(['id', 'name'])
  })
  it('与筛选、分页无关；不请求时为 null', () => {
    const all = list('with_facets=true').facets
    expect(list('with_facets=true&category_id=3&tag_ids=5&page=9').facets).toEqual(all)
    expect(list('with_facets=false').facets).toBeNull()
  })
  it('with_facets 只接受 true / false', () => {
    expect(handle('GET', '/api/public/articles?with_facets=1').status).toBe(400)
  })
})

describe('契约 mock：关键字 q', () => {
  const ids = (q, extra = '') => list(`q=${encodeURIComponent(q)}&page_size=100${extra}`).items.map((a) => a.id)
  it('匹配标题或摘要，大小写不敏感', () => {
    expect(ids('jvm')).toEqual(expect.arrayContaining([109, 112]))
    expect(ids('ThreadLocal')).toEqual([109]) // 只在摘要里
  })
  it('不匹配正文，不返回未发布文章', () => {
    expect(ids('老年代')).toEqual([]) // 只在 109 正文里
    expect(ids('待审核')).toEqual([])
  })
  it('% 与 _ 按字面匹配', () => {
    expect(ids('%')).toEqual([114])
    expect(ids('_')).toEqual([114])
    expect(ids('user_name')).toEqual([114])
    expect(ids('100%')).toEqual([114])
  })
  it('与标签、分类同时生效，total 为过滤后结果，facets 不受影响', () => {
    expect(ids('JVM', '&tag_ids=9')).toEqual([109])
    const d = list('q=JVM&with_facets=true&page_size=1')
    expect(d.total).toBe(2)
    expect(d.facets).toEqual(list('with_facets=true').facets)
  })
  it('去首尾空白，空串视为未传；超过 100 个字符返回 400', () => {
    expect(list('q=%20%20').total).toBe(list('').total)
    expect(handle('GET', `/api/public/articles?q=${'字'.repeat(100)}`).status).toBe(200)
    expect(handle('GET', `/api/public/articles?q=${'字'.repeat(101)}`).status).toBe(400)
  })
  it('LIKE 转义与匹配', () => {
    expect(toLikePattern('a%b_c\\')).toBe('%a\\%b\\_c\\\\%')
    expect(likeMatch(toLikePattern('a_c'), 'xa_cx')).toBe(true)
    expect(likeMatch(toLikePattern('a_c'), 'xabcx')).toBe(false)
    expect(likeMatch('%a_c%', 'xabcx')).toBe(true)
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
