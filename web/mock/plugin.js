// Vite 插件：在 dev / preview 服务器上挂载契约 mock 中间件（VITE_USE_MOCK=true 时由 vite.config.js 启用）。
// mock 只活在 Node 侧中间件里，不会打进前端产物；前端代码始终按真实接口请求 /api/**。
// 路由顺序：先尝试 admin_handlers → 返回 null 则 fallback 到公开接口的 handlers。
import { handle } from './handlers.js'
import { handleAdmin } from './admin_handlers.js'
import { handleExtra } from './extra_handlers.js'

function readRaw(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', () => resolve(Buffer.alloc(0)))
  })
}

function readBody(req) {
  return readRaw(req).then((raw) => {
    const ct = req.headers?.['content-type'] || ''
    if (ct.includes('multipart/form-data')) {
      const text = raw.toString('utf8')
      const usage = /name="usage"\r\n\r\n([^\r\n]+)/.exec(text)?.[1]
      const filename = /filename="([^"]*)"/.exec(text)?.[1] || 'file.bin'
      return { __multipart: true, usage, filename, size: raw.length, original_name: filename }
    }
    if (!raw.length) return null
    try { return JSON.parse(raw.toString('utf-8')) } catch { return null }
  })
}

function middleware(req, res, next) {
  if (!req.url || !req.url.startsWith('/api/')) return next()

  ;(async () => {
    const body = req.method !== 'GET' && req.method !== 'HEAD' ? await readBody(req) : null

    const extraOut = handleExtra(req.method, req.url, body, req.headers || {})
    if (extraOut) {
      res.statusCode = extraOut.status
      for (const [k, v] of Object.entries(extraOut.headers)) res.setHeader(k, v)
      res.end(req.method === 'HEAD' ? undefined : extraOut.body)
      return
    }

    // 1) 管理员端接口（/api/{articles,reviews,categories,tags}）
    const adminOut = handleAdmin(req.method, req.url, body, req.headers || {})
    if (adminOut) {
      res.statusCode = adminOut.status
      for (const [k, v] of Object.entries(adminOut.headers)) res.setHeader(k, v)
      res.end(req.method === 'HEAD' ? undefined : adminOut.body)
      return
    }

    // 2) 公开接口（/api/public/**、/api/media/**）
    const pubOut = handle(req.method, req.url, req.headers)
    res.statusCode = pubOut.status
    for (const [k, v] of Object.entries(pubOut.headers)) res.setHeader(k, v)
    res.end(req.method === 'HEAD' ? undefined : pubOut.body)
  })().catch((err) => {
    // mock 自身出错时只让这一个请求返回 500，不能让未处理的 rejection 打崩 dev / preview 进程
    console.error('[cms-contract-mock]', req.method, req.url, err)
    if (res.headersSent) return res.end()
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ code: 50000, message: '服务器内部错误', data: null }))
  })
}

export function contractMock() {
  return {
    name: 'cms-contract-mock',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
