<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { message } from 'ant-design-vue'
import { querySign, queryNotSignItemByPage, exportNotSignItem, queryFromWarehouse, queryToProvince, queryToRdc } from '../../../services/transportApi'
import { useDashboardControlStore } from '../../../stores/dashboardControlStore'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const controlStore = useDashboardControlStore()
const dataStore = useDashboardDataStore()

// 接收模块专属筛选（来自 ModulesRender 传递的控制 Store 筛选）
const props = defineProps<{
  fromWarehouse?: string
  toProvince?: string
  toRdc?: string
  modeType?: string
}>()

// 图表相关
const chartRef = ref<HTMLDivElement | null>(null)
let myChart: echarts.ECharts | null = null

// 签收数据
const signingData = ref([
  { name: '今日已签收', value: 0, color: '#00AEEF' },
  { name: '今日待签收', value: 0, color: '#F5A623' },
])

// 加载状态
const loading = ref(false)

// 弹窗相关
const modalVisible = ref(false)
const modalLoading = ref(false)
const modalData = ref<any[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const exportLoading = ref(false)

// 弹窗筛选
const modalSelectedWarehouse = ref<string>('')
const modalSelectedProvince = ref<string>('')
const modalSelectedRdc = ref<string>('')
const modalSelectedModeType = ref<string>('')

// 下拉框状态
const modalIsWarehouseOpen = ref(false)
const modalIsProvinceOpen = ref(false)
const modalIsRdcOpen = ref(false)
const modalIsModeTypeOpen = ref(false)

// 搜索关键词
const modalWarehouseSearch = ref('')
const modalProvinceSearch = ref('')
const modalRdcSearch = ref('')

// 运输方式选项
const modeTypeOptions = [
  { code: '区配', name: '区配' },
  { code: '直送', name: '直送' },
]

// 筛选选项数据
const warehouseOptions = ref<{ code: string; name: string }[]>([])
const provinceOptions = ref<{ code: string; name: string }[]>([])
const rdcOptions = ref<{ code: string; name: string }[]>([])

// 加载筛选选项
const loadFilterOptions = async () => {
  try {
    const [warehouseRes, provinceRes, rdcRes] = await Promise.all([
      queryFromWarehouse(),
      queryToProvince(),
      queryToRdc(),
    ])
    if (warehouseRes?.data) {
      warehouseOptions.value = Array.isArray(warehouseRes.data) ? warehouseRes.data : []
    }
    if (provinceRes?.data) {
      provinceOptions.value = Array.isArray(provinceRes.data) ? provinceRes.data : []
    }
    if (rdcRes?.data) {
      rdcOptions.value = Array.isArray(rdcRes.data) ? rdcRes.data : []
    }
  } catch (error) {
    console.error('加载筛选选项失败:', error)
  }
}

// 表格列配置
const tableColumns = [
  { title: '始发仓', dataIndex: 'fromWarehouse', key: 'fromWarehouse', width: 100 },
  { title: '数据源', dataIndex: 'dataSource', key: 'dataSource', width: 60 },
  { title: '承运商', dataIndex: 'carrierName', key: 'carrierName', width: 80 },
  { title: '配送商', dataIndex: 'deliveryName', key: 'deliveryName', width: 80 },
  { title: '运输单号', dataIndex: 'transNo', key: 'transNo', width: 160 },
  { title: '发货单号', dataIndex: 'invoiceNo', key: 'invoiceNo', width: 160 },
  { title: '订单状态', dataIndex: 'orderStatus', key: 'orderStatus', width: 60 },
  { title: '运输方式', dataIndex: 'transType', key: 'transType', width: 70 },
  { title: '配送模式', dataIndex: 'modeType', key: 'modeType', width: 60 },
  { title: '目的仓', dataIndex: 'toWarehouse', key: 'toWarehouse', width: 80 },
  { title: '目的省', dataIndex: 'toProvince', key: 'toProvince', width: 60 },
  { title: '目的市', dataIndex: 'toCity', key: 'toCity', width: 70 },
  { title: '目的区', dataIndex: 'toCounty', key: 'toCounty', width: 70 },
  { title: '收货方', dataIndex: 'deliveryParty', key: 'deliveryParty', width: 120 },
  { title: '发货时间', dataIndex: 'deliverTime', key: 'deliverTime', width: 140 },
  { title: '到达RDC时间', dataIndex: 'arrivalRdcTime', key: 'arrivalRdcTime', width: 140 },
  { title: '预计到达时间', dataIndex: 'predictArrivalCustomerTime', key: 'predictArrivalCustomerTime', width: 140 },
  { title: '件数', dataIndex: 'goodsNum', key: 'goodsNum', width: 50 },
  { title: '体积', dataIndex: 'volume', key: 'volume', width: 60 },
]

// 获取签收数据
const fetchSigningData = async () => {
  try {
    loading.value = true
    const result = await querySign({})
    if (result?.data) {
      signingData.value[0].value = result.data.hasSigned || 0
      signingData.value[1].value = result.data.notSigned || 0
    }
    // 同步到数据 Store（UI 实时镜像）
    syncToDataStore()
  } catch (error) {
    console.error('获取签收数据失败:', error)
    signingData.value[0].value = 0
    signingData.value[1].value = 0
    syncToDataStore()
  } finally {
    loading.value = false
  }
}

// 同步数据到 Store（只赋值 raw 数据，格式化由 dataStore 处理）
const syncToDataStore = () => {
  dataStore.updateModuleData('signingInformation', {
    signed: signingData.value[0].value,
    unsigned: signingData.value[1].value,
    detailList: modalData.value,
    detailTotal: total.value,
    filters: {
      fromWarehouse: modalSelectedWarehouse.value,
      toProvince: modalSelectedProvince.value,
      toRdc: modalSelectedRdc.value,
      modeType: modalSelectedModeType.value,
    },
  })
  dataStore.updateUIState('signingInformation', {
    modalOpen: modalVisible.value,
    currentPage: currentPage.value,
    pageSize: pageSize.value,
  })
}

// 环形图配置
const donutOptions = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c}单',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderColor: '#4A90E2',
    borderWidth: 1,
    textStyle: { color: '#FFFFFF' },
  },
  legend: {
    orient: 'horizontal',
    left: 'center',
    bottom: '10%',
    itemGap: 20,
    textStyle: { color: '#FFFFFF', fontSize: 11 },
    itemWidth: 12,
    itemHeight: 12,
  },
  series: [
    {
      name: '签收信息',
      type: 'pie',
      radius: ['40%', '60%'],
      center: ['50%', '40%'],
      label: {
        show: true,
        position: 'outside',
        formatter: '{c}单',
        fontSize: 12,
        fontWeight: 'bold',
        color: '#FFFFFF',
        distance: 4,
      },
      labelLine: {
        show: true,
        length: 8,
        length2: 15,
        smooth: true,
      },
      data: signingData.value
        .map((item) => ({
          value: item.value,
          itemStyle: { color: item.color },
          name: item.name,
          labelLine: { lineStyle: { color: item.color } },
        }))
        .filter((item) => item.value > 0),
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
    },
  ],
}))

// 处理图表点击
const handleChartClick = (params: any) => {
  if (params?.name === '今日待签收') {
    modalVisible.value = true
    modalSelectedWarehouse.value = ''
    modalSelectedProvince.value = ''
    modalSelectedRdc.value = ''
    modalSelectedModeType.value = ''
    fetchModalData()
  }
}

// 获取弹窗数据
const fetchModalData = async (page: number = currentPage.value) => {
  try {
    modalLoading.value = true
    const result = await queryNotSignItemByPage({
      page,
      pageSize: pageSize.value,
      fromWarehouse: modalSelectedWarehouse.value ? [modalSelectedWarehouse.value] : [],
      toProvince: modalSelectedProvince.value ? [modalSelectedProvince.value] : [],
      toRdc: modalSelectedRdc.value ? [modalSelectedRdc.value] : [],
      modeType: modalSelectedModeType.value,
    })
    if (result?.code === 200 && result.data) {
      total.value = result.total || 0
      modalData.value = Array.isArray(result.data) ? result.data : []
    } else {
      modalData.value = []
      total.value = 0
    }
    // 同步到数据 Store
    syncToDataStore()
  } catch (error) {
    console.error('获取未签收明细失败:', error)
    modalData.value = []
    total.value = 0
    syncToDataStore()
  } finally {
    modalLoading.value = false
  }
}

// 关闭弹窗
const handleModalClose = () => {
  modalVisible.value = false
  modalData.value = []
  currentPage.value = 1
  total.value = 0
}

// 分页变化
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current
  pageSize.value = pagination.pageSize
  fetchModalData(pagination.current)
}

// 分页器变化
const handlePageChange = (page: number, size: number) => {
  currentPage.value = page
  pageSize.value = size
  fetchModalData(page)
}

// 每页条数变化
const handlePageSizeChange = (current: number, size: number) => {
  currentPage.value = 1
  pageSize.value = size
  fetchModalData(1)
}

// 重置筛选
const handleReset = () => {
  modalSelectedWarehouse.value = ''
  modalSelectedProvince.value = ''
  modalSelectedRdc.value = ''
  modalSelectedModeType.value = ''
  currentPage.value = 1
  fetchModalData(1)
}

// 搜索
const handleSearch = () => {
  currentPage.value = 1
  fetchModalData(1)
}

// 导出
const handleExport = async () => {
  try {
    exportLoading.value = true
    const result = await exportNotSignItem({
      page: currentPage.value,
      pageSize: pageSize.value,
      fromWarehouse: modalSelectedWarehouse.value ? [modalSelectedWarehouse.value] : [],
      toProvince: modalSelectedProvince.value ? [modalSelectedProvince.value] : [],
      toRdc: modalSelectedRdc.value ? [modalSelectedRdc.value] : [],
      modeType: modalSelectedModeType.value,
    })
    if (result?.data) {
      const url = typeof result.data === 'string' ? result.data : result.data.downloadUrl
      if (url) {
        const link = document.createElement('a')
        link.href = url
        link.download = `未签收明细_${new Date().toISOString().slice(0, 10)}.xlsx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        message.success('导出成功')
      }
    }
  } catch (error) {
    message.error('导出失败')
  } finally {
    exportLoading.value = false
  }
}

// 下拉框控制
const closeAllDropdowns = () => {
  modalIsWarehouseOpen.value = false
  modalIsProvinceOpen.value = false
  modalIsRdcOpen.value = false
  modalIsModeTypeOpen.value = false
}

// 初始化图表
onMounted(async () => {
  // 加载筛选选项
  await loadFilterOptions()
  
  // 先获取数据
  await fetchSigningData()
  
  await nextTick()
  if (chartRef.value) {
    myChart = echarts.init(chartRef.value)
    myChart.on('click', handleChartClick)
    myChart.setOption(donutOptions.value)
    // 确保图表正确计算尺寸
    setTimeout(() => {
      myChart?.resize()
    }, 100)
  }
  
  window.addEventListener('resize', handleResize)
})

// 监听数据变化更新图表
watch(
  signingData,
  (newData) => {
    if (myChart) {
      myChart.setOption(
        {
          series: [
            {
              data: newData
                .map((item) => ({
                  value: item.value,
                  itemStyle: { color: item.color },
                  name: item.name,
                  labelLine: { lineStyle: { color: item.color } },
                }))
                .filter((item) => item.value > 0),
            },
          ],
        },
        true
      )
    }
  },
  { deep: true }
)

// 监听 props 变化（来自控制 Store 的筛选）
watch(
  () => props,
  (newProps) => {
    let changed = false
    if (newProps.fromWarehouse !== undefined && newProps.fromWarehouse !== modalSelectedWarehouse.value) {
      modalSelectedWarehouse.value = newProps.fromWarehouse || ''
      changed = true
    }
    if (newProps.toProvince !== undefined && newProps.toProvince !== modalSelectedProvince.value) {
      modalSelectedProvince.value = newProps.toProvince || ''
      changed = true
    }
    if (newProps.toRdc !== undefined && newProps.toRdc !== modalSelectedRdc.value) {
      modalSelectedRdc.value = newProps.toRdc || ''
      changed = true
    }
    if (newProps.modeType !== undefined && newProps.modeType !== modalSelectedModeType.value) {
      modalSelectedModeType.value = newProps.modeType || ''
      changed = true
    }
    if (changed) {
      // 筛选变化时，如果有弹窗打开则重新获取数据
      if (modalVisible.value) {
        fetchModalData(1)
      }
      syncToDataStore()
    }
  },
  { deep: true }
)

// 监听控制 Store 的操作队列
watch(
  () => controlStore.pendingActions,
  (actions) => {
    actions.forEach(action => {
      if (action.module !== 'signingInformation') return
      switch (action.action) {
        case 'openDetail':
          modalVisible.value = true
          fetchModalData()
          break
        case 'closeDetail':
          modalVisible.value = false
          break
        case 'export':
          handleExport()
          break
        case 'resetFilters':
          handleReset()
          break
      }
      // 消费操作
      controlStore.consumeAction(action.id)
    })
  },
  { deep: true }
)

// 监听弹窗状态变化，同步 UI 状态
watch(modalVisible, () => {
  dataStore.updateUIState('signingInformation', {
    modalOpen: modalVisible.value,
    currentPage: currentPage.value,
    pageSize: pageSize.value,
  })
})

// 窗口大小变化
const handleResize = () => {
  if (myChart) myChart.resize()
}

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (myChart) {
    myChart.dispose()
    myChart = null
  }
})
</script>

<template>
  <div class="signing-information">
    <!-- 环形图 -->
    <div class="chart-wrapper">
      <div ref="chartRef" class="chart-container"></div>
    </div>

    <!-- 未签收明细弹窗 -->
    <Teleport to="body">
      <div v-if="modalVisible" class="modal-overlay" @click.self="handleModalClose">
        <div class="modal-container">
          <!-- 弹窗头部 -->
          <div class="modal-header">
            <h3 class="modal-title">未签收明细</h3>
            <button class="close-btn" @click="handleModalClose">×</button>
          </div>

          <!-- 筛选区域 -->
          <div class="modal-filters">
            <div class="filter-group">
              <select v-model="modalSelectedWarehouse" class="filter-select filter-select-sm">
                <option value="">始发仓</option>
                <option v-for="opt in warehouseOptions" :key="opt.code" :value="opt.code">{{ opt.name }}</option>
              </select>
              <select v-model="modalSelectedProvince" class="filter-select">
                <option value="">目的省</option>
                <option v-for="opt in provinceOptions" :key="opt.code" :value="opt.code">{{ opt.name }}</option>
              </select>
              <select v-model="modalSelectedRdc" class="filter-select filter-select-sm">
                <option value="">目的RDC</option>
                <option v-for="opt in rdcOptions" :key="opt.code" :value="opt.code">{{ opt.name }}</option>
              </select>
              <select v-model="modalSelectedModeType" class="filter-select">
                <option value="">配送模式</option>
                <option v-for="opt in modeTypeOptions" :key="opt.code" :value="opt.code">{{ opt.name }}</option>
              </select>
            </div>
            <div class="filter-buttons">
              <a-button size="small" @click="handleSearch">搜索</a-button>
              <a-button size="small" @click="handleReset">重置</a-button>
              <a-button size="small" type="primary" :loading="exportLoading" @click="handleExport">导出</a-button>
            </div>
          </div>

          <!-- 表格区域 -->
          <div class="modal-table-wrapper">
            <div class="modal-table">
              <a-spin :spinning="modalLoading">
                <a-table
                  :columns="tableColumns"
                  :data-source="modalData"
                  :pagination="false"
                  size="small"
                  :scroll="{ x: 'max-content', y: 500 }"
                  @change="handleTableChange"
                  class="custom-table"
                >
                </a-table>
              </a-spin>
            </div>
            <div class="modal-pagination">
              <a-pagination
                :current="currentPage"
                :page-size="pageSize"
                :total="total"
                show-size-changer
                show-quick-jumper
                :show-total="(total: number) => `共 ${total} 条`"
                :page-size-options="['10', '20', '50', '100']"
                @change="handlePageChange"
                @showSizeChange="handlePageSizeChange"
                size="small"
              />
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.signing-information {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chart-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.chart-container {
  width: 100%;
  height: 100%;
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
  z-index: 1000;
}

.modal-container {
  width: 90%;
  max-width: 1400px;
  height: 80vh;
  background: #0f172a;
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 弹窗滚动条美化 */
.modal-container::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.modal-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.modal-container::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.6);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.modal-container::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.8);
}

.modal-container::-webkit-scrollbar-thumb:active {
  background: rgba(59, 130, 246, 1);
}

.modal-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #1e293b;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.modal-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: #1e293b;
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
}

.filter-group {
  display: flex;
  gap: 8px;
  flex: 1;
}

.filter-select {
  background: #081f40;
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
  min-width: 120px;
}

.filter-select-sm {
  min-width: 100px;
  max-width: 120px;
}

.filter-select:hover {
  border-color: rgba(74, 158, 255, 0.7);
}

.filter-buttons {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.modal-table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 20px 16px;
}

.modal-table {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.modal-table :deep(.ant-spin-nested-loading) {
  height: 100%;
}

.modal-table :deep(.ant-spin-container) {
  height: 100%;
}

.modal-table :deep(.ant-table-wrapper) {
  height: 100%;
}

.modal-pagination {
  padding-top: 12px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.modal-pagination :deep(.ant-pagination) {
  margin: 0 !important;
}

/* 滚动条美化 */
.modal-table-wrapper::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.modal-table-wrapper::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.modal-table-wrapper::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.6);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.modal-table-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.8);
}

.modal-table-wrapper::-webkit-scrollbar-thumb:active {
  background: rgba(59, 130, 246, 1);
}

/* Firefox 滚动条 */
.modal-table-wrapper {
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.2);
}

/* Ant Design 表格样式覆盖 */
:deep(.ant-table) {
  background: transparent !important;
  color: #e2e8f0 !important;
}

:deep(.ant-table-thead > tr > th) {
  background: rgba(74, 158, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  border-bottom: 1px solid rgba(74, 158, 255, 0.3) !important;
  font-weight: 600 !important;
}

:deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid rgba(74, 158, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.8) !important;
  padding: 8px 12px !important;
}

:deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(74, 158, 255, 0.05) !important;
}

:deep(.ant-table-tbody > tr) {
  background: transparent !important;
}

/* 表格滚动条美化 */
:deep(.ant-table-body)::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

:deep(.ant-table-body)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

:deep(.ant-table-body)::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.6);
  border-radius: 3px;
  transition: background 0.3s ease;
}

:deep(.ant-table-body)::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.8);
}

:deep(.ant-table-body)::-webkit-scrollbar-thumb:active {
  background: rgba(59, 130, 246, 1);
}

:deep(.ant-table-body) {
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.2);
}

:deep(.ant-pagination) {
  color: rgba(255, 255, 255, 0.7) !important;
  margin-top: 16px !important;
}

:deep(.ant-pagination-item) {
  background: transparent !important;
  border-color: rgba(74, 158, 255, 0.3) !important;
}

:deep(.ant-pagination-item a) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:deep(.ant-pagination-item-active) {
  background: rgba(59, 130, 246, 0.2) !important;
  border-color: #3b82f6 !important;
}

:deep(.ant-pagination-item-active a) {
  color: #3b82f6 !important;
}

:deep(.ant-table-wrapper) {
  color: #e2e8f0 !important;
}

:deep(.ant-spin-nested-loading) {
  min-height: 200px !important;
}

:deep(.ant-spin-container) {
  min-height: 200px !important;
}
</style>
