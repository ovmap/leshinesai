/**
 * 看板模块 Markdown 格式化函数统一出口
 * 
 * 每个模块一个文件，导出格式化函数。
 * 新增模块时，在此文件中注册即可。
 */

// ========== 原有格式化器 ==========
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
import { formatCargoBanner } from './cargoBanner'

// ========== 新增格式化器 ==========
// 准时交付率系列
import { formatWarehousingLogistics } from './warehousingLogistics'
import { formatTimeDimension } from './timeDimension'
import { formatLenovoCustomer } from './lenovoCustomer'
import { formatNonLenovoCustomer } from './nonLenovoCustomer'

// 提货及时率
import { formatPickupRate } from './pickupRate'

// 地图
import { formatMapPage } from './mapPage'

// KPI 评分/排名系列
import { formatTobWarehousingCard } from './tobWarehousingCard'
import { formatTobWarehousingRank } from './tobWarehousingRank'
import { formatTransportationLogisticsScores } from './transportationLogisticsScores'
import { formatTransportationLogisticsRank } from './transportationLogisticsRank'
import { formatCityLogisticsScores } from './cityLogisticsScores'
import { formatCityLogisticsRank } from './cityLogisticsRank'
import { formatTclWarehousingScores } from './tclWarehousingScores'
import { formatTransStorageKpiScore } from './transStorageKpiScore'
import { formatTransportationDoaScores } from './transportationDoaScores'
import { formatTocWarehousingScores } from './tocWarehousingScores'
import { formatTransportationOpenScores } from './transportationOpenScores'
import { formatTransportationExpressScores } from './transportationExpressScores'

// 应签未签系列
import { formatSignUp } from './signUp'
import { formatSignUpDetail } from './signUpDetail'

// 返单系列
import { formatOrderRate } from './orderRate'
import { formatUdReorderProgress } from './udReorderProgress'

// 货量占比系列
import { formatBarPercentage } from './barPercentage'
import { formatTablePercentage } from './tablePercentage'

// CDD 周报 & PFP 考核
import { formatCddWeeklyReport } from './cddWeeklyReport'
import { formatPfpAssessment } from './pfpAssessment'

/**
 * 模块格式化函数注册表
 * key: 模块名（对应 moduleRegistry 中的 name）
 * value: 格式化函数 (data, scope) => string
 */
export const formatters: Record<string, (data: any, scope: string) => string> = {
  // 原有
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
  cargoBanner: formatCargoBanner,

  // 准时交付率系列
  warehousingLogistics: formatWarehousingLogistics,
  timeDimension: formatTimeDimension,
  lenovoCustomer: formatLenovoCustomer,
  nonLenovoCustomer: formatNonLenovoCustomer,

  // 提货及时率
  pickupRate: formatPickupRate,

  // 地图
  mapPage: formatMapPage,

  // KPI 评分/排名系列
  tobWarehousingCard: formatTobWarehousingCard,
  tobWarehousingRank: formatTobWarehousingRank,
  transportationLogisticsScores: formatTransportationLogisticsScores,
  transportationLogisticsRank: formatTransportationLogisticsRank,
  cityLogisticsScores: formatCityLogisticsScores,
  cityLogisticsRank: formatCityLogisticsRank,
  tclWarehousingScores: formatTclWarehousingScores,
  transStorageKpiScore: formatTransStorageKpiScore,
  transportationDoaScores: formatTransportationDoaScores,
  tocWarehousingScores: formatTocWarehousingScores,
  transportationOpenScores: formatTransportationOpenScores,
  transportationExpressScores: formatTransportationExpressScores,

  // 应签未签系列
  signUp: formatSignUp,
  signUpDetail: formatSignUpDetail,

  // 返单系列
  orderRate: formatOrderRate,
  udReorderProgress: formatUdReorderProgress,

  // 货量占比系列
  barPercentage: formatBarPercentage,
  tablePercentage: formatTablePercentage,

  // CDD 周报 & PFP 考核
  cddWeeklyReport: formatCddWeeklyReport,
  pfpAssessment: formatPfpAssessment,
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
