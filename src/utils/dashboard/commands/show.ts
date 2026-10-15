/**
 * show 命令 — 打开看板（默认 scroll 布局）
 */

import type { CommandHandler } from '../types'

export const handleShow: CommandHandler = async () => {
  try {
    await window.ipcRenderer.invoke('dashboard:open', {
      layout: 'scroll',
    })

    return '看板已打开，默认 scroll 布局。使用 page 命令切换页面。'
  } catch (error: any) {
    return `打开看板失败: ${error.message}`
  }
}
