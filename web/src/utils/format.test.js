import { describe, expect, it } from 'vitest'
import { fmtDate, fmtDateTime, fmtOffset } from './format'

describe('时间原样展示（不换算浏览器时区）', () => {
  it('按 +08:00 字面值显示', () => {
    const iso = '2026-09-28T23:20:00+08:00'
    expect(fmtDate(iso)).toBe('2026-09-28')
    expect(fmtDateTime(iso)).toBe('2026-09-28 23:20')
    expect(fmtOffset(iso)).toBe('UTC+08:00')
  })
  it('非法输入返回空串', () => {
    expect(fmtDate(null)).toBe('')
    expect(fmtDateTime('2026-09-28 23:20')).toBe('')
  })
})
