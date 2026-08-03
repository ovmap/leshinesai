/**
 * 看板模块 Markdown 格式化函数统一出口
 * 
 * 每个模块一个文件，导出格式化函数。
 * 新增模块时，在此文件中注册即可。
 */

import { formatCargoVolume } from './cargoVolume'
import { formatOnTime } from './onTime'
import { formatEndToEnd } from './endToEnd'
import { formatEnergyPricesCard } from './energyPricesCard'
import { formatUnitPrice } from './unitPrice'
import { formatDryPrice } from './dryPrice'
import { formatEnergyPrices } from './energyPrices'
import { formatAbnormalTransportation } from './abnormalTransportation'
import { formatCapacityPool } from './capacityPool'
import { formatUrgentCustomer } from './urgentCustomer'
import { formatMajorEvents } from './majorEvents'
import { formatReorderProgress } from './reorderProgress'
import { formatCargoTrend } from './cargoTrend'
import { formatSigningInformation } from './signingInformation'

/**
 * 模块格式化函数注册表
 * key: 模块名（对应 moduleRegistry 中的 name）
 * value: 格式化函数 (data, scope) => string
 */
export const formatters: Record<string, (data: any, scope: string) => string> = {
  cargoVolume: formatCargoVolume,
  onTime: formatOnTime,
  endToEnd: formatEndToEnd,
  energyPricesCard: formatEnergyPricesCard,
  unitPrice: formatUnitPrice,
  dryPrice: formatDryPrice,
  energyPrices: formatEnergyPrices,
  abnormalTransportation: formatAbnormalTransportation,
  capacityPool: formatCapacityPool,
  urgentCustomer: formatUrgentCustomer,
  majorEvents: formatMajorEvents,
  reorderProgress: formatReorderProgress,
  cargoTrend: formatCargoTrend,
  signingInformation: formatSigningInformation,
}

/**
 * 获取模块的格式化函数
 */
export function getFormatter(module: string): ((data: any, scope: string) => string) | undefined {
  return formatters[module]
}

/**
 * 获取所有已注册格式化器的模块名列表
 */
export function getFormatterModuleNames(): string[] {
  return Object.keys(formatters)
}
