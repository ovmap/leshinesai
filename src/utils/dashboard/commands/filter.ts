/**
 * filter 命令 — 设置全局筛选条件
 * 对应看板顶部 GlobalFilterBar 的三个下拉框：始发仓、目的省、目的RDC
 */

import type { CommandHandler } from '../types'

export const handleFilter: CommandHandler = async (args) => {
  if (!args?.filters || Object.keys(args.filters).length === 0) {
    return '错误: filter 命令需要 filters 参数，例如 { "fromWarehouse": "天津宁河CDC" }'
  }

  const filters = args.filters

  try {
    // 确保看板窗口已打开
    await window.ipcRenderer.invoke('dashboard:open', {})

    const result = await window.ipcRenderer.invoke('dashboard:control', {
      command: 'filter',
      args: { filters },
    })

    if (!result.success) {
      return `筛选失败: ${result.error}`
    }

    const filterDesc = Object.entries(filters)
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`)
      .join(', ')
    return `全局筛选已应用: ${filterDesc}`
  } catch (error: any) {
    return `设置筛选失败: ${error.message}`
  }
}
