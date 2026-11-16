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
