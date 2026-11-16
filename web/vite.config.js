import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 同源约定（architecture §1、§9.3）：前端只请求相对路径 /api/**。
// 开发与预览时 /api 代理到 VITE_API_TARGET（默认 http://localhost:8080），部署时由 Nginx 反向代理
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = { '/api': { target: env.VITE_API_TARGET || 'http://localhost:8080', changeOrigin: true } }

  return {
    plugins: [vue()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: { chunkSizeWarningLimit: 2000 },
  }
})
