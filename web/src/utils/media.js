// 媒体单一出口（FR-MEDIA-002、INV-05）：页面上的封面、正文图片、音频只允许 /api/media/{id}。
// <img> / <audio> 直接请求该地址，不经 Axios、不做前端缓存。
export const MEDIA_SRC_RE = /^\/api\/media\/[1-9]\d{0,18}$/

export const safeMediaUrl = (u) => (typeof u === 'string' && MEDIA_SRC_RE.test(u) ? u : null)
