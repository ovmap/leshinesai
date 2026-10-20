/**
 * filter 命令 — 设置全局筛选条件
 * 对应看板顶部 GlobalFilterBar 的三个下拉框：始发仓、目的省、目的RDC
 */

import type { CommandHandler } from '../types'

export const handleFilter: CommandHandler = async (args) => {
  const filters = args?.filters

  // 检查是否为重置筛选操作
  const isReset = !filters || Object.keys(filters).length === 0

  try {
    // 确保看板窗口已打开
    await window.ipcRenderer.invoke('dashboard:open', {})

    const result = await window.ipcRenderer.invoke('dashboard:control', {
      command: 'filter',
      args: { filters: filters || {} },
    })

    if (!result.success) {
      return `筛选失败: ${result.error}`
    }

    // 重置筛选的提示
    if (isReset) {
      return '已清空所有筛选条件'
    }

    const filterDesc = Object.entries(filters)
      .map(([k, v]) => {
        // 处理 null、空字符串和数组
        if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
          return `${k}=已清空`
        }
        return `${k}=${Array.isArray(v) ? v.join(',') : v}`
      })
      .join(', ')
    return `全局筛选已应用: ${filterDesc}`
  } catch (error: any) {
    return `设置筛选失败: ${error.message}`
  }
}
