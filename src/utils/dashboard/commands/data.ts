/**
 * data 命令 — 获取看板数据（返回 Markdown）
 */

import { getModuleNames } from '../../../components/dashboard/moduleRegistry'
import type { CommandHandler } from '../types'

const AVAILABLE_MODULES = getModuleNames()

// 特殊虚拟模块（从 cargoBanner 数据中提取，不在 moduleRegistry 中注册）
const VIRTUAL_MODULES = ['cddWeeklyReport', 'pfpAssessment']

export const handleData: CommandHandler = async (args) => {
  const module = args?.module

  if (module && !AVAILABLE_MODULES.includes(module) && !VIRTUAL_MODULES.includes(module)) {
    return `错误: 未知模块 "${module}"。可用模块: ${AVAILABLE_MODULES.join(', ')}`
  }

  try {
    const result = await window.ipcRenderer.invoke('dashboard:data', {
      module,
    })

    if (!result.success) {
      return `获取数据失败: ${result.error}`
    }

    return result.data || '暂无数据'
  } catch (error: any) {
    return `获取数据失败: ${error.message}`
  }
}
