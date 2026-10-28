import './assets/styles.css'
import './assets/iconfont/iconfont.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import router from './router/main.ts'
import { initializeClients } from './services/apiClients'
import { registerCodexToolBridge } from './services/llmProviders/codexToolBridge'
import { setupI18n } from './i18n'

import App from './App.vue'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Antd)
registerCodexToolBridge()

// 初始化国际化和客户端（两者并行，但都必须在挂载前完成）
const i18nPromise = setupI18n(app).then(() => {
  console.log('i18n initialized')
}).catch(error => {
  console.error('Failed to initialize i18n:', error)
})

const clientsPromise = initializeClients()
  .then(() => {
    console.log('All clients initialized')
  })
  .catch(error => {
    console.error('Failed to initialize clients, mounting app anyway:', error)
  })

async function mountApp(): Promise<void> {
  try {
    await router.isReady()
  } catch (error) {
    console.error('Router failed to finish initial navigation:', error)
  }
  app.mount('#app')
}

// 等待 i18n 和客户端都初始化完成后再挂载应用
Promise.all([i18nPromise, clientsPromise]).finally(() => {
  mountApp()
})
