/**
 * filter 命令 — 设置筛选条件
 */

import { getModuleNames, getModuleTitleMap } from '../../../components/dashboard/moduleRegistry'
import type { CommandHandler } from '../types'

const AVAILABLE_MODULES = getModuleNames()
const MODULE_NAMES = getModuleTitleMap()

export const handleFilter: CommandHandler = async (args) => {
  if (!args?.filters || Object.keys(args.filters).length === 0) {
    return '错误: filter 命令需要 filters 参数，例如 { "fromWarehouse": "天津宁河CDC" }'
  }

  const module = args.module
  const filters = args.filters

  // 如果指定了模块但模块不在可用列表中
  if (module && !AVAILABLE_MODULES.includes(module)) {
    return `错误: 未知模块 "${module}"。可用模块: ${AVAILABLE_MODULES.join(', ')}`
  }

  try {
    // 确保看板窗口已打开
    await window.ipcRenderer.invoke('dashboard:open', {
      modules: module ? [module] : AVAILABLE_MODULES,
    })

    const result = await window.ipcRenderer.invoke('dashboard:control', {
      command: 'filter',
      args: { module, filters },
    })

    if (!result.success) {
      return `筛选失败: ${result.error}`
    }

    const filterDesc = Object.entries(filters)
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`)
      .join(', ')
    const target = module ? `模块 [${MODULE_NAMES[module] || module}]` : '所有模块'
    return `筛选已应用到${target}: ${filterDesc}`
  } catch (error: any) {
    return `设置筛选失败: ${error.message}`
  }
}
