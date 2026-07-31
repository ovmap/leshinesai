/**
 * show 命令 — 显示/切换模块
 */

import { getModuleNames, getModuleTitleMap } from '../../../components/dashboard/moduleRegistry'
import type { CommandHandler } from '../types'

const AVAILABLE_MODULES = getModuleNames()
const MODULE_NAMES = getModuleTitleMap()

// 大模块（支持 single/grid/cards 布局）
const LARGE_MODULES = [
  'energyPrices',
  'abnormalTransportation',
  'capacityPool',
  'urgentCustomer',
  'majorEvents',
  'cargoTrend',
  'signingInformation',
  'reorderProgress',
]

// grid/cards 布局最多支持的模块数
const MAX_GRID_MODULES = 3

export const handleShow: CommandHandler = async (args) => {
  const modules = args?.modules || AVAILABLE_MODULES
  const layout = args?.layout || 'scroll'

  // 验证模块名
  const validModules = modules.filter((m: string) => AVAILABLE_MODULES.includes(m))
  if (validModules.length === 0) {
    return `错误: 没有有效的模块。可用模块: ${AVAILABLE_MODULES.join(', ')}`
  }

  // single/grid/cards 布局只支持大模块
  if (layout === 'single' || layout === 'grid' || layout === 'cards') {
    const unsupported = validModules.filter((m: string) => !LARGE_MODULES.includes(m))
    if (unsupported.length > 0) {
      const names = unsupported.map((m: string) => MODULE_NAMES[m] || m).join('、')
      return `错误: 以下模块不支持 ${layout} 布局: ${names}。支持的模块: ${LARGE_MODULES.map(m => MODULE_NAMES[m] || m).join('、')}`
    }
  }

  // grid/cards 布局最多 3 个模块
  if ((layout === 'grid' || layout === 'cards') && validModules.length > MAX_GRID_MODULES) {
    return `错误: ${layout} 布局最多支持 ${MAX_GRID_MODULES} 个模块，当前指定了 ${validModules.length} 个`
  }

  try {
    // 先打开看板窗口（如果不存在会创建，已存在会发送 update）
    await window.ipcRenderer.invoke('dashboard:open', {
      modules: validModules,
      layout,
    })

    // 再发送控制命令
    await window.ipcRenderer.invoke('dashboard:control', {
      command: 'show',
      args: { modules: validModules, layout },
    })

    const moduleNames = validModules.map((m: string) => MODULE_NAMES[m] || m).join('、')
    return `看板已更新: 显示 [${moduleNames}], 布局: ${layout}`
  } catch (error: any) {
    return `打开看板失败: ${error.message}`
  }
}
