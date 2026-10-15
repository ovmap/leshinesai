/**
 * layout 命令 — 切换到 single 布局（放大展示单个模块）
 */

import { getModuleNames, getModuleTitleMap, LARGE_MODULES } from '../../../components/dashboard/moduleRegistry'
import type { CommandHandler } from '../types'

const AVAILABLE_MODULES = getModuleNames()
const MODULE_NAMES = getModuleTitleMap()

export const handleLayout: CommandHandler = async (args) => {
  const modules = args?.modules

  // modules 是必须的
  if (!modules || !Array.isArray(modules) || modules.length === 0) {
    return `错误: 请指定 modules 参数（模块列表）`
  }

  // 取第一个模块
  const moduleName = modules[0]

  // 验证模块名
  if (!AVAILABLE_MODULES.includes(moduleName)) {
    return `错误: 未知模块 "${moduleName}"。可用模块: ${AVAILABLE_MODULES.join(', ')}`
  }

  // 只支持大模块
  if (!LARGE_MODULES.includes(moduleName)) {
    return `错误: 模块 "${moduleName}" 不支持 single 布局。支持的大模块: ${LARGE_MODULES.map(m => MODULE_NAMES[m] || m).join('、')}`
  }

  try {
    // 先打开看板窗口
    await window.ipcRenderer.invoke('dashboard:open', {
      modules: [moduleName],
      layout: 'single',
    })

    // 再发送控制命令
    await window.ipcRenderer.invoke('dashboard:control', {
      command: 'layout',
      args: { layout: 'single', modules: [moduleName] },
    })

    const moduleTitle = MODULE_NAMES[moduleName] || moduleName
    return `已切换到 single 布局，全屏显示: ${moduleTitle}`
  } catch (error: any) {
    return `切换布局失败: ${error.message}`
  }
}
