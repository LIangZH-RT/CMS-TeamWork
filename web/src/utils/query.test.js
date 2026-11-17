import { describe, expect, it } from 'vitest'
import { hasFilter, parseListQuery, toggleTag, toRouteQuery, withCategory } from './query'

describe('筛选 ↔ URL', () => {
  it('解析并丢弃非法值', () => {
    expect(parseListQuery({ page: '3', category_id: '2', tag_ids: ['1', '1', 'x', '10'] })).toEqual({ page: 3, category_id: '2', tag_ids: ['1', '10'] })
    expect(parseListQuery({ page: '0', category_id: '-1', tag_ids: '7' })).toEqual({ page: 1, category_id: null, tag_ids: ['7'] })
    expect(parseListQuery({ status: 'DRAFT' })).toEqual({ page: 1, category_id: null, tag_ids: [] })
  })

  it('int64 ID 保留为字符串', () => {
    expect(parseListQuery({ category_id: '9223372036854775807' }).category_id).toBe('9223372036854775807')
  })

  it('序列化省略默认值', () => {
    expect(toRouteQuery({ page: 1, category_id: null, tag_ids: [] })).toEqual({})
    expect(toRouteQuery({ page: 2, category_id: '3', tag_ids: ['1', '4'] })).toEqual({ page: '2', category_id: '3', tag_ids: ['1', '4'] })
  })

  it('点分类 / 标签回到第 1 页；标签可切换', () => {
    const f = { page: 4, category_id: null, tag_ids: ['1'] }
    expect(withCategory(f, 5)).toEqual({ page: 1, category_id: '5', tag_ids: ['1'] })
    expect(toggleTag(f, 2)).toEqual({ page: 1, category_id: null, tag_ids: ['1', '2'] })
    expect(toggleTag(f, 1)).toEqual({ page: 1, category_id: null, tag_ids: [] })
    expect(hasFilter({ category_id: null, tag_ids: [] })).toBe(false)
  })
})

describe('搜索参数', () => {
  it('q 去首尾空白、空串视为未传、超长按码点截断', async () => {
    const { normalizeKeyword, parseSearchQuery, toSearchRouteQuery } = await import('./query')
    expect(normalizeKeyword('  JVM  ')).toBe('JVM')
    expect(normalizeKeyword(['a', 'b'])).toBe('a')
    expect(normalizeKeyword(undefined)).toBe('')
    expect([...normalizeKeyword('😀'.repeat(120))]).toHaveLength(100)
    expect(parseSearchQuery({ q: ' x ', tag_ids: ['3'], page: '2', status: 'DRAFT' })).toEqual({ q: 'x', page: 2, category_id: null, tag_ids: ['3'] })
    expect(toSearchRouteQuery({ q: '  ', page: 1, tag_ids: [] })).toEqual({})
    expect(toSearchRouteQuery({ q: '100%', page: 2, tag_ids: ['1'] })).toEqual({ q: '100%', tag_ids: ['1'], page: '2' })
  })
  it('高亮只切纯文本片段，% _ 按字面', async () => {
    const { splitHighlight } = await import('./query')
    expect(splitHighlight('JVM 与 jvm', 'jvm')).toEqual([
      { text: 'JVM', hit: true }, { text: ' 与 ', hit: false }, { text: 'jvm', hit: true },
    ])
    expect(splitHighlight('a_b axb', '_').filter((s) => s.hit).map((s) => s.text)).toEqual(['_'])
    expect(splitHighlight('<b>x</b>', 'x')).toEqual([{ text: '<b>', hit: false }, { text: 'x', hit: true }, { text: '</b>', hit: false }])
    expect(splitHighlight('abc', '')).toEqual([{ text: 'abc', hit: false }])
  })
})
