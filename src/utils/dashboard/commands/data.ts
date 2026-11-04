/**
 * data 命令 — 获取看板数据（返回 Markdown）
 * 
 * 两种用法：
 * - data({ module: "xxx" }) — 获取页面模块的数据
 * - data({ report: "xxx" }) — 获取 AI 大脑报告（cddWeeklyReport/pfpAssessment/isgAlert/signingAlert）
 */

import { getModuleNames } from '../../../components/dashboard/moduleRegistry'
import type { CommandHandler } from '../types'

const AVAILABLE_MODULES = getModuleNames()

// AI 大脑报告（从 cargoBanner 数据中提取）
const AVAILABLE_REPORTS = ['cddWeeklyReport', 'pfpAssessment', 'isgAlert', 'signingAlert']

export const handleData: CommandHandler = async (args) => {
  const module = args?.module
  const report = args?.report

  // 如果同时传了 module 和 report，优先 report
  if (report) {
    if (!AVAILABLE_REPORTS.includes(report)) {
      return `错误: 未知报告 "${report}"。可用报告: ${AVAILABLE_REPORTS.join(', ')}`
    }
    try {
      const result = await window.ipcRenderer.invoke('dashboard:data', {
        report, // 用 report 参数传递，区别于 module
      })

      if (!result.success) {
        return `获取报告失败: ${result.error}`
      }

      return result.data || '暂无数据'
    } catch (error: any) {
      return `获取报告失败: ${error.message}`
    }
  }

  if (module) {
    if (!AVAILABLE_MODULES.includes(module)) {
      return `错误: 未知模块 "${module}"。可用模块: ${AVAILABLE_MODULES.join(', ')}`
    }

    try {
      const result = await window.ipcRenderer.invoke('dashboard:data', {
        module,
      })

      if (!result.success) {
        return `获取数据失败: ${result.error}`
      }

      return result.data || '暂无数据'
    } catch (error: any) {
      return `获取数据失败: ${error.message}`
    }
  }

  // 都没传，获取当前页面概览
  try {
    const result = await window.ipcRenderer.invoke('dashboard:data', {})

    if (!result.success) {
      return `获取数据失败: ${result.error}`
    }

    return result.data || '暂无数据'
  } catch (error: any) {
    return `获取数据失败: ${error.message}`
  }
}
