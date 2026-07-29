/**
 * Dashboard CLI 命令执行器（主窗口侧）
 * 
 * 解析 AI 的 dashboard_command 调用，路由到对应 handler，
 * 通过 IPC 与看板窗口通信。
 */

import { getModuleNames, getModuleTitleMap } from '../components/dashboard/moduleRegistry'

// 从统一注册表动态获取
const AVAILABLE_MODULES = getModuleNames()
const MODULE_NAMES = getModuleTitleMap()

/**
 * 执行 CLI 命令，返回结果字符串给 AI
 */
export async function executeDashboardCommand(args: {
  command: string
  args?: Record<string, any>
}): Promise<string> {
  const { command, args: cmdArgs } = args

  switch (command) {
    case 'show':
      return await handleShow(cmdArgs)
    case 'filter':
      return await handleFilter(cmdArgs)
    case 'data':
      return await handleData(cmdArgs)
    case 'action':
      return await handleAction(cmdArgs)
    case 'reset':
      return await handleReset(cmdArgs)
    case 'layout':
      return await handleLayout(cmdArgs)
    case 'close':
      return await handleClose()
    default:
      return `未知命令: "${command}"。可用命令: show, filter, data, action, reset, layout, close`
  }
}

/**
 * show — 显示/切换模块
 */
async function handleShow(args?: Record<string, any>): Promise<string> {
  const modules = args?.modules || AVAILABLE_MODULES
  const layout = args?.layout || 'grid'

  // 验证模块名
  const validModules = modules.filter((m: string) => AVAILABLE_MODULES.includes(m))
  if (validModules.length === 0) {
    return `错误: 没有有效的模块。可用模块: ${AVAILABLE_MODULES.join(', ')}`
  }

  try {
    // 先打开看板窗口（如果不存在会创建，已存在会发送 update）
    await window.ipcRenderer.invoke('dashboard:open', {
      modules: validModules,
      layout,
    })

    // 再发送控制命令
    await window.ipcRenderer.invoke('dashboard:control', {
      command: 'show',
      args: { modules: validModules, layout },
    })

    const moduleNames = validModules.map((m: string) => MODULE_NAMES[m] || m).join('、')
    return `看板已更新: 显示 [${moduleNames}], 布局: ${layout}`
  } catch (error: any) {
    return `打开看板失败: ${error.message}`
  }
}

/**
 * filter — 设置筛选条件
 */
async function handleFilter(args?: Record<string, any>): Promise<string> {
  if (!args?.filters || Object.keys(args.filters).length === 0) {
    return '错误: filter 命令需要 filters 参数，例如 { "fromWarehouse": "天津宁河CDC" }'
  }

  const module = args.module
  const filters = args.filters

  // 如果指定了模块但模块不在可用列表中
  if (module && !AVAILABLE_MODULES.includes(module)) {
    return `错误: 未知模块 "${module}"。可用模块: ${AVAILABLE_MODULES.join(', ')}`
  }

  try {
    // 确保看板窗口已打开
    await window.ipcRenderer.invoke('dashboard:open', {
      modules: module ? [module] : AVAILABLE_MODULES,
    })

    const result = await window.ipcRenderer.invoke('dashboard:control', {
      command: 'filter',
      args: { module, filters },
    })

    if (!result.success) {
      return `筛选失败: ${result.error}`
    }

    const filterDesc = Object.entries(filters)
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`)
      .join(', ')
    const target = module ? `模块 [${MODULE_NAMES[module] || module}]` : '所有模块'
    return `筛选已应用到${target}: ${filterDesc}`
  } catch (error: any) {
    return `设置筛选失败: ${error.message}`
  }
}

/**
 * data — 获取看板数据（返回 Markdown）
 */
async function handleData(args?: Record<string, any>): Promise<string> {
  const module = args?.module
  const format = args?.format || 'markdown'
  const scope = args?.scope || 'summary'

  if (module && !AVAILABLE_MODULES.includes(module)) {
    return `错误: 未知模块 "${module}"。可用模块: ${AVAILABLE_MODULES.join(', ')}`
  }

  try {
    const result = await window.ipcRenderer.invoke('dashboard:get-data', {
      module,
      format,
      scope,
    })

    if (!result.success) {
      return `获取数据失败: ${result.error}`
    }

    return result.data || '暂无数据'
  } catch (error: any) {
    return `获取数据失败: ${error.message}`
  }
}

/**
 * action — 触发 UI 操作
 */
async function handleAction(args?: Record<string, any>): Promise<string> {
  if (!args?.module || !args?.action) {
    return '错误: action 命令需要 module 和 action 参数'
  }

  const { module, action, params } = args

  if (!AVAILABLE_MODULES.includes(module)) {
    return `错误: 未知模块 "${module}"。可用模块: ${AVAILABLE_MODULES.join(', ')}`
  }

  try {
    // 确保看板窗口已打开
    await window.ipcRenderer.invoke('dashboard:open', {
      modules: [module],
    })

    const result = await window.ipcRenderer.invoke('dashboard:control', {
      command: 'action',
      args: { module, action, params },
    })

    if (!result.success) {
      return `操作失败: ${result.error}`
    }

    return `操作 [${action}] 已发送到模块 [${MODULE_NAMES[module] || module}]`
  } catch (error: any) {
    return `执行操作失败: ${error.message}`
  }
}

/**
 * reset — 重置筛选
 */
async function handleReset(args?: Record<string, any>): Promise<string> {
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

/**
 * layout — 切换布局
 */
async function handleLayout(args?: Record<string, any>): Promise<string> {
  const layout = args?.layout || 'grid'
  const validLayouts = ['single', 'grid', 'cards', 'scroll']

  if (!validLayouts.includes(layout)) {
    return `错误: 无效布局 "${layout}"。可选: ${validLayouts.join(', ')}`
  }

  try {
    const result = await window.ipcRenderer.invoke('dashboard:control', {
      command: 'layout',
      args: { layout },
    })

    if (!result.success) {
      return `切换布局失败: ${result.error}`
    }

    return `布局已切换为: ${layout}`
  } catch (error: any) {
    return `切换布局失败: ${error.message}`
  }
}

/**
 * close — 关闭看板
 */
async function handleClose(): Promise<string> {
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
