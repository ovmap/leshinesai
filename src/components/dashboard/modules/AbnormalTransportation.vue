<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import {
  statNotSignOrder,
  statNotSignOrderByPage,
  exportStatNotSignOrder,
  queryAbnormalTypeList,
  queryCarrierList,
  queryFromWarehouse,
  queryToRdc,
  queryDataSourceList,
} from '../../../services/transportApi'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const dataStore = useDashboardDataStore()

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>()

const chartRef = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null

// 弹窗相关状态
const modalVisible = ref(false)
const modalData = ref<any[]>([])
const modalLoading = ref(false)
const exportLoading = ref(false)

// 分页相关状态
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 计算近两年的日期
const now = new Date()
const defaultEndDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
const defaultStartDate = `${twoYearsAgo.getFullYear()}-${String(twoYearsAgo.getMonth() + 1).padStart(2, '0')}-${String(twoYearsAgo.getDate()).padStart(2, '0')} 00:00:00`

// 筛选表单数据
const filterForm = ref({
  startDate: defaultStartDate,
  endDate: defaultEndDate,
  dataSource: [] as string[],
  fromWarehouse: [] as string[],
  toRdc: [] as string[],
  abnormalType: '',
  carrierName: [] as string[],
  deliveryName: [] as string[],
})

// 下拉框选项数据
interface OptionItem {
  label: string
  value: string
}

const dataSourceOptions = ref<OptionItem[]>([])
const abnormalTypeOptions = ref<OptionItem[]>([])
const carrierNameOptions = ref<OptionItem[]>([])
const fromWarehouseOptions = ref<string[]>([])
const rdcOptions = ref<string[]>([])

// 表格列配置
const tableColumns = [
  { title: '数据源', dataIndex: 'dataSource', key: 'dataSource', width: 100 },
  { title: '异常分类', dataIndex: 'abnormalTypeName', key: 'abnormalTypeName', width: 100 },
  { title: '异常天数', dataIndex: 'abnormalDays', key: 'abnormalDays', width: 100 },
  { title: '始发仓库', dataIndex: 'formWarehouse', key: 'formWarehouse', width: 120 },
  { title: '承运商', dataIndex: 'carrierName', key: 'carrierName', width: 100 },
  { title: '配送商', dataIndex: 'deliveryName', key: 'deliveryName', width: 100 },
  { title: '运单号', dataIndex: 'transNo', key: 'transNo', width: 200 },
  { title: '发票号', dataIndex: 'invoiceNo', key: 'invoiceNo', width: 200 },
  { title: '目的RDC', dataIndex: 'toRdc', key: 'toRdc', width: 120 },
  { title: '目的省份', dataIndex: 'toProvince', key: 'toProvince', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
]

// 获取数据源列表
const fetchDataSourceList = async () => {
  try {
    const result = await queryDataSourceList()
    if (result?.code === 200 && result.data) {
      dataSourceOptions.value = result.data.map((item: any) => ({
        value: item.code,
        label: item.name,
      }))
      // 默认全选
      filterForm.value.dataSource = result.data.map((item: any) => item.code)
    }
  } catch (error) {
    console.error('获取数据源列表失败:', error)
  }
}

// 获取异常分类列表
const fetchAbnormalTypeList = async () => {
  try {
    const result = await queryAbnormalTypeList()
    if (result?.code === 200 && result.data) {
      abnormalTypeOptions.value = result.data.map((item: any) => ({
        value: item.code,
        label: item.name,
      }))
    }
  } catch (error) {
    console.error('获取异常分类列表失败:', error)
  }
}

// 获取承运商列表
const fetchCarrierList = async () => {
  try {
    const result = await queryCarrierList()
    if (result?.code === 200 && result.data) {
      carrierNameOptions.value = result.data.map((item: any) => ({
        value: item.code,
        label: item.name,
      }))
    }
  } catch (error) {
    console.error('获取承运商列表失败:', error)
  }
}

// 获取仓库列表
const fetchWarehouseList = async () => {
  try {
    const result = await queryFromWarehouse()
    if (result?.code === 200 && result.data) {
      fromWarehouseOptions.value = result.data
    }
  } catch (error) {
    console.error('获取仓库列表失败:', error)
  }
}

// 获取RDC列表
const fetchRdcList = async () => {
  try {
    const result = await queryToRdc()
    if (result?.code === 200 && result.data) {
      rdcOptions.value = result.data
    }
  } catch (error) {
    console.error('获取RDC列表失败:', error)
  }
}

// 处理接口数据并转换为矩形树图格式
const processApiData = (apiData: any) => {
  if (!apiData?.data) return null

  const children: any[] = []
  const typeOrder = [1, 2, 3, 4]
  const colorMap: { [key: number]: string } = {
    1: '#FFC633', // 客户异常 - 金黄色
    2: '#12D0DB', // 破损 - 青绿色
    3: '#3C96FA', // 不可抗力 - 蓝色
    4: '#23CE89', // 无异常 - 绿色
  }

  typeOrder.forEach((typeId) => {
    const item = apiData.data.find((data: any) => data.abnormalType === typeId)
    if (item?.abnormalInfoList?.length > 0) {
      const childrenItems = item.abnormalInfoList.map((info: any) => ({
        name: info.abnormalDays,
        value: info.abnormalNum,
        classifyRate: info.classifyRate,
        overallRate: info.overallRate,
        abnormalTypeName: item.abnormalTypeName,
        itemStyle: { color: colorMap[typeId] },
      }))

      const totalValue = childrenItems.reduce((sum: number, child: any) => sum + child.value, 0)

      children.push({
        name: item.abnormalTypeName,
        value: totalValue,
        children: childrenItems,
        itemStyle: { color: colorMap[typeId] },
      })
    }
  })

  return { name: '运输异常', children }
}

// 初始化图表
const initChart = (apiData?: any) => {
  if (!chartRef.value) return

  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }

  chartInstance = echarts.init(chartRef.value)

  const treemapData = processApiData(apiData)
  if (!treemapData) return

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      confine: true,
      textStyle: { color: '#fff' },
      formatter: (params: any) => {
        if (params.data.classifyRate !== undefined) {
          return `异常类型: ${params.data.abnormalTypeName}<br/>时间范围: ${params.name}<br/>数量: ${params.value}<br/>分类占比: ${(params.data.classifyRate * 100).toFixed(2)}%<br/>整体占比: ${(params.data.overallRate * 100).toFixed(2)}%`
        }
        return `${params.name}<br/>数量: ${params.value}`
      },
    },
    series: [
      {
        type: 'treemap',
        data: [treemapData],
        width: '100%',
        height: '100%',
        top: '0%',
        left: '0%',
        roam: true,
        nodeClick: 'zoomToNode',
        breadcrumb: {
          show: true,
          left: 'center',
          top: 'bottom',
          height: 22,
          emptyItemWidth: 25,
          itemStyle: {
            color: 'rgba(0,0,0,0.7)',
            borderColor: 'rgba(255,255,255,0.7)',
            borderWidth: 1,
            shadowColor: 'rgba(150,150,150,1)',
            shadowBlur: 3,
            textStyle: { color: '#fff' },
          },
        },
        label: {
          show: true,
          formatter: '{b}',
          fontSize: 10,
          color: '#fff',
          fontWeight: 'bold',
        },
        upperLabel: { show: false },
        itemStyle: {
          borderColor: 'transparent',
          borderWidth: 0,
          gapWidth: 3,
        },
        levels: [
          { itemStyle: { borderColor: 'transparent', borderWidth: 0, gapWidth: 3 } },
          { itemStyle: { borderColor: 'transparent', borderWidth: 0, gapWidth: 3 }, colorSaturation: [0.8, 1.0] },
        ],
        visualMin: 0,
        visualMax: 4000,
        visualDimension: 'value',
      },
    ],
  }

  chartInstance.setOption(option)
}

// 获取数据
const fetchData = async () => {
  try {
    const params = {
      fromWarehouse: props.fromWarehouse || [],
      toProvince: props.toProvince || [],
      toRdc: props.toRdc || [],
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    }

    const response = await statNotSignOrder(params)
    initChart(response)
    // 同步到数据 Store
    dataStore.updateModuleData('abnormalTransportation', {
      rawData: response,
      filters: {
        fromWarehouse: props.fromWarehouse || [],
        toProvince: props.toProvince || [],
        toRdc: props.toRdc || [],
        startDate: defaultStartDate,
        endDate: defaultEndDate,
      },
    })
  } catch (error) {
    console.error('获取运输异常数据失败:', error)
  }
}

// 获取弹窗详细数据
const fetchModalData = async (page: number = currentPage.value) => {
  try {
    modalLoading.value = true

    const result = await statNotSignOrderByPage({
      page,
      pageSize: pageSize.value,
      fromWarehouse: filterForm.value.fromWarehouse,
      toProvince: [],
      toRdc: filterForm.value.toRdc,
      startDate: filterForm.value.startDate,
      endDate: filterForm.value.endDate,
      dataSource: filterForm.value.dataSource,
      abnormalType: filterForm.value.abnormalType ? parseInt(filterForm.value.abnormalType) : null,
      carrierName: filterForm.value.carrierName,
      deliveryName: filterForm.value.deliveryName,
    })

    if (result?.code === 200 && result.data) {
      total.value = result.total || 0
      if (Array.isArray(result.data)) {
        modalData.value = result.data
      } else if (result.data.list) {
        modalData.value = result.data.list
      } else if (result.data.records) {
        modalData.value = result.data.records
      } else {
        modalData.value = []
      }
    } else {
      modalData.value = []
      total.value = 0
    }
  } catch (error) {
    console.error('获取弹窗数据失败:', error)
    modalData.value = []
    total.value = 0
  } finally {
    modalLoading.value = false
  }
}

// 打开详情弹窗
const showDetailModal = () => {
  modalVisible.value = true
  currentPage.value = 1
  total.value = 0
  fetchModalData()
}

// 关闭弹窗
const handleModalClose = () => {
  modalVisible.value = false
  modalData.value = []
  currentPage.value = 1
  total.value = 0
}

// 处理分页变化
const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchModalData(page)
}

// 导出数据
const handleExport = async () => {
  try {
    exportLoading.value = true

    const result = await exportStatNotSignOrder({
      fromWarehouse: filterForm.value.fromWarehouse,
      toProvince: [],
      toRdc: filterForm.value.toRdc,
      startDate: filterForm.value.startDate,
      endDate: filterForm.value.endDate,
      dataSource: filterForm.value.dataSource,
      abnormalType: filterForm.value.abnormalType ? parseInt(filterForm.value.abnormalType) : null,
      carrierName: filterForm.value.carrierName,
      deliveryName: filterForm.value.deliveryName,
    })

    if (result?.code === 200 && result.data) {
      const link = document.createElement('a')
      link.href = result.data
      const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/)
      link.download = xlsxMatch ? xlsxMatch[1] : result.data
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  } catch (error) {
    console.error('导出失败:', error)
  } finally {
    exportLoading.value = false
  }
}

// 查询
const handleQuery = () => {
  currentPage.value = 1
  fetchModalData()
}

// 重置
const handleReset = () => {
  filterForm.value = {
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    dataSource: dataSourceOptions.value.map(o => o.value),
    fromWarehouse: [],
    toRdc: [],
    abnormalType: '',
    carrierName: [],
    deliveryName: [],
  }
  currentPage.value = 1
  fetchModalData()
}

// 窗口大小改变时重新渲染图表
const handleResize = () => {
  if (chartInstance) {
    setTimeout(() => chartInstance?.resize(), 100)
  }
}

onMounted(() => {
  setTimeout(() => fetchData(), 100)
  window.addEventListener('resize', handleResize)
  fetchDataSourceList()
  fetchAbnormalTypeList()
  fetchCarrierList()
  fetchWarehouseList()
  fetchRdcList()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<template>
  <div class="chart-container">
    <div class="header-bar">
      <h2 class="header-title">运输异常</h2>
    </div>
    <div class="chart-content-wrapper">
      <div ref="chartRef" class="chart-content"></div>
      <button class="detail-button" @click="showDetailModal">查看详情</button>
    </div>

    <!-- 详情弹窗 -->
    <Teleport to="body">
      <div v-if="modalVisible" class="modal-overlay" @click.self="handleModalClose">
        <div class="modal">
          <!-- 弹窗头部 -->
          <div class="modal-header">
            <h3 class="modal-title">运输异常详情</h3>
            <button class="close-btn" @click="handleModalClose">×</button>
          </div>

          <!-- 弹窗内容 -->
          <div class="modal-body">
            <!-- 筛选区域 -->
            <div class="filter-section">
              <div class="filter-form">
                <div class="filter-item">
                  <select v-model="filterForm.abnormalType" class="filter-select">
                    <option value="">异常分类</option>
                    <option v-for="opt in abnormalTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div class="filter-actions">
                  <button class="action-btn primary" @click="handleQuery">查询</button>
                  <button class="action-btn" @click="handleReset">重置</button>
                  <button class="action-btn" @click="handleExport" :disabled="exportLoading">
                    {{ exportLoading ? '导出中...' : '导出' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- 表格区域 -->
            <div class="table-section">
              <div v-if="modalLoading" class="loading-mask">加载中...</div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th v-for="col in tableColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                      {{ col.title }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in modalData" :key="row.id || row.transNo">
                    <td v-for="col in tableColumns" :key="col.key">{{ row[col.dataIndex] || '-' }}</td>
                  </tr>
                  <tr v-if="modalData.length === 0 && !modalLoading">
                    <td :colspan="tableColumns.length" class="empty-cell">暂无数据</td>
                  </tr>
                </tbody>
              </table>

              <!-- 分页 -->
              <div v-if="total > 0" class="pagination">
                <span class="pagination-info">共 {{ total }} 条</span>
                <div class="pagination-controls">
                  <button
                    class="page-btn"
                    :disabled="currentPage <= 1"
                    @click="handlePageChange(currentPage - 1)"
                  >上一页</button>
                  <span class="page-number">{{ currentPage }} / {{ Math.ceil(total / pageSize) }}</span>
                  <button
                    class="page-btn"
                    :disabled="currentPage >= Math.ceil(total / pageSize)"
                    @click="handlePageChange(currentPage + 1)"
                  >下一页</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header-bar {
  width: 100%;
  height: 1.8rem;
  flex-shrink: 0;
  background: url('/dashboard/images/title-bg.png') center/100% 100% no-repeat;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 1rem;
  padding-right: 1rem;
  position: relative;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
}

.header-title {
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  z-index: 2;
  position: relative;
}

.chart-content-wrapper {
  flex: 1;
  position: relative;
  min-height: 0;
}

.chart-content {
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
}

.detail-button {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 100;
  padding: 4px 12px;
  background: linear-gradient(135deg, #4a9eff 0%, #3a8eef 100%);
  border: 1px solid rgba(74, 158, 255, 0.8);
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(74, 158, 255, 0.3);
  height: 24px;
  line-height: 1;
}

.detail-button:hover {
  background: linear-gradient(135deg, #3a8eef 0%, #2a7edf 100%);
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal {
  width: 90%;
  max-width: 1200px;
  height: 80vh;
  background: #0a1929;
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, rgba(74, 158, 255, 0.1) 0%, transparent 100%);
}

.modal-title {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.3s;
}

.close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.modal-body {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 筛选区域 */
.filter-section {
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
  padding: 16px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.filter-item {
  display: flex;
  align-items: center;
}

.filter-select {
  padding: 8px 12px;
  background: #081f40;
  border: 1px solid rgba(59, 130, 246, 0.6);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  min-width: 140px;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.8);
}

.filter-select option {
  background: #081f40;
  color: #fff;
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.action-btn {
  height: 32px;
  padding: 0 16px;
  background: #2873cc;
  border-radius: 4px;
  border: none;
  color: white;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn:hover:not(:disabled) {
  background: #1e6cc8;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.primary {
  background: linear-gradient(135deg, #4a9eff 0%, #3a8eef 100%);
}

/* 表格区域 */
.table-section {
  flex: 1;
  overflow: auto;
  position: relative;
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
}

.loading-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  z-index: 10;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  white-space: nowrap;
}

.data-table th {
  background: rgba(74, 158, 255, 0.1);
  color: #a0c4ff;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
}

.data-table td {
  color: rgba(255, 255, 255, 0.8);
}

.data-table tr:hover td {
  background: rgba(74, 158, 255, 0.05);
}

.empty-cell {
  text-align: center !important;
  padding: 40px !important;
  color: rgba(255, 255, 255, 0.5);
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(74, 158, 255, 0.05);
  border-top: 1px solid rgba(74, 158, 255, 0.2);
}

.pagination-info {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-btn {
  padding: 6px 12px;
  background: #2873cc;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.page-btn:hover:not(:disabled) {
  background: #1e6cc8;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-number {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

/* 滚动条样式 */
.table-section::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-section::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.table-section::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.4);
  border-radius: 4px;
}

.table-section::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.6);
}
</style>
