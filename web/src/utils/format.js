// 时间：服务端统一输出带 +08:00 偏移的 ISO 8601（api-spec §1.3）。
// 前台按字符串原样展示，不经 Date 换算到浏览器本地时区。
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/

export function fmtDate(iso) {
  const m = ISO_RE.exec(iso || '')
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
}

export function fmtDateTime(iso) {
  const m = ISO_RE.exec(iso || '')
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : ''
}

/** 'UTC+08:00'；Z 显示为 'UTC' */
export function fmtOffset(iso) {
  const m = ISO_RE.exec(iso || '')
  if (!m) return ''
  return m[7] === 'Z' ? 'UTC' : `UTC${m[7]}`
}
