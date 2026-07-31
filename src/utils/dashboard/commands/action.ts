/**
 * action 命令 — 触发 UI 操作
 */

import { getModuleNames, getModuleTitleMap } from '../../../components/dashboard/moduleRegistry'
import type { CommandHandler } from '../types'

const AVAILABLE_MODULES = getModuleNames()
const MODULE_NAMES = getModuleTitleMap()

export const handleAction: CommandHandler = async (args) => {
  if (!args?.module || !args?.action) {
    return '错误: action 命令需要 module 和 action 参数'
  }

  const { module, action, params } = args

  if (!AVAILABLE_MODULES.includes(module)) {
    return `错误: 未知模块 "${module}"。可用模块: ${AVAILABLE_MODULES.join(', ')}`
  }

  try {
    // 确保看板窗口已打开
    await window.ipcRenderer.invoke('dashboard:open', {
      modules: [module],
    })

    const result = await window.ipcRenderer.invoke('dashboard:control', {
      command: 'action',
      args: { module, action, params },
    })

    if (!result.success) {
      return `操作失败: ${result.error}`
    }

    return `操作 [${action}] 已发送到模块 [${MODULE_NAMES[module] || module}]`
  } catch (error: any) {
    return `执行操作失败: ${error.message}`
  }
}
