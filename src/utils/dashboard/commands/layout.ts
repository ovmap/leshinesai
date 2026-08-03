/**
 * layout 命令 — 切换布局
 */

import { getModuleTitleMap, LARGE_MODULES } from '../../../components/dashboard/moduleRegistry'
import type { CommandHandler } from '../types'

const VALID_LAYOUTS = ['single', 'grid', 'cards', 'scroll']

// grid/cards 布局最多支持的模块数
const MAX_GRID_MODULES = 3

const MODULE_NAMES = getModuleTitleMap()

export const handleLayout: CommandHandler = async (args) => {
  const layout = args?.layout || 'grid'
  const modules = args?.modules

  if (!VALID_LAYOUTS.includes(layout)) {
    return `错误: 无效布局 "${layout}"。可选: ${VALID_LAYOUTS.join(', ')}`
  }

  // single/grid/cards 布局校验：如果指定了模块，检查是否都支持
  if ((layout === 'single' || layout === 'grid' || layout === 'cards') && modules?.length) {
    const unsupported = modules.filter((m: string) => !LARGE_MODULES.includes(m))
    if (unsupported.length > 0) {
      const names = unsupported.map((m: string) => MODULE_NAMES[m] || m).join('、')
      return `错误: 以下模块不支持 ${layout} 布局: ${names}。支持的模块: ${LARGE_MODULES.map(m => MODULE_NAMES[m] || m).join('、')}`
    }
  }

  // grid/cards 布局最多 3 个模块
  if ((layout === 'grid' || layout === 'cards') && modules?.length > MAX_GRID_MODULES) {
    return `错误: ${layout} 布局最多支持 ${MAX_GRID_MODULES} 个模块，当前指定了 ${modules.length} 个`
  }

  try {
    const result = await window.ipcRenderer.invoke('dashboard:control', {
      command: 'layout',
      args: { layout, modules },
    })

    if (!result.success) {
      return `切换布局失败: ${result.error}`
    }

    return `布局已切换为: ${layout}`
  } catch (error: any) {
    return `切换布局失败: ${error.message}`
  }
}
