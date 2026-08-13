/**
 * action 命令 — 触发 UI 操作
 */

import { getModuleNames, getModuleTitleMap, getModuleByName } from '../../../components/dashboard/moduleRegistry'
import type { CommandHandler } from '../types'

const AVAILABLE_MODULES = getModuleNames()
const MODULE_NAMES = getModuleTitleMap()

export const handleAction: CommandHandler = async (args) => {
  if (!args?.module) {
    return '错误: action 命令需要 module 参数'
  }

  const { module, action, params } = args

  if (!AVAILABLE_MODULES.includes(module)) {
    return `错误: 未知模块 "${module}"。可用模块: ${AVAILABLE_MODULES.join(', ')}`
  }

  // 查询模块的可用 actions
  if (!action || action === 'list' || action === 'help') {
    const moduleMeta = getModuleByName(module)
    if (!moduleMeta?.actions || moduleMeta.actions.length === 0) {
      return `模块 [${MODULE_NAMES[module] || module}] 暂无专属指令`
    }

    let result = `## 模块 [${MODULE_NAMES[module] || module}] 的可用指令\n\n`
    moduleMeta.actions.forEach(act => {
      result += `### ${act.name}\n`
      result += `${act.description}\n\n`
      
      if (act.params && Object.keys(act.params).length > 0) {
        result += `**参数:**\n`
        Object.entries(act.params).forEach(([paramName, paramDef]) => {
          const required = paramDef.required ? '（必填）' : '（可选）'
          result += `- \`${paramName}\`: ${paramDef.type} - ${paramDef.description} ${required}\n`
        })
        result += '\n'
      }
      
      result += `**调用示例:**\n\`\`\`json\n`
      result += `dashboard_command({\n  command: 'action',\n  args: {\n    module: '${module}',\n    action: '${act.name}'`
      
      if (act.params && Object.keys(act.params).length > 0) {
        result += `,\n    params: { `
        const exampleParams = Object.entries(act.params)
          .filter(([_, def]) => def.required)
          .map(([name, def]) => `${name}: <${def.type}>`)
          .join(', ')
        result += exampleParams || '...'
        result += ` }\n`
      } else {
        result += `\n`
      }
      
      result += `  }\n})\n\`\`\`\n\n`
    })
    
    return result
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
