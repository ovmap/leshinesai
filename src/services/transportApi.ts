import axios from 'axios'

// Transport Dashboard API 客户端（直连，不经过网关）
const transportDashboardClient = axios.create({
  baseURL: import.meta.env.VITE_TRANSPORT_DASHBOARD_URL || 'https://transport-service-dashboard-tst.t-sy-in.earth.xcloud.lenovo.com',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Transport AI API 客户端（直连，不经过网关）
const transportAiClient = axios.create({
  baseURL: import.meta.env.VITE_TRANSPORT_AI_URL || 'https://transport-service-ai-tst.t-sy-in.earth.xcloud.lenovo.com',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 响应拦截器 - 统一处理错误
transportDashboardClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[Transport Dashboard API Error]:', error.message)
    return Promise.reject(error)
  }
)

transportAiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[Transport AI API Error]:', error.message)
    return Promise.reject(error)
  }
)

// ============ Transport Dashboard API 接口 ============

/**
 * 查询货量总量（日/月/年）
 * dataType: '1'=日, '2'=月, '3'=年
 */
export async function queryTotalVolume(
  dataType: string,
  fromWarehouse?: string,
  toProvince?: string[],
  toRdc?: string[]
) {
  let url = `/kanban/v1/volume/queryTotalVolume?dataType=${dataType}`
  if (fromWarehouse) url += `&fromWarehouse=${fromWarehouse}`
  if (toProvince && toProvince.length > 0) url += `&toProvince=${toProvince.join(',')}`
  if (toRdc && toRdc.length > 0) url += `&toRdc=${toRdc.join(',')}`
  const response = await transportDashboardClient.get(url)
  return response.data
}

/**
 * 查询应签未签明细
 */
export async function queryAbnormalOrderItem(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/abnormal/queryAbnormalOrderItem', data)
  return response.data
}

/**
 * 导出应签未签明细
 */
export async function exportAbnormalOrderItem(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/abnormal/exportAbnormalOrderItem', data)
  return response.data
}

/**
 * 查询区域列表
 */
export async function queryRegionList(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/select/queryRegionList', data)
  return response.data
}

/**
 * 查询异常分类列表
 */
export async function queryAbnormalTypeList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryAbnormalTypeList')
  return response.data
}

/**
 * 查询数据源列表
 */
export async function queryDataSourceList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryDataSourceList')
  return response.data
}

/**
 * 查询运输方式列表
 */
export async function queryTransTypeList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryTransTypeList')
  return response.data
}

/**
 * 查询时间类型列表
 */
export async function queryTimeTypeList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryTimeTypeList')
  return response.data
}

/**
 * 查询城市级别列表
 */
export async function queryCityLevelList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryCityLevelList')
  return response.data
}

/**
 * 查询商品类型列表
 */
export async function queryProductTypeList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryProductTypeList')
  return response.data
}

/**
 * 查询货量数据
 */
export async function queryVolume(data: {
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
  startDate: string
  endDate: string
  timeType: string
  agg: string
  customer?: string[]
  bizType?: string[]
  transType?: string[]
  cityLevel?: string[]
  dataSource?: string[]
  productType?: string[]
}) {
  const defaultParams = {
    fromWarehouse: [],
    toProvince: [],
    toRdc: [],
    customer: [],
    bizType: [],
    transType: [],
    cityLevel: [],
    dataSource: ['TMS', 'LESTMS', 'BTCP', 'SEC'],
    productType: [],
    ...data,
  }
  const response = await transportDashboardClient.post('/kanban/v1/volume/queryVolume', defaultParams)
  return response.data
}

/**
 * 查询签收信息（已签收/待签收数量）
 */
export async function querySign(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/sign/querySign', data)
  return response.data
}

/**
 * 查询未签收订单
 */
export async function queryNotSignItemByPage(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/sign/queryNotSignItemByPage', data)
  return response.data
}

/**
 * 导出未签收明细
 */
export async function exportNotSignItem(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/sign/exportNotSignItem', data)
  return response.data
}

/**
 * 查询准时交付率
 */
export async function queryOnTimeRateCard(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/onTimeRate/queryOnTimeRateCard', data)
  return response.data
}

/**
 * 查询运输物流商 KPI 评分
 */
export async function queryTransKpiSummary(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/logisticKpi/queryTransKpiSummary', data)
  return response.data
}

/**
 * 查询热力图数据
 */
export async function queryHeatMap(startDate: string, endDate: string) {
  const response = await transportDashboardClient.get(`/kanban/v1/map/queryHeatMap?startDate=${startDate}&endDate=${endDate}`)
  return response.data
}

/**
 * 查询在途车辆列表
 */
export async function queryInTransitTruckList() {
  const response = await transportDashboardClient.get('/kanban/v1/map/queryInTransitTruckList')
  return response.data
}

/**
 * 查询仓库列表
 */
export async function queryWarehouseList() {
  const response = await transportDashboardClient.get('/kanban/v1/map/queryWarehouseList')
  return response.data
}

/**
 * 查询始发仓列表
 */
export async function queryFromWarehouse() {
  const response = await transportDashboardClient.get('/kanban/v1/common/queryFromWarehouse')
  return response.data
}

/**
 * 查询目的 RDC 列表
 */
export async function queryToRdc() {
  const response = await transportDashboardClient.get('/kanban/v1/common/queryToRdc')
  return response.data
}

/**
 * 查询目的省份列表
 */
export async function queryToProvince() {
  const response = await transportDashboardClient.get('/kanban/v1/common/queryToProvince')
  return response.data
}

// ============ 智能体异常预警 (cargoBanner) API 接口 ============

/** 查询异常预警订单统计 */
export async function queryRiskOrderStats(data: object) {
  const response = await transportAiClient.post('/ai/v1/riskAlert/queryRiskOrderStats', data)
  return response.data
}

/** 分页查询异常预警订单数据 */
export async function queryRiskOrderByPage(data: object) {
  const response = await transportAiClient.post('/ai/v1/riskAlert/queryRiskOrderByPage', data)
  return response.data
}

/** 导出异常预警订单数据 */
export async function exportRiskOrder(data: object) {
  const response = await transportAiClient.post('/ai/v1/riskAlert/exportRiskOrder', data)
  return response.data
}

/** 查询CDD预警统计 */
export async function queryCddAlertStats(data: object) {
  const response = await transportAiClient.post('/ai/v1/cddAlert/queryCddAlertStats', data)
  return response.data
}

/** 查询CDD预警详情（支持多种筛选条件） */
export async function queryCddAlertDetails(data: object) {
  const response = await transportAiClient.post('/ai/v1/cddAlert/queryCddAlertDetails', data)
  return response.data
}

/** 导出CDD预警数据 */
export async function exportCddAlertDataByFilter(data: object) {
  const response = await transportAiClient.post('/ai/v1/cddAlert/exportCddAlertDetails', data)
  return response.data
}

/** 查询车辆预警 */
export async function queryAbnormalVehicleStats() {
  const response = await transportAiClient.get('/ai/v1/vehicleAlert/queryAbnormalVehicleStats')
  return response.data
}

/** 查询ISG延迟风险 */
export async function queryIsgDelayRisk(data: object) {
  const response = await transportAiClient.post('/ai/v1/isgAlert/queryIsgDelayRisk', data)
  return response.data
}

/** 查询ISG在途异常 */
export async function queryIsgInTransitAbnormal(data: object) {
  const response = await transportAiClient.post('/ai/v1/isgAlert/queryIsgInTransitAbnormal', data)
  return response.data
}

/** 查询ISG交付异常 */
export async function queryIsgDeliveryAbnormal(data: object) {
  const response = await transportAiClient.post('/ai/v1/isgAlert/queryIsgDeliveryAbnormal', data)
  return response.data
}

/** 查询ISG风险预警 */
export async function queryIsgRiskAlert() {
  const response = await transportAiClient.get('/ai/v1/isgAlert/queryIsgRiskAlert')
  return response.data
}

export { transportDashboardClient, transportAiClient }
