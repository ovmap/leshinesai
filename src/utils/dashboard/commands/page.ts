/**
 * page 命令 — 切换页面
 */

import { getPages } from '../../../components/dashboard/moduleRegistry'
import type { CommandHandler } from '../types'

const AVAILABLE_PAGES = getPages()

export const handlePage: CommandHandler = async (args) => {
  const page = args?.page

  if (!page) {
    const pageList = AVAILABLE_PAGES.map(p => `${p.name}(${p.title})`).join(', ')
    return `错误: 请指定页面。可用页面: ${pageList}`
  }

  const validPage = AVAILABLE_PAGES.find(p => p.name === page)
  if (!validPage) {
    const pageList = AVAILABLE_PAGES.map(p => `${p.name}(${p.title})`).join(', ')
    return `错误: 无效页面 "${page}"。可用页面: ${pageList}`
  }

  try {
    // 确保看板窗口已打开
    await window.ipcRenderer.invoke('dashboard:open', {})

    // 先切换到 scroll 布局（page 命令依赖 scroll 布局）
    await window.ipcRenderer.invoke('dashboard:control', {
      command: 'layout',
      args: { layout: 'scroll' },
    })

    // 再切换页面
    const result = await window.ipcRenderer.invoke('dashboard:control', {
      command: 'page',
      args: { page },
    })

    if (!result.success) {
      return `切换页面失败: ${result.error}`
    }

    return `页面已切换为: ${validPage.title}`
  } catch (error: any) {
    return `切换页面失败: ${error.message}`
  }
}
