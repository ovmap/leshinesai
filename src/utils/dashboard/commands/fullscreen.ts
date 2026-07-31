/**
 * fullscreen 命令 — 切换全屏
 */

import type { CommandHandler } from '../types'

export const handleFullscreen: CommandHandler = async (args) => {
  const action = args?.action // 'enter' | 'exit' | 'toggle'

  try {
    // 确保看板窗口已打开
    await window.ipcRenderer.invoke('dashboard:open', {})

    const result = await window.ipcRenderer.invoke('dashboard:control', {
      command: 'fullscreen',
      args: { action: action || 'toggle' },
    })

    if (!result.success) {
      return `全屏操作失败: ${result.error}`
    }

    if (result.isFullscreen) {
      return '已进入全屏'
    } else {
      return '已退出全屏'
    }
  } catch (error: any) {
    return `全屏操作失败: ${error.message}`
  }
}
