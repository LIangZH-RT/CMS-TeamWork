import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const getPublicFacets = vi.fn()
vi.mock('@/api/public', () => ({ getPublicFacets: (...a) => getPublicFacets(...a) }))
const { useTaxonomy } = await import('./taxonomy')

describe('taxonomy store（facets）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getPublicFacets.mockReset()
  })
  it('并发 ensure 只请求一次；成功后不再请求', async () => {
    getPublicFacets.mockResolvedValue({ categories: [{ id: 1, name: '后端' }], tags: [{ id: 9, name: 'JVM' }] })
    const s = useTaxonomy()
    await Promise.all([s.ensure(), s.ensure()])
    await s.ensure()
    expect(getPublicFacets).toHaveBeenCalledTimes(1)
    expect(s.status).toBe('ready')
    expect(s.categoryById('1')?.name).toBe('后端')
    expect(s.tagById(9)?.name).toBe('JVM')
    expect(s.categoryById('7')).toBeNull()
  })
  it('失败标记 error，再次 ensure 会重试', async () => {
    getPublicFacets.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ categories: [], tags: [] })
    const s = useTaxonomy()
    await s.ensure()
    expect(s.status).toBe('error')
    await s.ensure()
    expect(s.status).toBe('ready')
    expect(getPublicFacets).toHaveBeenCalledTimes(2)
  })
})
