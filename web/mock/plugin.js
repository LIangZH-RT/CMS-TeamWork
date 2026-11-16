// Vite 插件：在 dev / preview 服务器上挂载契约 mock 中间件（VITE_USE_MOCK=true 时由 vite.config.js 启用）。
// mock 只活在 Node 侧中间件里，不会打进前端产物；前端代码始终按真实接口请求 /api/**。
import { handle } from './handlers.js'

function middleware(req, res, next) {
  if (!req.url || !req.url.startsWith('/api/')) return next()
  const out = handle(req.method, req.url, req.headers)
  res.statusCode = out.status
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v)
  res.end(req.method === 'HEAD' ? undefined : out.body)
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
