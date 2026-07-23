import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDashboardControlStore } from './dashboardControlStore'

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

  // ========== 各模块的格式化逻辑 ==========

  function formatSigningInfo(data: any, scope: string): string {
    const s = data?.signed ?? 0
    const u = data?.unsigned ?? 0
    const t = s + u
    const r = t > 0 ? ((s / t) * 100).toFixed(1) : '0'

    let md = `## 签收信息\n\n`
    md += `- **已签收**: ${s.toLocaleString()} 单\n`
    md += `- **待签收**: ${u.toLocaleString()} 单\n`
    md += `- **签收率**: ${r}%\n`

    if (data?.filters) {
      const f = data.filters
      const hasFilter = f.fromWarehouse || f.toProvince || f.toRdc || f.modeType
      if (hasFilter) {
        md += `\n**当前筛选**:\n`
        if (f.fromWarehouse) md += `- 始发仓: ${f.fromWarehouse}\n`
        if (f.toProvince) md += `- 目的省: ${f.toProvince}\n`
        if (f.toRdc) md += `- 目的RDC: ${f.toRdc}\n`
        if (f.modeType) md += `- 配送模式: ${f.modeType}\n`
      }
    }

    if (scope === 'detail' || scope === 'full') {
      const list = data?.detailList || []
      if (list.length === 0) {
        md += '\n## 未签收明细\n\n暂无数据\n'
      } else {
        const total = data?.detailTotal ?? list.length
        const page = uiState.value['signingInformation']?.currentPage ?? 1
        md += `\n## 未签收明细 (共 ${total} 条, 当前第 ${page} 页)\n\n`
        md += `| 始发仓 | 运输单号 | 承运商 | 目的省 | 目的市 | 配送模式 | 件数 | 体积 | 发货时间 |\n`
        md += `|--------|----------|--------|--------|--------|----------|------|------|----------|\n`
        list.slice(0, 20).forEach((row: any) => {
          md += `| ${row.fromWarehouse || ''} | ${row.transNo || ''} | ${row.carrierName || ''} | ${row.toProvince || ''} | ${row.toCity || ''} | ${row.modeType || ''} | ${row.goodsNum || ''} | ${row.volume || ''} | ${row.deliverTime || ''} |\n`
        })
        if (list.length > 20) {
          md += `\n_... 还有 ${list.length - 20} 条数据_\n`
        }
      }
    }

    return md
  }

  function formatCargoTrend(data: any, scope: string): string {
    const timeSeries = data?.timeSeries || []
    const filters = data?.filters || {}

    const timeTypeNames: Record<string, string> = {
      CALENDAR_YEAR: '自然年', FICAL_YEAR: '财年', CALENDAR_QUARTER: '自然季',
      FICAL_QUARTER: '财季', MONTH: '月', WEEK: '周', DAY: '日',
    }
    const metricNames: Record<string, string> = {
      VOLUME: '订单数量', WEIGHT: '重量', VOLUME_SIZE: '体积',
    }

    let md = `## 货量趋势\n\n`
    md += `- **时间维度**: ${timeTypeNames[filters.timeType] || filters.timeType || '-'}\n`
    md += `- **指标**: ${metricNames[filters.metric] || filters.metric || '-'}\n`
    md += `- **数据源**: ${Array.isArray(filters.dataSource) ? filters.dataSource.join(', ') : filters.dataSource || '全部'}\n`
    md += `- **时间范围**: ${filters.dateRange || '-'}\n\n`

    if (timeSeries.length === 0) {
      md += '_暂无数据_\n'
      return md
    }

    // 提取所有数据源
    const allSources = new Set<string>()
    timeSeries.forEach((item: any) => {
      if (item.items) {
        item.items.forEach((i: any) => allSources.add(i.dataSource))
      }
    })
    const sourceNames = Array.from(allSources)

    // 表头
    md += `| 时间段 | ${sourceNames.join(' | ')} | 合计 | 同比 | 环比 |\n`
    md += `|--------|${sourceNames.map(() => '------').join('|')}|------|------|------|\n`

    // 数据行
    timeSeries.forEach((timeItem: any) => {
      const values = sourceNames.map(code => {
        const item = timeItem.items?.find((i: any) => i.dataSource === code)
        const val = parseFloat(item?.value) || 0
        return val >= 1000 ? Math.round(val / 1000) + 'k' : val.toFixed(0)
      })
      const total = timeItem.totalValue
      const totalStr = total >= 1000 ? Math.round(total / 1000) + 'k' : total?.toFixed(0) || '0'
      const yoy = timeItem.totalYoy || '-'
      const mom = timeItem.totalMom || '-'
      md += `| ${timeItem.timeDimension} | ${values.join(' | ')} | ${totalStr} | ${yoy} | ${mom} |\n`
    })

    return md
  }

  // 模块格式化器注册表
  const formatters: Record<string, (data: any, scope: string) => string> = {
    signingInformation: formatSigningInfo,
    cargoTrend: formatCargoTrend,
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
  }
})
