import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDashboardControlStore } from './dashboardControlStore'
import {
  getModuleTitleMap,
  getPageByName,
  getPageModuleNames,
  findModulePage,
  isLargeModule,
  LARGE_MODULES,
} from '../components/dashboard/moduleRegistry'
import { formatters } from './dashboardFormatters'

/**
 * 看板数据 Store — UI 的实时镜像（看板窗口侧）
 * 
 * 核心设计：dashboardDataStore 实时镜像当前 UI 的完整状态。
 * AI 调用 data 命令时，拿到的就是用户当前看到的完全一致的状态。
 * 
 * UI 组件只负责赋值 raw 数据，格式化逻辑统一在此处理。
 */
export const useDashboardDataStore = defineStore('dashboardData', () => {
  // 各模块的原始数据
  const moduleData = ref<Record<string, any>>({})

  // UI 状态（弹窗、选中等，与 UI 同步）
  const uiState = ref<Record<string, Record<string, any>>>({})

  // 最后更新时间
  const lastUpdated = ref<number>(0)

  // 控制 Store 引用
  const controlStore = useDashboardControlStore()

  // 更新模块数据（模块只传 raw 数据）
  function updateModuleData(module: string, raw: any) {
    moduleData.value[module] = raw
    lastUpdated.value = Date.now()
  }

  // 更新 UI 状态
  function updateUIState(module: string, state: Record<string, any>) {
    uiState.value[module] = { ...uiState.value[module], ...state }
    lastUpdated.value = Date.now()
  }

  // 移除模块数据
  function removeModuleData(module: string) {
    delete moduleData.value[module]
    delete uiState.value[module]
  }

  // ========== 数据读取 ==========

  function getModuleFormattedData(
    module: string,
    scope: 'summary' | 'detail' | 'full' = 'summary'
  ): string {
    const data = moduleData.value[module]
    if (!data) {
      return `## ${module}\n暂无数据`
    }

    const formatter = formatters[module]
    if (formatter) {
      return formatter(data, scope)
    }

    // 未知模块，直接 JSON
    return `## ${module}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
  }

  function getFullSnapshot(scope: 'summary' | 'detail' | 'full' = 'summary'): string {
    const activeModules = controlStore.activeModules
    const layout = controlStore.currentLayout
    const filters = controlStore.moduleFilters

    let result = `# 物流看板状态快照\n\n`
    result += `- **布局**: ${layout}\n`
    result += `- **活跃模块**: ${activeModules.join(', ')}\n`
    result += `- **更新时间**: ${new Date(lastUpdated.value).toLocaleString('zh-CN')}\n\n`

    // 各模块筛选条件
    const hasFilters = activeModules.some(m => {
      const f = filters[m]
      return f && Object.keys(f).length > 0
    })
    if (hasFilters) {
      result += `## 当前筛选\n\n`
      activeModules.forEach(mod => {
        const f = filters[mod]
        if (f && Object.keys(f).length > 0) {
          const filterDesc = Object.entries(f)
            .filter(([, v]) => v !== '' && v !== null && v !== undefined)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join(', ')
          if (filterDesc) {
            result += `- **${mod}**: ${filterDesc}\n`
          }
        }
      })
      result += '\n'
    }

    // 各模块数据
    activeModules.forEach(mod => {
      result += getModuleFormattedData(mod, scope)
      result += '\n\n'
    })

    return result.trim()
  }

  function getFormattedData(
    module?: string,
    format: 'markdown' | 'json' = 'markdown',
    scope: 'summary' | 'detail' | 'full' = 'summary'
  ): string {
    if (format === 'json') {
      const data: any = {
        activeModules: controlStore.activeModules,
        layout: controlStore.currentLayout,
        filters: controlStore.moduleFilters,
        modules: {},
        lastUpdated: lastUpdated.value,
      }
      const mods = module ? [module] : controlStore.activeModules
      mods.forEach(mod => {
        data.modules[mod] = {
          raw: moduleData.value[mod],
          uiState: uiState.value[mod] || {},
        }
      })
      return JSON.stringify(data, null, 2)
    }

    if (module) {
      return getModuleFormattedData(module, scope)
    }
    return getFullSnapshot(scope)
  }

  // ========== 布局感知数据获取 ==========

  /** 获取当前布局上下文 */
  function getLayoutContext() {
    const layout = controlStore.currentLayout
    const currentPage = controlStore.currentPage
    const activeModules = controlStore.activeModules
    const page = getPageByName(currentPage)

    return {
      layout,
      currentPage,
      currentPageTitle: page?.title || currentPage,
      activeModules,
      pageModules: page ? page.components.map(c => c.name) : [],
    }
  }

  /** 检查模块是否在当前视图中 */
  function isModuleInCurrentView(module: string): boolean {
    const layout = controlStore.currentLayout

    if (layout === 'scroll') {
      // scroll 布局：检查模块是否在当前页面
      const currentPage = controlStore.currentPage
      const pageModules = getPageModuleNames(currentPage)
      return pageModules.includes(module)
    }

    // grid/single/cards：检查是否在 activeModules 中
    return controlStore.activeModules.includes(module)
  }

  /** 获取模块摘要（用于 scroll 概览） */
  function getModuleSummary(module: string): string {
    const data = moduleData.value[module]
    const titleMap = getModuleTitleMap()
    const title = titleMap[module] || module

    if (!data) {
      return `${title}: 暂无数据`
    }

    // 各模块的摘要逻辑
    switch (module) {
      case 'cargoVolume': {
        const dayVol = parseFloat(data?.day?.totalVolume || '0')
        return `${title}: 日累计 ${dayVol.toLocaleString()} ${data?.day?.unit || 'm³'}`
      }
      case 'onTime': {
        const rate = data?.pickupRate
        const rateStr = typeof rate === 'string' && rate.includes('%') ? rate : `${Math.round(parseFloat(String(rate || '0')))}%`
        return `${title}: ${rateStr}`
      }
      case 'endToEnd': {
        const rate = data?.deliveryRate
        const rateStr = typeof rate === 'string' && rate.includes('%') ? rate : `${Math.round(parseFloat(String(rate || '0')))}%`
        return `${title}: ${rateStr}`
      }
      case 'energyPricesCard':
        return `${title}: 汽油 ${data.gasoline || '-'}/升`
      case 'unitPrice':
        return `${title}: ${parseFloat(data?.trunkLinePrice || '0').toFixed(2)} 元/公里`
      case 'dryPrice':
        return `${title}: ${parseFloat(data?.deliveryPrice || '0').toFixed(2)} 元`
      case 'energyPrices': {
        const items = data.items || []
        if (items.length > 0) {
          const latest = items[items.length - 1]
          const gas = parseFloat(latest.gasoline || '0').toFixed(2)
          return `${title}: 最新汽油 ${gas} 元/吨`
        }
        return `${title}: 暂无数据`
      }
      case 'abnormalTransportation': {
        const count = data.totalCount || data.list?.length || 0
        return `${title}: ${count} 条异常`
      }
      case 'capacityPool': {
        const total = data.total || data.list?.length || 0
        return `${title}: ${total} 台可用`
      }
      case 'urgentCustomer': {
        const count = data.total || data.list?.length || 0
        return `${title}: ${count} 条风险`
      }
      case 'majorEvents': {
        const count = data.total || data.list?.length || 0
        return `${title}: ${count} 条影响`
      }
      case 'cargoTrend': {
        const timeSeries = data.timeSeries || []
        if (timeSeries.length > 0) {
          const latest = timeSeries[timeSeries.length - 1]
          const total = latest.totalValue || 0
          const yoy = latest.totalYoy || '-'
          return `${title}: 最新 ${total.toLocaleString()} 单, 同比 ${yoy}`
        }
        return `${title}: 暂无数据`
      }
      case 'signingInformation': {
        const s = data.signed ?? 0
        const u = data.unsigned ?? 0
        const t = s + u
        const r = t > 0 ? ((s / t) * 100).toFixed(1) : '0'
        return `${title}: 签收率 ${r}%`
      }
      case 'reorderProgress': {
        const confirmed = data.confirmedCount || 0
        const total = data.totalCount || 0
        const pct = total > 0 ? ((confirmed / total) * 100).toFixed(1) : '0'
        return `${title}: 确认率 ${pct}%`
      }
      case 'mapPage':
        return `${title}: 地图页面`
      case 'cargoBanner':
        return `${title}: 智能体`
      default:
        return `${title}: 已加载`
    }
  }

  /** 获取页面概览（scroll 布局用） */
  function getPageOverview(): string {
    const ctx = getLayoutContext()
    const titleMap = getModuleTitleMap()
    const page = getPageByName(ctx.currentPage)

    let md = `# ${ctx.currentPageTitle}页面\n\n`
    md += `当前布局: scroll\n`
    md += `当前页面包含 ${ctx.pageModules.length} 个模块\n\n`

    // 模块概览表
    md += `## 模块概览\n\n`
    md += `| 模块 | 摘要 |\n`
    md += `|------|------|\n`

    ctx.pageModules.forEach(mod => {
      const summary = getModuleSummary(mod)
      md += `| ${titleMap[mod] || mod} | ${summary.replace(`${titleMap[mod] || mod}: `, '')} |\n`
    })

    // 提示
    md += `\n## 提示\n\n`
    md += `- 请求某个模块的详细数据，请指定模块名\n`

    const largeInPage = ctx.pageModules.filter(m => isLargeModule(m))
    if (largeInPage.length > 0) {
      const names = largeInPage.map(m => titleMap[m] || m).join('、')
      md += `- 大模块（${names}）支持聚焦显示\n`
    }

    // 检查其他页面
    const allPages = [
      { name: 'cargoBanner', title: '运输智能体' },
      { name: 'mapPage', title: '地图' },
    ]
    const otherPages = allPages.filter(p => p.name !== ctx.currentPage)
    if (otherPages.length > 0) {
      const pageNames = otherPages.map(p => p.title).join('、')
      md += `- 其他页面（${pageNames}）有独立数据，需要切换页面查看\n`
    }

    return md
  }

  /** 布局感知的数据获取（主入口） */
  function getSmartData(
    module?: string,
    format: 'markdown' | 'json' = 'markdown',
    scope: 'summary' | 'detail' | 'full' = 'summary'
  ): string {
    const layout = controlStore.currentLayout

    // JSON 格式直接返回原始数据
    if (format === 'json') {
      return getFormattedData(module, 'json', scope)
    }

    // ========== scroll 布局 ==========
    if (layout === 'scroll') {
      // 没指定模块 → 返回页面概览
      if (!module) {
        return getPageOverview()
      }

      // 指定了模块但不在当前页面
      if (!isModuleInCurrentView(module)) {
        const targetPage = findModulePage(module)
        const titleMap = getModuleTitleMap()
        const moduleTitle = titleMap[module] || module
        const currentPageTitle = getPageByName(controlStore.currentPage)?.title || controlStore.currentPage

        if (targetPage) {
          const targetPageTitle = getPageByName(targetPage)?.title || targetPage
          return `模块 [${moduleTitle}] 在"${targetPageTitle}"页面，当前显示"${currentPageTitle}"页面。\n\n建议: 切换到"${targetPageTitle}"页面？\n执行: dashboard_command({ command: 'page', args: { page: '${targetPage}' } })`
        }
        return `模块 [${moduleTitle}] 不在任何页面中。`
      }

      // 模块在当前页面 → 返回详细数据
      let result = getModuleFormattedData(module, scope)

      // 大模块额外提示聚焦
      if (isLargeModule(module)) {
        const titleMap = getModuleTitleMap()
        const moduleTitle = titleMap[module] || module
        result += `\n\n> 该模块支持全屏聚焦显示。如需查看更详细的信息，可以询问用户是否需要放大显示 [${moduleTitle}]。`
      }

      return result
    }

    // ========== grid/cards 布局 ==========
    if (layout === 'grid' || layout === 'cards') {
      if (module) {
        // 指定模块但不在当前 grid 中
        if (!controlStore.activeModules.includes(module)) {
          const titleMap = getModuleTitleMap()
          const currentNames = controlStore.activeModules.map(m => titleMap[m] || m).join('、')
          const moduleTitle = titleMap[module] || module
          return `当前显示 [${currentNames}]，模块 [${moduleTitle}] 不在其中。\n\n建议: 切换显示？\n执行: dashboard_command({ command: 'show', args: { modules: ['${module}'], layout: 'grid' } })`
        }
        return getModuleFormattedData(module, scope === 'summary' ? 'detail' : scope)
      }

      // 没指定模块 → 返回当前所有模块数据
      return getFullSnapshot(scope === 'summary' ? 'detail' : scope)
    }

    // ========== single 布局 ==========
    if (layout === 'single') {
      if (module) {
        // 指定模块但不是当前全屏模块
        if (!controlStore.activeModules.includes(module)) {
          const titleMap = getModuleTitleMap()
          const currentModule = controlStore.activeModules[0]
          const currentTitle = titleMap[currentModule] || currentModule
          const moduleTitle = titleMap[module] || module
          return `当前全屏显示 [${currentTitle}]，不是 [${moduleTitle}]。\n\n建议: 切换全屏？\n执行: dashboard_command({ command: 'show', args: { modules: ['${module}'], layout: 'single' } })`
        }
        return getModuleFormattedData(module, scope === 'summary' ? 'detail' : scope)
      }

      // 没指定模块 → 返回当前全屏模块的完整数据
      return getFullSnapshot(scope === 'summary' ? 'detail' : scope)
    }

    // fallback
    return getFormattedData(module, format, scope)
  }

  return {
    moduleData,
    uiState,
    lastUpdated,
    updateModuleData,
    updateUIState,
    removeModuleData,
    getModuleFormattedData,
    getFullSnapshot,
    getFormattedData,
    // 布局感知
    getLayoutContext,
    isModuleInCurrentView,
    getModuleSummary,
    getPageOverview,
    getSmartData,
  }
})
