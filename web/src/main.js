import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'highlight.js/styles/github.css'
import App from './App.vue'
import router from './router'
import { setupMarkdown } from './utils/markdown-setup'
import { permissionDirective } from './directives/permission'
import './styles/base.css'

setupMarkdown()

createApp(App)
  .use(createPinia())
  .use(router)
  .use(ElementPlus, { locale: zhCn })
  .directive('permission', permissionDirective)
  .mount('#app')
