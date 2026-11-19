import { beforeEach, describe, expect, it, vi } from 'vitest'

// admin_handlers 有模块级运行态（审核 / 改名会改状态），每个用例重新加载一份干净的模块
let handleAdmin
beforeEach(async () => {
  vi.resetModules()
  ;({ handleAdmin } = await import('./admin_handlers.js'))
})

const call = (method, url, body = null) => {
  const r = handleAdmin(method, url, body)
  return { status: r.status, ...JSON.parse(r.body) }
}
const get = (url) => call('GET', url).data
const NOT_FOUND = { status: 404, code: 40400, message: '资源不存在', data: null }

const AUDIT_KEYS = [
  'action', 'article_id', 'id', 'operated_at', 'operator', 'published_at', 'reason', 'reject_category',
  'related_approval_id', 'related_submission_id', 'review_standard_version', 'schedule_change',
].sort()

describe('admin mock：字段形状按 api-spec §4.10～§4.13', () => {
  it('审核队列项只有 §4.12 的字段，current_submission_id 非空', () => {
    const d = get('/api/reviews/queue')
    expect(d.total).toBe(1)
    const [item] = d.items
    expect(Object.keys(item).sort()).toEqual(
      ['author', 'category', 'current_submission_id', 'id', 'scheduled_publish_time', 'submitted_at', 'tags', 'title'].sort(),
    )
    expect(item.current_submission_id).toBe(1001)
  })

  it('列表项按 §4.11，不含自造字段', () => {
    const [item] = get('/api/articles?page_size=1').items
    expect(Object.keys(item).sort()).toEqual(
      ['allowed_actions', 'author', 'category', 'id', 'latest_event', 'published_at', 'scheduled_publish_time', 'status', 'submitted_at', 'tags', 'title', 'updated_at'].sort(),
    )
    const rejected = get('/api/articles?status=REJECTED').items[0]
    expect(rejected.latest_event).toMatchObject({ type: 'REJECT', reject_category: 'QUALITY_POSITIONING' })
  })

  it('详情按 §4.10：cover / audio 是 MediaRef，current_submission_id 只在待审核时有值', () => {
    const a = get('/api/articles/109')
    for (const k of ['submission_round', 'reject_reason', 'unpublish_reason', 'cover_url']) expect(a).not.toHaveProperty(k)
    expect(a.cover).toEqual({ media_id: 4009, url: '/api/media/4009', mime_type: 'image/png', size: expect.any(Number) })
    expect(a.latest_rejection).toMatchObject({ reject_category: 'QUALITY_POSITIONING', comment: '缺少堆转储截图' })
    expect(a.latest_unpublish).toMatchObject({ reason: '临时下架补充数据' })
    expect(a.current_submission_id).toBeNull()
    expect(a.allowed_actions).toEqual(['UNPUBLISH'])
    expect(get('/api/articles/121')).toMatchObject({ current_submission_id: 1001, allowed_actions: ['APPROVE', 'REJECT'] })
  })

  it('计数返回 { by_status, total }，支持 author_id', () => {
    const d = get('/api/articles/counts')
    expect(Object.keys(d.by_status).sort()).toEqual(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'SCHEDULED', 'UNPUBLISHED'])
    expect(d.total).toBe(Object.values(d.by_status).reduce((x, y) => x + y, 0))
    expect(get('/api/articles/counts?author_id=12').by_status.PENDING_REVIEW).toBe(1)
    expect(call('GET', '/api/articles/counts?author_id=x').status).toBe(400)
  })

  it('留痕按 §4.13：字段齐全、按时间正序、动作只有 7 类、SYSTEM 操作人无 id', () => {
    const logs = get('/api/articles/104/audit-logs')
    for (const l of logs) expect(Object.keys(l).sort()).toEqual(AUDIT_KEYS)
    const times = logs.map((l) => Date.parse(l.operated_at))
    expect([...times].sort((a, b) => a - b)).toEqual(times)
    const auto = logs.find((l) => l.action === 'AUTO_PUBLISH')
    expect(auto.operator).toEqual({ type: 'SYSTEM', id: null, username: null })
    const all = [109, 104, 121, 122, 123, 124].flatMap((id) => get(`/api/articles/${id}/audit-logs`))
    const ACTIONS = ['SUBMIT', 'APPROVE', 'REJECT', 'UNPUBLISH', 'WITHDRAW', 'RESCHEDULE', 'AUTO_PUBLISH']
    expect(all.every((l) => ACTIONS.includes(l.action))).toBe(true)
  })

  it('审核标准按 §7.2：8 个驳回类别', () => {
    const s = get('/api/reviews/standard')
    expect(s.review_standard_version).toBe('CMS-CONTENT-REVIEW-1.0')
    expect(s.reject_categories.map((c) => c.value)).toEqual([
      'ILLEGAL', 'AUTHENTICITY_SOURCE', 'COPYRIGHT_PRIVACY', 'MINOR_VULGAR_VIOLENCE',
      'DISCRIMINATION_HARASSMENT', 'SPAM_MARKETING', 'QUALITY_POSITIONING', 'OTHER',
    ])
  })
})

describe('admin mock：审核动作', () => {
  it('不存在或 id 非法 → 统一 404', () => {
    expect(call('POST', '/api/articles/999/approve', { submission_id: 1 })).toEqual(NOT_FOUND)
    expect(call('POST', '/api/articles/abc/reject', {})).toEqual(NOT_FOUND)
  })

  it('非待审核 → 409 40900，不抛异常、不写留痕', () => {
    const before = get('/api/articles/109/audit-logs').length
    expect(call('POST', '/api/articles/109/approve', { submission_id: 1 })).toMatchObject({ status: 409, code: 40900 })
    expect(call('POST', '/api/articles/122/reject', { submission_id: 1, reject_category: 'OTHER', comment: 'x' })).toMatchObject({ status: 409, code: 40900 })
    expect(get('/api/articles/109/audit-logs')).toHaveLength(before)
  })

  it('轮次不符 → 409 40901；缺轮次 → 400 40010', () => {
    expect(call('POST', '/api/articles/121/approve', { submission_id: 999 })).toMatchObject({ status: 409, code: 40901 })
    expect(call('POST', '/api/articles/121/approve', {})).toMatchObject({ status: 400, code: 40010 })
  })

  it('驳回：类别不在 8 类 → 40011；意见缺失或纯空格 → 40012', () => {
    const base = { submission_id: 1001, reject_category: 'OTHER', comment: '正文缺少案例' }
    expect(call('POST', '/api/articles/121/reject', { ...base, reject_category: 'NOT_A_CATEGORY' })).toMatchObject({ status: 400, code: 40011 })
    expect(call('POST', '/api/articles/121/reject', { ...base, comment: '   ' })).toMatchObject({ status: 400, code: 40012 })
    expect(call('POST', '/api/articles/121/reject', { ...base, comment: undefined })).toMatchObject({ status: 400, code: 40012 })
    expect(get('/api/articles/121').status).toBe('PENDING_REVIEW')
  })

  it('驳回成功：状态变 REJECTED，写一条 REJECT 留痕', () => {
    const r = call('POST', '/api/articles/121/reject', { submission_id: 1001, reject_category: 'QUALITY_POSITIONING', comment: ' 正文缺少案例 ' })
    expect(r).toMatchObject({ status: 200, data: { id: 121, status: 'REJECTED' } })
    const last = get('/api/articles/121/audit-logs').at(-1)
    expect(last).toMatchObject({
      action: 'REJECT', reason: '正文缺少案例', reject_category: 'QUALITY_POSITIONING',
      review_standard_version: 'CMS-CONTENT-REVIEW-1.0', related_submission_id: 1001,
    })
    expect(last.operated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/)
  })

  it('通过：无预定时间 → PUBLISHED；再点一次 → 409（以前会打崩进程）', () => {
    const r = call('POST', '/api/articles/121/approve', { submission_id: 1001 })
    expect(r.status).toBe(200)
    expect(r.data).toMatchObject({ id: 121, status: 'PUBLISHED', scheduled_publish_time: null })
    expect(r.data.published_at).toBeTruthy()
    expect(call('POST', '/api/articles/121/approve', { submission_id: 1001 })).toMatchObject({ status: 409, code: 40900 })
    expect(get('/api/articles/counts').by_status.PENDING_REVIEW).toBe(0)
  })

  it('下架：先校验原因（400 40012），再判断状态（409 40900）', () => {
    expect(call('POST', '/api/articles/122/unpublish', { reason: ' ' })).toMatchObject({ status: 400, code: 40012 })
    expect(call('POST', '/api/articles/122/unpublish', { reason: '过期' })).toMatchObject({ status: 409, code: 40900 })
    expect(call('POST', '/api/articles/109/unpublish', { reason: '过期' })).toMatchObject({ status: 200, data: { status: 'UNPUBLISHED' } })
    expect(get('/api/articles/109').published_at).toBe('2026-11-09T21:05:00+08:00')
  })
})

describe('admin mock：分类与标签', () => {
  it('被引用的分类 / 标签不能改名或删除 → 409 40904', () => {
    expect(call('PUT', '/api/categories/1', { name: '服务端' })).toMatchObject({ status: 409, code: 40904, data: null })
    expect(call('DELETE', '/api/categories/1')).toMatchObject({ status: 409, code: 40904, data: null })
    expect(call('PUT', '/api/tags/1', { name: 'J' })).toMatchObject({ status: 409, code: 40904 })
    expect(call('DELETE', '/api/tags/1')).toMatchObject({ status: 409, code: 40904 })
  })

  it('重名 → 409 40906（不区分大小写）；未引用的可以改名', () => {
    expect(call('POST', '/api/categories', { name: '后端' })).toMatchObject({ status: 409, code: 40906 })
    const { data: c } = call('POST', '/api/categories', { name: '新分类' })
    expect(call('PUT', `/api/categories/${c.id}`, { name: '新分类二' })).toMatchObject({ status: 200, data: { name: '新分类二' } })
    const tagName = get('/api/tags?page_size=1').items[0].name
    expect(call('POST', '/api/tags', { name: tagName.toUpperCase() })).toMatchObject({ status: 409, code: 40906 })
  })

  it('名称为空 → 400；不存在 → 404', () => {
    expect(call('POST', '/api/categories', { name: '  ' }).status).toBe(400)
    expect(call('PUT', '/api/tags/9999', { name: 'x' })).toEqual(NOT_FOUND)
  })

  it('非 admin 路径返回 null，交给公开接口 handler', () => {
    expect(handleAdmin('GET', '/api/public/articles')).toBeNull()
  })
})

describe('mock 中间件', () => {
  it('handler 抛异常时返回 500，不产生未处理的 rejection', async () => {
    vi.resetModules()
    vi.doMock('./admin_handlers.js', () => ({ handleAdmin: () => { throw new TypeError('boom') } }))
    const { contractMock } = await import('./plugin.js')
    let mw
    contractMock().configureServer({ middlewares: { use: (fn) => (mw = fn) } })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await new Promise((resolve) => {
      const res = { headers: {}, headersSent: false, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body; resolve(this) } }
      mw({ method: 'GET', url: '/api/reviews/queue' }, res, () => {})
    })
    expect(res.statusCode).toBe(500)
    expect(JSON.parse(res.body)).toEqual({ code: 50000, message: '服务器内部错误', data: null })
    errSpy.mockRestore()
    vi.doUnmock('./admin_handlers.js')
  })
})
