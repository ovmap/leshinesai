/**
 * Dashboard CLI 命令执行器（主窗口侧）
 *
 * 解析 AI 的 dashboard_command 调用，路由到对应 handler，
 * 通过 IPC 与看板窗口通信。
 *
 * 扩展新命令：
 * 1. 在 commands/ 目录下创建新文件
 * 2. 导出 CommandHandler 类型的处理函数
 * 3. 在本文件的 commandRegistry 中注册
 */

import type { CommandHandler, CommandRegistration } from './types'
import { handleShow } from './commands/show'
import { handleFilter } from './commands/filter'
import { handleData } from './commands/data'
import { handleAction } from './commands/action'
import { handleLayout } from './commands/layout'
import { handlePage } from './commands/page'
import { handleClose } from './commands/close'
import { handleStatus } from './commands/status'
import { handleHelp } from './commands/help'

/**
 * 命令注册表 — 新增命令只需在此添加
 */
const commandRegistry: CommandRegistration[] = [
  {
    name: 'show',
    description: '显示/切换模块',
    handler: handleShow,
  },
  {
    name: 'filter',
    description: '设置筛选条件',
    handler: handleFilter,
  },
  {
    name: 'data',
    description: '获取看板数据（返回 Markdown）',
    handler: handleData,
  },
  {
    name: 'status',
    description: '获取看板当前状态（布局、页面、模块）',
    handler: handleStatus,
  },
  {
    name: 'action',
    description: '触发 UI 操作',
    handler: handleAction,
  },
  {
    name: 'layout',
    description: '切换布局（single/grid/cards/scroll）',
    handler: handleLayout,
  },
  {
    name: 'page',
    description: '切换页面',
    handler: handlePage,
  },
  {
    name: 'help',
    description: '查询命令用法（分层帮助）',
    handler: handleHelp,
  },
  {
    name: 'close',
    description: '关闭看板',
    handler: handleClose,
  },
]

/** 命令名 → 处理函数映射 */
const commandMap = new Map<string, CommandHandler>(
  commandRegistry.map(cmd => [cmd.name, cmd.handler]),
)

/**
 * 执行 CLI 命令，返回结果字符串给 AI
 */
export async function executeDashboardCommand(args: {
  command: string
  args?: Record<string, any>
}): Promise<string> {
  const { command, args: cmdArgs } = args

  const handler = commandMap.get(command)
  if (!handler) {
    const availableCommands = commandRegistry.map(c => c.name).join(', ')
    return `未知命令: "${command}"。可用命令: ${availableCommands}`
  }

  return await handler(cmdArgs)
}

/**
 * 获取所有可用命令列表（供 AI 参考）
 */
export function getAvailableCommands(): { name: string; description: string }[] {
  return commandRegistry.map(({ name, description }) => ({ name, description }))
}

// 导出类型供外部使用
export type { CommandHandler, CommandRegistration } from './types'
