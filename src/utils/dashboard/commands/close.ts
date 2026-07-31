/**
 * close 命令 — 关闭看板
 */

import type { CommandHandler } from '../types'

export const handleClose: CommandHandler = async () => {
  try {
    const result = await window.ipcRenderer.invoke('dashboard:close')
    if (result.success) {
      return '看板已关闭'
    }
    return '关闭看板失败'
  } catch (error: any) {
    return `关闭看板失败: ${error.message}`
  }
}
