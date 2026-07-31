/**
 * Dashboard CLI 类型定义
 */

/** 命令处理函数类型 */
export type CommandHandler = (args?: Record<string, any>) => Promise<string>

/** 命令注册项 */
export interface CommandRegistration {
  name: string
  description: string
  handler: CommandHandler
}

/** 命令执行结果 */
export interface CommandResult {
  success: boolean
  message: string
  data?: any
}
