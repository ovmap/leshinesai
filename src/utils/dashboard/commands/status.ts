/**
 * status 命令 — 获取看板当前状态（布局、页面、模块）
 * 用于 AI 切换布局/页面后确认操作结果
 */

import type { CommandHandler } from '../types'

export const handleStatus: CommandHandler = async () => {
  try {
    const result = await window.ipcRenderer.invoke('dashboard:get-status')

    if (!result.success) {
      return `获取状态失败: ${result.error}`
    }

    return result.data || '暂无状态信息'
  } catch (error: any) {
    return `获取状态失败: ${error.message}`
  }
}
