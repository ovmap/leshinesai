/**
 * data 命令 — 获取看板数据（返回 Markdown）
 */

import { getModuleNames } from '../../../components/dashboard/moduleRegistry'
import type { CommandHandler } from '../types'

const AVAILABLE_MODULES = getModuleNames()

export const handleData: CommandHandler = async (args) => {
  const module = args?.module
  const format = args?.format || 'markdown'
  const scope = args?.scope || 'summary'

  if (module && !AVAILABLE_MODULES.includes(module)) {
    return `错误: 未知模块 "${module}"。可用模块: ${AVAILABLE_MODULES.join(', ')}`
  }

  try {
    const result = await window.ipcRenderer.invoke('dashboard:data', {
      module,
      format,
      scope,
    })

    if (!result.success) {
      return `获取数据失败: ${result.error}`
    }

    return result.data || '暂无数据'
  } catch (error: any) {
    return `获取数据失败: ${error.message}`
  }
}
