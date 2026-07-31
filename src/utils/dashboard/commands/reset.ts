/**
 * reset 命令 — 重置筛选
 */

import { getModuleTitleMap } from '../../../components/dashboard/moduleRegistry'
import type { CommandHandler } from '../types'

const MODULE_NAMES = getModuleTitleMap()

export const handleReset: CommandHandler = async (args) => {
  const module = args?.module

  try {
    const result = await window.ipcRenderer.invoke('dashboard:control', {
      command: 'reset',
      args: { module },
    })

    if (!result.success) {
      return `重置失败: ${result.error}`
    }

    const target = module ? `模块 [${MODULE_NAMES[module] || module}]` : '所有模块'
    return `已重置${target}的筛选条件`
  } catch (error: any) {
    return `重置失败: ${error.message}`
  }
}
