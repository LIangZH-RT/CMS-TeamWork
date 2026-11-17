import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import 'highlight.js/styles/github.css'
import App from './App.vue'
import router from './router'
import { setupMarkdown } from './utils/markdown-setup'
import './styles/base.css'

setupMarkdown()

const app = createApp(App)
// 全量注册 Element Plus 图标（admin 页面用到 InfoFilled、CircleCheck、Warning 等）
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.use(createPinia()).use(router).use(ElementPlus, { locale: zhCn }).mount('#app')
