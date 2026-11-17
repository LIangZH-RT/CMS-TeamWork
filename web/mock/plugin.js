// Vite 插件：在 dev / preview 服务器上挂载契约 mock 中间件（VITE_USE_MOCK=true 时由 vite.config.js 启用）。
// mock 只活在 Node 侧中间件里，不会打进前端产物；前端代码始终按真实接口请求 /api/**。
// 路由顺序：先尝试 admin_handlers → 返回 null 则 fallback 到公开接口的 handlers。
import { handle } from './handlers.js'
import { handleAdmin } from './admin_handlers.js'

function readBody(req) {
  return new Promise((resolve) => {
    let chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      if (!raw) return resolve(null)
      try { resolve(JSON.parse(raw)) } catch { resolve(null) }
    })
    req.on('error', () => resolve(null))
  })
}

function middleware(req, res, next) {
  if (!req.url || !req.url.startsWith('/api/')) return next()

  ;(async () => {
    const body = req.method !== 'GET' && req.method !== 'HEAD' ? await readBody(req) : null

    // 1) 管理员端接口（/api/{articles,reviews,categories,tags}）
    const adminOut = handleAdmin(req.method, req.url, body)
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
  })()
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
