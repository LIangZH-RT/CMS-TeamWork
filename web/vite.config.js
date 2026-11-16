import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { contractMock } from './mock/plugin.js'

// 同源约定（architecture §1、§9.3）：前端只请求相对路径 /api/**。
// - VITE_USE_MOCK=true：由契约 mock 中间件应答（开发默认开启，见 .env.development）
// - 否则：/api 代理到 VITE_API_TARGET（默认 http://localhost:8080），部署时由 Nginx 反向代理
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useMock = env.VITE_USE_MOCK === 'true'
  const proxy = useMock
    ? undefined
    : { '/api': { target: env.VITE_API_TARGET || 'http://localhost:8080', changeOrigin: true } }

  return {
    plugins: [vue(), useMock && contractMock()].filter(Boolean),
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: { chunkSizeWarningLimit: 2000 },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.js', 'mock/**/*.test.js'],
    },
  }
})
