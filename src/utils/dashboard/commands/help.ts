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
  currentState?: { layout: string; currentPage: string; activeModules: string[] }
): string {
  const layout = currentState?.layout || 'scroll'
  const currentPage = currentState?.currentPage || ''
  const activeModules = currentState?.activeModules || []
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
| reset | 重置筛选 | 清除所有筛选条件 |
| layout | 切换布局 | single/grid/cards/scroll |
| page | 切换页面 | 12个页面间切换 |
| close | 关闭看板 | 结束使用 |
| help | 查询命令用法 | 不确定参数时查询 |

### 快速开始
1. 打开看板：\`show\`
2. 查看数据：\`data\`
3. 筛选：\`filter\` + 条件
4. 不确定当前状态？用 \`status\`
5. 不确定参数？用 \`help\`

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
      const largeModules = LARGE_MODULES.map(m => moduleTitleMap[m] || m)
      
      let result = `## show 命令 — 显示/切换模块\n\n`
      
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
      
      result += `### 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| modules | array | 模块名称列表 |

### 布局与模块的关系
- **single 布局**：与大模块对应，单个模块全屏显示，仅支持大模块
- **scroll 布局**：与页面对应，每个页面包含多个模块，用 \`page\` 命令切换

### 大模块（支持 single）
| 模块名 | 标题 |
|--------|------|
`
      for (const m of LARGE_MODULES) {
        result += `| ${m} | ${moduleTitleMap[m] || m} |\n`
      }
      result += `
### 示例
\`\`\`
show({ modules: ["cargoTrend"] })           // single 全屏货量趋势
\`\`\``
      
      return result
    }

    case 'filter':
      return `## filter 命令 — 设置筛选条件

### 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| module | string | 目标模块（对哪个模块生效） |
| filters.fromWarehouse | string | 始发仓 |
| filters.toProvince | string | 目的省 |
| filters.toRdc | string | 目的RDC |
| filters.modeType | string | 配送模式：区配/直送 |
| filters.timeType | string | 时间维度 |
| filters.dateRange | string | 日期范围：YYYY-MM-DD ~ YYYY-MM-DD |
| filters.dataSource | array | 数据源列表 |
| filters.metric | string | 指标类型 |

### 时间维度枚举
- CALENDAR_YEAR — 自然年
- FICAL_YEAR — 财年
- MONTH — 月
- WEEK — 周
- DAY — 日

### 指标类型枚举
- VOLUME — 订单数量
- WEIGHT — 重量
- VOLUME_SIZE — 体积

### 示例
\`\`\`
filter({
  module: "cargoTrend",
  filters: {
    fromWarehouse: "广州仓",
    timeType: "MONTH"
  }
})
\`\`\``

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
| module | string | 目标模块（不指定则返回当前页面概览） |
| format | string | 数据格式：markdown / json（默认 markdown） |
| scope | string | 数据范围：summary / detail / full（默认 summary） |

### 数据范围说明
- **summary** — 摘要信息
- **detail** — 明细数据
- **full** — 完整数据

### 智能行为
- 不指定 module → 返回当前页面概览
- single 布局下 summary → 自动提升到 detail

### 示例
\`\`\`
data()                                    // 当前页面概览
data({ module: "cargoTrend" })            // 货量趋势摘要
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

    case 'reset':
      return `## reset 命令 — 重置筛选条件

### 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| module | string | 目标模块（不指定则重置所有） |

### 示例
\`\`\`
reset({ module: "cargoTrend" })
\`\`\``

    case 'layout': {
      let result = `## layout 命令 — 切换布局\n\n`
      
      // 当前状态提示
      result += `### 当前状态\n`
      result += `- **当前布局**: ${layout}\n\n`
      
      result += `### 参数
| 参数 | 类型 | 说明 |
|------|------|------|
| layout | string | 布局名称（必填） |

### 布局类型
| 布局 | 说明 |
|------|------|
| single | 单模块全屏 |
| grid | 网格布局 |
| cards | 卡片布局 |
| scroll | 滚动页面 |

### 示例
\`\`\`
layout({ layout: "single" })
\`\`\``
      
      return result
    }

    case 'page': {
      const pages = getPages()
      const largeModules = LARGE_MODULES.map(m => moduleTitleMap[m] || m)
      let result = `## page 命令 — 切换页面\n\n`
      
      // 当前状态提示
      result += `### 当前状态\n`
      result += `- **布局**: ${layout}\n`
      if (layout === 'scroll' && currentPage) {
        const pageInfo = getPageByName(currentPage)
        result += `- **当前页面**: ${pageInfo?.title || currentPage}\n\n`
      } else {
        result += `- **当前页面**: 无（非 scroll 布局）\n\n`
      }
      
      result += `### 参数\n| 参数 | 类型 | 说明 |\n|------|------|------|\n| page | string | 页面名称（必填） |\n\n`
      
      result += `### 布局与页面/模块的关系
- **scroll 布局**：与页面对应，每个页面包含多个模块，用 \`page\` 命令切换
- **single 布局**：与大模块对应，单个模块全屏显示，用 \`show\` 命令切换

### 可用页面（scroll 布局）
| 页面标识 | 标题 |
|----------|------|
`
      for (const p of pages) {
        const isCurrent = (layout === 'scroll' && p.name === currentPage) ? ' ← 当前' : ''
        result += `| ${p.name} | ${p.title}${isCurrent} |\n`
      }
      
      result += `\n### 大模块（single 布局）
single 布局用于放大、全屏显示单个模块，仅支持以下大模块：
| 模块名 | 标题 |
|--------|------|
`
      for (const m of LARGE_MODULES) {
        result += `| ${m} | ${moduleTitleMap[m] || m} |\n`
      }
      
      result += `\n### 示例
\`\`\`
page({ page: "cargoBanner" })    // 切换到智能体中心（scroll 布局）
show({ modules: ["cargoTrend"] }) // 货量趋势全屏（single 布局）
\`\`\``
      
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
