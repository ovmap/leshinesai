import type { App } from 'vue'
import { createI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settingsStore'

// 创建 i18n 实例
export const i18n = createI18n({
  legacy: false,           // 使用 Composition API
  globalInjection: true,   // 全局注入 $t 函数
  locale: 'zh-CN',         // 默认语言
  fallbackLocale: 'zh-CN', // 回退语言
  messages: {},            // 初始为空，动态加载
})

// 语言包模块（使用 Vite 的 glob 导入）
const modules = import.meta.glob('./langs/**/*.json')

/**
 * 从目录结构加载语言包
 * 路径格式: ./langs/zh-CN/dashboard.json -> { 'zh-CN': { dashboard: {...} } }
 */
export async function loadLocaleMessages(lang: string) {
  const messages: Record<string, any> = {}
  
  // 匹配对应语言的所有 JSON 文件
  const langModules = Object.entries(modules).filter(([path]) => 
    path.includes(`/${lang}/`)
  )
  
  // 加载所有匹配的文件
  for (const [path, importFn] of langModules) {
    const match = path.match(/\/langs\/[^/]+\/(.+)\.json$/)
    if (match) {
      const key = match[1] // 例如: 'dashboard', 'common'
      const module = await (importFn as any)()
      messages[key] = module.default || module
    }
  }
  
  // 设置到 i18n
  i18n.global.setLocaleMessage(lang, messages)
}

/**
 * 切换语言
 */
export async function switchLanguage(lang: string) {
  const currentLocale = i18n.global.locale.value
  
  if (currentLocale === lang) return
  
  // 加载新语言包（如果未加载）
  if (!i18n.global.availableLocales.includes(lang)) {
    await loadLocaleMessages(lang)
  }
  
  // 切换语言
  i18n.global.locale.value = lang
  
  // 更新 HTML lang 属性
  document?.querySelector('html')?.setAttribute('lang', lang)
  
  // 持久化到 localStorage
  localStorage.setItem('locale', lang)
  
  // 同步到 settingsStore
  try {
    const settingsStore = useSettingsStore()
    if (settingsStore.settings.locale !== lang) {
      settingsStore.updateSetting('locale', lang)
      // 保存设置到文件
      await settingsStore.saveSettingsToFile()
    }
  } catch (error) {
    console.warn('Failed to sync locale to settingsStore:', error)
  }
}

/**
 * 初始化 i18n
 */
export async function setupI18n(app: App) {
  // 先加载设置
  const settingsStore = useSettingsStore()
  if (!settingsStore.initialLoadAttempted) {
    await settingsStore.loadSettings()
  }
  
  // 从 settingsStore 读取语言设置
  const savedLocale = settingsStore.settings.locale || localStorage.getItem('locale') || 'zh-CN'
  
  // 设置初始语言
  i18n.global.locale.value = savedLocale
  
  // 加载语言包
  await loadLocaleMessages(savedLocale)
  
  // 挂载到 Vue 应用
  app.use(i18n)
  
  // 设置 HTML lang 属性
  document?.querySelector('html')?.setAttribute('lang', savedLocale)
  
  // 监听 settingsStore 中的语言变化
  settingsStore.$subscribe((mutation, state) => {
    const newLocale = state.settings.locale
    if (newLocale && newLocale !== i18n.global.locale.value) {
      switchLanguage(newLocale)
    }
  })
  
  // 开发环境下打印缺失 key 警告
  if (!import.meta.env.PROD) {
    i18n.global.setMissingHandler((locale, key) => {
      if (key.includes('.')) {
        console.warn(`[i18n] Missing key: '${key}' in '${locale}'`)
      }
    })
  }
}

/**
 * 获取当前语言
 */
export function getCurrentLocale() {
  return i18n.global.locale.value
}
