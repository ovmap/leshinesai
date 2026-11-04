/**
 * help 命令 — 分层帮助系统 + 状态感知
 *
 * 从整体到细分，一层层查询命令用法：
 * - help()                    → 命令总览（带当前状态）
 * - help("filter")            → filter 参数详情
 * - help("action")            → action 用法 + 模块操作列表
 * - help("action", "cargoTrend") → cargoTrend 具体操作
 * - help("page")              → 页面列表（标记当前页面）
 * - help("show")              → 模块列表 + 布局说明（根据当前布局提示）
 * - ...
 */

import type { CommandHandler } from '../types'
import {
  getModuleTitleMap,
  getPageByName,
  getModuleByName,
  getPages,
  LARGE_MODULES,
  moduleRegistry,
} from '../../../components/dashboard/moduleRegistry'

export const handleHelp: CommandHandler = async (args) => {
  try {
    const result = await window.ipcRenderer.invoke('dashboard:help', {
      queryCommand: args?.queryCommand,
      module: args?.module,
      queryFilter: args?.queryFilter,
    })

    if (!result.success) {
      return `获取帮助失败: ${result.error}`
    }

    return result.data || '暂无帮助信息'
  } catch (error: any) {
    return `获取帮助失败: ${error.message}`
  }
}

/**
 * 获取帮助信息（分层帮助 + 状态感知）
 * 在 DashboardView.vue 中通过 IPC 调用
 */
export function getHelpInfo(
  queryCommand?: string,
  module?: string,
  currentState?: {
    layout: string
    currentPage: string
    activeModules: string[]
    currentFilters?: { fromWarehouse: string[]; toProvince: string[]; toRdc: string[] }
    filterOptions?: { fromWarehouse: string[]; toProvince: string[]; toRdc: string[] }
  },
  queryFilter?: string
): string {
  const layout = currentState?.layout || 'scroll'
  const currentPage = currentState?.currentPage || ''
  const activeModules = currentState?.activeModules || []
  const currentFilters = currentState?.currentFilters
  const filterOptions = currentState?.filterOptions
  const moduleTitleMap = getModuleTitleMap()

  // 没有指定命令 → 返回总览（带当前状态）
  if (!queryCommand) {
    let overview = `## Dashboard CLI 命令指南\n\n`
    
    // 当前状态
    overview += `### 当前状态\n`
    overview += `- **布局**: ${layout}\n`
    if (layout === 'scroll' && currentPage) {
      const pageInfo = getPageByName(currentPage)
      overview += `- **当前页面**: ${pageInfo?.title || currentPage}\n`
    } else if (activeModules.length > 0) {
      const moduleNames = activeModules.map(m => moduleTitleMap[m] || m)
      overview += `- **显示模块**: ${layout === 'single' ? moduleNames[0] : moduleNames.join('、')}\n`
    }
    overview += `\n`

    // 命令列表
    overview += `### 可用命令
| 命令 | 说明 | 常用场景 |
|------|------|----------|
| show | 显示/切换模块 | 打开看板后展示特定模块 |
| filter | 设置筛选条件 | 按始发仓、目的省、日期等筛选 |
| data | 获取数据（Markdown） | 读取当前页面或指定模块数据 |
| status | 获取当前状态 | 确认布局/页面/模块是否正确 |
| action | 触发 UI 操作 | 翻页、排序、钻取等交互 |
| layout | 放大展示单个模块 | single 布局，全屏显示 |
| page | 切换页面 | 12个页面间切换 |
| close | 关闭看板 | 结束使用 |
| help | 查询命令用法 | 不确定参数时查询 |

### 快速开始
1. 打开看板：\`show\`
2. 查看数据：\`data\`
3. 筛选：\`filter\` + 条件
4. 不确定当前状态？用 \`status\`
5. 不确定参数？用 \`help\`

### 页面一览（共12个）

**综合看板**
| 页面标识 | 标题 | 包含模块 |
|----------|------|----------|
| cargoBanner | 智能体中心 | 累计货量、提货及时率、准时交付率、能源价格、干单价、配单价、货量趋势、签收信息、返单进展、智能体中心、能源价格趋势、运输异常、运力池、加急&重点客户风险、重大活动&极端天气影响 |
| mapPage | 地图 | 地图 |
| reorderDashboard | 返单看板 | 应签未签、应签未签明细、返单及时率、未返单明细 |
| cargoDashboard | 货量看板 | 货量趋势、货量占比、货量(表格占比)、运输异常 |

**准时交付率（CDD）相关**
| 页面标识 | 标题 | 包含模块 |
|----------|------|----------|
| onTimeDelivery | 准时交付率（整体） | 准时交付率(仓+物流)、准时交付率(时间维度) |
| onTimeDeliveryCustomer | 准时交付率（联想客户） | 准时交付率(联想客户)、准时交付率(非联想客户) |

**PFP 供应商考核相关**（按业务维度拆分，查看各维度评分明细和排名）
| 页面标识 | 标题 | 适用场景 |
|----------|------|----------|
| pfpKpiWarehouse | ToB物流商KPI评分 | 仓库维度的物流商评分与排名 |
| pfpKpiTransport | 运输物流商KPI评分 | 运输维度的物流商评分与排名 |
| pfpKpiCityDelivery | 城配物流商KPI评分 | 区配/城配/配送维度的评分与排名 |
| pfpKpiCustomer | PFP KPI-客户 | 按客户维度的评分与排名 |
| pfpKpiToC | PFP KPI-ToC | 面向个人消费者(ToC)业务的评分与排名 |
| pfpKpiExpress | PFP KPI-运输快递业务 | 快递业务维度的评分与排名 |

> **智能体中心页面(cargoBanner)** 包含4个AI大脑核心产出（最终报告）：
> - **CDD周报**：运输准时交付率最终报告，含指标定义、达成情况、各维度分析 → \`data({ report: "cddWeeklyReport" })\`
> - **PFP考核**：物流商考核最终报告，含成绩、排名、评级、奖惩 → \`data({ report: "pfpAssessment" })\`
> - **ISG订单预警**：延误、在途、交付三类预警汇总 → \`data({ report: "isgAlert" })\`
> - **签收异常预警**：签收异常和超期情况汇总 → \`data({ report: "signingAlert" })\`
> 
> 只有用户明确要看"报告/总结/周报/考核结果"时才输出这些，想看明细图表请用对应明细页面。

### 深入查询
- \`help({ queryCommand: "filter" })\` 查看筛选参数详情
- \`help({ queryCommand: "action" })\` 查看操作指令详情
- \`help({ queryCommand: "page" })\` 查看可用页面列表
- \`help({ queryCommand: "action", module: "cargoTrend" })\` 查看具体模块的操作`
    
    return overview
  }

  // 根据命令返回详情（带状态感知）
  switch (queryCommand) {
    case 'show': {
      let result = `## show 命令 — 打开看板\n\n`
      
      // 当前状态提示
      result += `### 当前状态\n`
      result += `- **布局**: ${layout}\n`
      if (layout === 'scroll' && currentPage) {
        const pageInfo = getPageByName(currentPage)
        result += `- **当前页面**: ${pageInfo?.title || currentPage}\n`
        result += `> 提示: 当前为 scroll 布局，使用 \`page\` 命令切换页面\n\n`
      } else if (activeModules.length > 0) {
        const moduleNames = activeModules.map(m => moduleTitleMap[m] || m)
        result += `- **显示模块**: ${layout === 'single' ? moduleNames[0] : moduleNames.join('、')}\n\n`
      } else {
        result += `\n`
      }
      
      result += `### 说明
show 命令用于打开看板窗口，默认进入 scroll 布局。

### 示例
\`\`\`
show()  // 打开看板，默认 scroll 布局
\`\`\`

> 提示: 放大展示单个模块请使用 \`layout\` 命令`
      
      return result
    }

    case 'filter': {
      // 查询特定筛选字段的可选值
      if (queryFilter && filterOptions) {
        const fieldMap: Record<string, { label: string; options: string[] }> = {
          fromWarehouse: { label: '始发仓', options: filterOptions.fromWarehouse },
          toProvince: { label: '目的省', options: filterOptions.toProvince },
          toRdc: { label: '目的RDC', options: filterOptions.toRdc },
        }
        const field = fieldMap[queryFilter]
        if (!field) {
          return `未知筛选字段: ${queryFilter}。支持: fromWarehouse, toProvince, toRdc`
        }
        if (field.options.length === 0) {
          return `## ${field.label} 可选值\n\n暂无数据，请先打开看板页面加载选项。`
        }
        return `## ${field.label} 可选值（共 ${field.options.length} 个）\n\n${field.options.join('、')}`
      }

      let result = `## filter 命令 — 设置全局筛选条件

筛选条件对应看板顶部 GlobalFilterBar 的三个下拉框，对所有模块全局生效。
支持多选，传字符串或数组均可。

### 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| filters.fromWarehouse | string / string[] | 始发仓（支持多选） |
| filters.toProvince | string / string[] | 目的省（支持多选） |
| filters.toRdc | string / string[] | 目的RDC（支持多选） |

### 示例
\`\`\`
// 单选
filter({ filters: { fromWarehouse: "广州仓" } })

// 多选
filter({ filters: { fromWarehouse: ["广州仓", "深圳仓"], toProvince: ["广东省", "北京"] } })
\`\`\`

### 重置筛选
传空值、null、空字符串或不传某字段即重置：
\`\`\`
filter({ filters: {} })  // 清空所有筛选
filter({ filters: { fromWarehouse: "广州仓" } })  // 只设始发仓，目的省/目的RDC 清空
filter({ filters: { fromWarehouse: null } })  // 清空始发仓
filter({ filters: { toProvince: "" } })  // 清空目的省
filter({ filters: { fromWarehouse: [] } })  // 清空始发仓（空数组）
\`\`\``

      // 当前筛选状态
      if (currentFilters) {
        const { fromWarehouse, toProvince, toRdc } = currentFilters
        const hasFilters = fromWarehouse.length > 0 || toProvince.length > 0 || toRdc.length > 0
        result += `\n\n### 当前筛选\n`
        if (!hasFilters) {
          result += `无筛选条件`
        } else {
          if (fromWarehouse.length > 0) result += `- **始发仓**: ${fromWarehouse.join('、')}\n`
          if (toProvince.length > 0) result += `- **目的省**: ${toProvince.join('、')}\n`
          if (toRdc.length > 0) result += `- **目的RDC**: ${toRdc.join('、')}\n`
        }
      }

      // 查询可选值提示
      result += `\n\n### 查询可选值\n`
      result += `\`\`\`\nhelp({ queryCommand: "filter", queryFilter: "fromWarehouse" })  // 查询始发仓可选值\nhelp({ queryCommand: "filter", queryFilter: "toProvince" })     // 查询目的省可选值\nhelp({ queryCommand: "filter", queryFilter: "toRdc" })          // 查询目的RDC可选值\n\`\`\``

      return result
    }

    case 'data': {
      let result = `## data 命令 — 获取看板数据\n\n`
      
      // 当前状态提示
      result += `### 当前状态\n`
      result += `- **布局**: ${layout}\n`
      if (layout === 'scroll' && currentPage) {
        const pageInfo = getPageByName(currentPage)
        result += `- **当前页面**: ${pageInfo?.title || currentPage}\n`
        if (pageInfo?.components) {
          const moduleNames = pageInfo.components.map(c => moduleTitleMap[c.name] || c.name)
          result += `- **页面模块**: ${moduleNames.join('、')}\n`
        }
        result += `> 提示: 可用 \`data({ module: "xxx" })\` 获取具体模块数据\n\n`
      } else if (activeModules.length > 0) {
        const moduleNames = activeModules.map(m => moduleTitleMap[m] || m)
        result += `- **显示模块**: ${layout === 'single' ? moduleNames[0] : moduleNames.join('、')}\n\n`
      } else {
        result += `\n`
      }
      
      result += `### 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| module | string | 目标模块名（获取页面模块数据，不指定则返回当前页面概览） |
| report | string | AI大脑报告名（获取最终报告：cddWeeklyReport/pfpAssessment/isgAlert/signingAlert） |

### 智能行为
- 不指定参数 → 返回当前页面概览
- 指定 module → 返回该模块的数据
- 指定 report → 返回AI大脑生成的最终报告
- 根据当前布局自动返回合适的数据格式

### 重要数据（最终报告/总结）vs 明细数据

**获取报告** — 用户想看"最终报告/总结/结论"时使用 \`report\` 参数：
- **CDD 周报**（最终分析报告）：\`data({ report: "cddWeeklyReport" })\`
- **PFP 考核**（最终考核报告）：\`data({ report: "pfpAssessment" })\`
- **ISG 订单预警**（预警汇总）：\`data({ report: "isgAlert" })\`
- **签收异常预警**（异常汇总）：\`data({ report: "signingAlert" })\`

**获取模块数据** — 用户想看"具体图表/趋势/排名细节"时使用 \`module\` 参数：
- 准时交付率趋势图表 → \`data({ module: "warehousingLogistics" })\` 等（先切换到 onTimeDelivery 页面）
- 物流商评分排名明细 → \`data({ module: "tobWarehousingCard" })\` 等（先切换到对应 pfpKpi* 页面）

### 示例
\`\`\`
data()                                    // 当前页面概览
data({ module: "cargoTrend" })            // 货量趋势数据（模块明细）
data({ report: "cddWeeklyReport" })       // CDD 周报（AI大脑报告）
data({ report: "pfpAssessment" })         // PFP 考核（AI大脑报告）
\`\`\``
      
      return result
    }

    case 'status':
      return `## status 命令 — 获取看板当前状态

### 说明
无需参数，返回当前布局、页面、模块信息。

### 使用场景
- 切换布局/页面后确认操作结果
- 不确定当前显示什么时查询

### 示例
\`\`\`
status()
\`\`\``

    case 'action': {
      if (module) {
        const mod = getModuleByName(module)
        if (!mod) {
          return `错误: 未知模块 "${module}"\n\n可用模块: ${Object.values(moduleTitleMap).join('、')}`
        }
        if (!mod.actions || mod.actions.length === 0) {
          return `## ${mod.title} — 无可用操作`
        }
        let result = `## ${mod.title} — 可用操作\n\n`
        result += `| 操作 | 说明 | 参数 |\n|------|------|------|\n`
        for (const action of mod.actions) {
          const params = action.params
            ? Object.entries(action.params).map(([k, v]) => `${k}: ${v.type}`).join(', ')
            : '无'
          result += `| ${action.name} | ${action.description} | ${params} |\n`
        }
        return result
      }

      // 获取当前可见模块中支持操作的模块
      let visibleModules: string[] = []
      if (layout === 'scroll' && currentPage) {
        const pageInfo = getPageByName(currentPage)
        if (pageInfo?.components) {
          visibleModules = pageInfo.components.map(c => c.name)
        }
      } else if (activeModules.length > 0) {
        visibleModules = activeModules
      }

      // 筛选出当前可见且支持操作的模块
      const visibleWithActions = moduleRegistry
        .filter((m: any) => visibleModules.includes(m.name) && m.actions && m.actions.length > 0)
        .map((m: any) => m.title)

      const allModulesWithActions = moduleRegistry
        .filter((m: any) => m.actions && m.actions.length > 0)
        .map((m: any) => m.title)

      let result = `## action 命令 — 触发 UI 操作\n\n`
      
      // 当前状态提示
      result += `### 当前状态\n`
      result += `- **布局**: ${layout}\n`
      if (layout === 'scroll' && currentPage) {
        const pageInfo = getPageByName(currentPage)
        result += `- **当前页面**: ${pageInfo?.title || currentPage}\n`
      } else if (activeModules.length > 0) {
        const moduleNames = activeModules.map(m => moduleTitleMap[m] || m)
        result += `- **显示模块**: ${layout === 'single' ? moduleNames[0] : moduleNames.join('、')}\n`
      }
      
      if (visibleWithActions.length > 0) {
        result += `- **当前可操作模块**: ${visibleWithActions.join('、')}\n\n`
      } else {
        result += `- **当前无模块支持操作**\n\n`
      }

      result += `### 使用流程
1. 先查询：\`help({ queryCommand: "action", module: "xxx" })\`
2. 再执行：根据返回的操作列表执行

### 支持操作的模块（全部）
${allModulesWithActions.join('、')}

### 示例
\`\`\`
action({ module: "signingInformation", action: "setPage", params: { page: 2 } })
\`\`\``
      
      return result
    }

    case 'layout': {
      let result = `## layout 命令 — 切换布局\n\n`
      
      // 当前状态提示
      result += `### 当前状态\n`
      result += `- **当前布局**: ${layout}\n\n`
      
      result += `### 说明
layout 命令用于放大展示、单独显示某个模块查看数据。目前仅支持 single 布局。

### 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| modules | array | 模块列表（必填），取第一个模块全屏显示 |

### 支持的大模块
| 模块名 | 标题 |
|--------|------|
`
      for (const m of LARGE_MODULES) {
        result += `| ${m} | ${moduleTitleMap[m] || m} |\n`
      }
      result += `
### 示例
\`\`\`
layout({ modules: ["cargoTrend"] })  // 全屏显示货量趋势
\`\`\`

> 提示: 切换到 scroll 布局请使用 \`show\` 或 \`page\` 命令`
      
      return result
    }

    case 'page': {
      const pages = getPages()
      let result = `## page 命令 — 切换页面（scroll 布局专用）\n\n`
      
      // 当前状态提示
      result += `### 当前状态\n`
      result += `- **布局**: ${layout}\n`
      if (layout === 'scroll' && currentPage) {
        const pageInfo = getPageByName(currentPage)
        result += `- **当前页面**: ${pageInfo?.title || currentPage}\n\n`
      } else {
        result += `- **当前页面**: 无（非 scroll 布局）\n`
        result += `> 提示: 当前不是 scroll 布局，请先使用 \`show\` 命令打开看板\n\n`
      }
      
      result += `### 参数\n| 参数 | 类型 | 说明 |\n|------|------|------|\n| page | string | 页面名称（必填） |\n\n`
      
      result += `### 说明
page 命令用于在 scroll 布局下切换页面。每个页面是一个独立的全屏视图，包含多个模块。

### 可用页面
| 页面标识 | 标题 | 适用场景 |
|----------|------|----------|
`
      for (const p of pages) {
        const isCurrent = (layout === 'scroll' && p.name === currentPage) ? ' ← 当前' : ''
        let desc = ''
        if (p.name === 'pfpKpiWarehouse') desc = '仓库维度的物流商评分与排名'
        else if (p.name === 'pfpKpiTransport') desc = '运输维度的物流商评分与排名'
        else if (p.name === 'pfpKpiCityDelivery') desc = '区配/城配/配送维度的评分与排名'
        else if (p.name === 'pfpKpiCustomer') desc = '按客户维度的评分与排名'
        else if (p.name === 'pfpKpiToC') desc = '面向个人消费者(ToC)业务的评分与排名'
        else if (p.name === 'pfpKpiExpress') desc = '快递业务维度的评分与排名'
        else if (p.name === 'onTimeDelivery') desc = '准时交付率（整体）'
        else if (p.name === 'onTimeDeliveryCustomer') desc = '准时交付率（联想客户 vs 非联想客户）'
        result += `| ${p.name} | ${p.title}${isCurrent} | ${desc} |\n`
      }
      
      result += `\n### 示例
\`\`\`
page({ page: "cargoBanner" })  // 切换到智能体中心
page({ page: "mapPage" })      // 切换到地图
\`\`\`

> 提示: 放大展示单个模块请使用 \`layout\` 命令`
      
      return result
    }

    case 'close':
      return `## close 命令 — 关闭看板

### 说明
无需参数，直接关闭看板窗口。

### 示例
\`\`\`
close()
\`\`\``

    case 'help':
      return `## help 命令 — 查询命令用法

### 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| queryCommand | string | 要查询的命令名 |
| module | string | 模块名（用于 action 查询） |

### 分层查询
\`\`\`
help()                                        // 命令总览
help({ queryCommand: "filter" })              // filter 参数详情
help({ queryCommand: "action", module: "cargoTrend" })  // 具体模块操作
\`\`\``

    default:
      return `未知命令: "${queryCommand}"`
  }
}
