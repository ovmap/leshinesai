<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { queryEndToEndDeliveryRateReason, queryProductGroupList, queryBtcpIndicateList } from '../../../services/transportApi'
import dayjs, { type Dayjs } from 'dayjs'
import { message } from 'ant-design-vue'

// 接口数据类型定义
interface ReasonItem {
  reasonOne: string // 原因大类
  reasonTwoName: number // 原因分析（二类）
  soCount: number // 销售订单数量
  goodsCount: number // 商品数量
  deliveryRate: string // 交付率
  childList?: ReasonItem[] // 子列表
}

// 表格数据（处理后的扁平化数据）
interface TableRow {
  key: string
  reasonOne: string
  reasonTwoName: string | number
  soCount: number
  goodsCount: number
  deliveryRate: string
  isParent: boolean // 是否为父行
  children?: TableRow[] // 子行数据
  expanded?: boolean // 是否展开
  hasChildren?: boolean // 是否有子数据
}

// 筛选表单数据
const filterForm = ref({
  dateRange: [dayjs().startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs],
  productType: [] as string[],
  bizType: [] as string[]
})

// 下拉框选项
const productTypeOptions = ref<Array<{ code: string; name: string }>>([])
const bizTypeOptions = ref<Array<{ code: string; name: string }>>([])

// 下拉框状态
const isProductTypeOpen = ref(false)
const isBizTypeOpen = ref(false)

// 表格数据
const tableData = ref<TableRow[]>([])
const loading = ref(false)

// 表格容器引用和高度
const tableSectionRef = ref<HTMLElement | null>(null)
const tableScrollY = ref<number | undefined>(200) // 默认200，会动态计算

// 原始数据（用于展开/折叠）
const originalData = ref<ReasonItem[]>([])

// 展开的行keys
const expandedRowKeys = ref<string[]>([])

// 获取当月开始和结束日期
const getCurrentMonthRange = () => {
  const now = dayjs()
  const startDate = now.startOf('month').startOf('day').format('YYYY-MM-DD HH:mm:ss')
  const endDate = now.endOf('month').endOf('day').format('YYYY-MM-DD HH:mm:ss')
  return { startDate, endDate }
}

// 加载下拉选项数据
const loadOptions = async () => {
  try {
    // 加载产品类型
    const productTypeRes = await queryProductGroupList()
    
    if (productTypeRes && productTypeRes.code === 200 && Array.isArray(productTypeRes.data)) {
      productTypeOptions.value = productTypeRes.data.filter(
        (item: any) => item && item.code && item.name
      )
    }

    // 加载业务类型（联想）
    const bizTypeRes = await queryBtcpIndicateList()
    
    if (bizTypeRes && bizTypeRes.code === 200 && Array.isArray(bizTypeRes.data)) {
      bizTypeOptions.value = bizTypeRes.data.filter(
        (item: any) => item && item.code && item.name
      )
    }
  } catch (error) {
    console.error('加载选项失败:', error)
  }
}

// 处理数据，转换为表格需要的扁平化格式
const processTableData = (data: ReasonItem[]): TableRow[] => {
  const result: TableRow[] = []
  
  data.forEach((item, index) => {
    const parentKey = `parent-${index}`
    const isExpanded = expandedRowKeys.value.includes(parentKey)
    
    // 检查是否有子数据
    const hasChildren = item.childList && Array.isArray(item.childList) && item.childList.length > 0
    
    // 父行（原因大类）
    const parentRow: TableRow = {
      key: parentKey,
      reasonOne: item.reasonOne || '',
      reasonTwoName: item.reasonTwoName || '',
      soCount: item.soCount || 0,
      goodsCount: item.goodsCount || 0,
      deliveryRate: item.deliveryRate || '0',
      isParent: true,
      expanded: isExpanded,
      hasChildren: hasChildren,
      children: undefined // 设置为 undefined，避免 Ant Design Table 自动展开
    }

    result.push(parentRow)

    // 如果展开，添加子行
    if (isExpanded && item.childList && Array.isArray(item.childList) && item.childList.length > 0) {
      item.childList.forEach((child, childIndex) => {
        result.push({
          key: `${parentKey}-child-${childIndex}`,
          reasonOne: '', // 子行不显示原因大类
          reasonTwoName: child.reasonTwoName || '',
          soCount: child.soCount || 0,
          goodsCount: child.goodsCount || 0,
          deliveryRate: child.deliveryRate || '0',
          isParent: false
        })
      })
    }
    // 注意：不设置 children 属性，避免 Ant Design Table 自动显示展开按钮
  })

  return result
}

// 加载表格数据
const loadTableData = async () => {
  try {
    loading.value = true

    const { startDate, endDate } = filterForm.value.dateRange
      ? {
          startDate: filterForm.value.dateRange[0].startOf('day').format('YYYY-MM-DD HH:mm:ss'),
          endDate: filterForm.value.dateRange[1].endOf('day').format('YYYY-MM-DD HH:mm:ss')
        }
      : getCurrentMonthRange()

    const params = {
      startDate,
      endDate,
      productType: filterForm.value.productType || [],
      bizType: filterForm.value.bizType || []
    }

    const result = await queryEndToEndDeliveryRateReason(params)

    if (result && result.code === 200 && result.data) {
      let dataArray: ReasonItem[] = []
      
      // 处理不同的数据结构
      if (Array.isArray(result.data)) {
        dataArray = result.data
      } else if (result.data.list && Array.isArray(result.data.list)) {
        dataArray = result.data.list
      } else if (result.data.records && Array.isArray(result.data.records)) {
        dataArray = result.data.records
      } else if (result.data.data && Array.isArray(result.data.data)) {
        dataArray = result.data.data
      }

      // 保存原始数据
      originalData.value = dataArray
      // 处理数据并转换为表格格式
      tableData.value = processTableData(dataArray)
    } else {
      originalData.value = []
      tableData.value = []
    }
  } catch (error) {
    console.error('获取数据失败:', error)
    tableData.value = []
    message.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  expandedRowKeys.value = [] // 重置展开状态
  loadTableData()
}

// 重置
const handleReset = () => {
  filterForm.value = {
    dateRange: [dayjs().startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs],
    productType: [],
    bizType: []
  }
  expandedRowKeys.value = []
  loadTableData()
}

// 格式化交付率为百分比
const formatDeliveryRate = (rate: string | number): string => {
  if (!rate && rate !== 0) return '0%'
  
  let numValue: number
  
  // 如果是字符串，尝试转换
  if (typeof rate === 'string') {
    // 如果已经是百分比格式（包含%），去掉%后转换
    const cleanRate = rate.replace('%', '').trim()
    numValue = parseFloat(cleanRate) || 0
  } else {
    numValue = rate
  }
  
  // 如果值在0-1之间，认为是小数，需要乘以100
  if (numValue > 0 && numValue <= 1) {
    numValue = numValue * 100
  }
  
  // 格式化为百分比，保留2位小数
  return `${numValue.toFixed(2)}%`
}

// 切换行展开/折叠
const toggleRowExpand = (key: string) => {
  const index = expandedRowKeys.value.indexOf(key)
  if (index > -1) {
    expandedRowKeys.value.splice(index, 1)
  } else {
    expandedRowKeys.value.push(key)
  }
  
  // 使用原始数据重新处理表格数据
  tableData.value = processTableData(originalData.value)
}

// 下拉框开关方法
const toggleProductTypeDropdown = () => {
  if (isProductTypeOpen.value) {
    isProductTypeOpen.value = false
  } else {
    closeAllDropdowns()
    isProductTypeOpen.value = true
  }
}

const toggleBizTypeDropdown = () => {
  if (isBizTypeOpen.value) {
    isBizTypeOpen.value = false
  } else {
    closeAllDropdowns()
    isBizTypeOpen.value = true
  }
}

// 关闭所有下拉框
const closeAllDropdowns = () => {
  isProductTypeOpen.value = false
  isBizTypeOpen.value = false
}

// 选择产品类型
const selectProductType = (option: { code: string; name: string }) => {
  const index = filterForm.value.productType.indexOf(option.code)
  if (index > -1) {
    filterForm.value.productType.splice(index, 1)
  } else {
    filterForm.value.productType.push(option.code)
  }
}

// 选择业务类型
const selectBizType = (option: { code: string; name: string }) => {
  const index = filterForm.value.bizType.indexOf(option.code)
  if (index > -1) {
    filterForm.value.bizType.splice(index, 1)
  } else {
    filterForm.value.bizType.push(option.code)
  }
}

// 显示文本
const displayProductType = computed(() => {
  if (filterForm.value.productType.length === 0) {
    return '产品类型'
  }
  const names = filterForm.value.productType.map(code => {
    const option = productTypeOptions.value.find(item => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

const displayBizType = computed(() => {
  if (filterForm.value.bizType.length === 0) {
    return '业务类型'
  }
  const names = filterForm.value.bizType.map(code => {
    const option = bizTypeOptions.value.find(item => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

// 点击外部关闭下拉框
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.dropdown-item') && !target.closest('.dropdown-content')) {
    closeAllDropdowns()
  }
}

// 计算表格滚动高度
const calculateTableScrollY = () => {
  nextTick(() => {
    if (tableSectionRef.value) {
      const containerHeight = tableSectionRef.value.clientHeight
      // 减去一些边距和头部高度，确保有滚动条
      // 如果容器高度很大，使用一个合理的最大值，否则使用计算值
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 200
      tableScrollY.value = calculatedHeight
    }
  })
}

// 组件挂载
onMounted(() => {
  loadOptions()
  loadTableData()
  document.addEventListener('click', handleClickOutside)
  
  // 计算表格滚动高度
  calculateTableScrollY()
  
  // 监听窗口大小变化
  window.addEventListener('resize', calculateTableScrollY)
  
  // 使用 ResizeObserver 监听容器大小变化
  if (tableSectionRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      calculateTableScrollY()
    })
    resizeObserver.observe(tableSectionRef.value)
    
    // 保存 observer 以便卸载时清理
    ;(tableSectionRef.value as any)._resizeObserver = resizeObserver
  }
})

// 组件卸载
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', calculateTableScrollY)
  
  // 清理 ResizeObserver
  if (tableSectionRef.value && (tableSectionRef.value as any)._resizeObserver) {
    ;(tableSectionRef.value as any)._resizeObserver.disconnect()
  }
})
</script>

<template>
  <div class="lenovo-customer-container">
    <div class="header-bar">
      <h2 class="header-title">准时交付率(联想客户)</h2>
    </div>
    <!-- 筛选区域 -->
    <div class="filter-section">
      <div class="filter-form">
        <div class="dropdown-group">
          <!-- 签收时间 -->
          <a-range-picker
            v-model:value="filterForm.dateRange"
            format="YYYY-MM-DD"
            separator="至"
            class="date-range-picker"
            :show-time="false"
          />

          <!-- 产品类型下拉框 -->
          <div class="dropdown-item" @click.stop="toggleProductTypeDropdown">
            <span class="dropdown-text">{{ displayProductType }}</span>
            <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
            <div class="dropdown-content" v-show="isProductTypeOpen" @click.stop>
              <div class="options-list">
                <div 
                  v-for="option in productTypeOptions" 
                  :key="option.code" 
                  class="dropdown-option"
                  :class="{ 'selected': filterForm.productType.includes(option.code) }" 
                  @click.stop="selectProductType(option)"
                >
                  <span class="checkmark" v-if="filterForm.productType.includes(option.code)">✓</span>
                  {{ option.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- 业务类型下拉框 -->
          <div class="dropdown-item" @click.stop="toggleBizTypeDropdown">
            <span class="dropdown-text">{{ displayBizType }}</span>
            <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
            <div class="dropdown-content" v-show="isBizTypeOpen" @click.stop>
              <div class="options-list">
                <div 
                  v-for="option in bizTypeOptions" 
                  :key="option.code" 
                  class="dropdown-option"
                  :class="{ 'selected': filterForm.bizType.includes(option.code) }" 
                  @click.stop="selectBizType(option)"
                >
                  <span class="checkmark" v-if="filterForm.bizType.includes(option.code)">✓</span>
                  {{ option.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="filter-actions">
            <a-button @click="handleReset">
              重置
            </a-button>
            <a-button type="primary" @click="handleSearch">
              查询
            </a-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="table-section" ref="tableSectionRef">
      <a-spin :spinning="loading">
        <a-table
          :columns="[
            {
              title: '原因大类',
              dataIndex: 'reasonOne',
              key: 'reasonOne',
              width: 200,
            },
            {
              title: '原因分析',
              dataIndex: 'reasonTwoName',
              key: 'reasonTwoName',
              width: 200,
              align: 'center'
            },
            {
              title: '销售订单数量',
              dataIndex: 'soCount',
              key: 'soCount',
              width: 180,
              align: 'center'
            },
            {
              title: '商品数量',
              dataIndex: 'goodsCount',
              key: 'goodsCount',
              width: 180,
              align: 'center'
            },
            {
              title: '交付率',
              dataIndex: 'deliveryRate',
              key: 'deliveryRate',
              width: 150,
              align: 'center'
            }
          ]"
          :data-source="tableData"
          :pagination="false"
          size="small"
          :scroll="{ x: 1000, y: tableScrollY }"
          :expandable="{ expandRowByClick: false, showExpandColumn: false }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'reasonOne'">
              <span v-if="record.isParent" class="parent-row">
                <span 
                  v-if="record.hasChildren"
                  class="expand-icon" 
                  @click.stop="toggleRowExpand(record.key)"
                  :class="{ expanded: record.expanded }"
                >
                  {{ record.expanded ? '−' : '+' }}
                </span>
                <span v-else class="expand-icon-placeholder"></span>
                <span class="reason-text">{{ record.reasonOne }}</span>
              </span>
              <span v-else class="child-row">
                <span class="child-indent"></span>
              </span>
            </template>
            <template v-else-if="column.key === 'reasonTwoName'">
              <span v-if="record.isParent">{{ record.reasonTwoName }}</span>
              <span v-else class="child-row-text">{{ record.reasonTwoName }}</span>
            </template>
            <template v-else-if="column.key === 'soCount'">
              {{ record.soCount }}
            </template>
            <template v-else-if="column.key === 'goodsCount'">
              {{ record.goodsCount }}
            </template>
            <template v-else-if="column.key === 'deliveryRate'">
              {{ formatDeliveryRate(record.deliveryRate) }}
            </template>
          </template>
        </a-table>
      </a-spin>
    </div>
  </div>
</template>

<style scoped>
.lenovo-customer-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
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
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
}

.header-title {
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.filter-section {
  margin-bottom: 0;
  border-radius: 0;
  padding: 0;
  position: relative;
  z-index: 50;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  flex-shrink: 0;
}

.filter-section .filter-form {
  display: flex;
  align-items: center;
  padding: 0.75rem 0;
}

.filter-section .filter-form .dropdown-group {
  display: flex;
  gap: 0.4rem;
  flex-wrap: nowrap;
  justify-content: flex-start;
  width: 100%;
  align-items: center;
}

.filter-section .filter-form .dropdown-group .dropdown-item {
  position: relative;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  background: #081F40;
  border: 0.0625rem solid #2873CC;
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(0.625rem);
  flex: 0 0 auto;
  min-width: 8rem;
  max-width: 9rem;
  padding: 0.3rem 0.5rem;
}

.filter-section .filter-form .dropdown-group .dropdown-item:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: 100%;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-icon {
  width: 0.8rem;
  height: 0.8rem;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content {
  position: absolute;
  top: calc(100% + 0.2rem);
  left: 0;
  right: 0;
  background: #081F40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.1875rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
  z-index: 1002;
  max-height: 12rem;
  overflow-y: auto;
  backdrop-filter: blur(0.625rem);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list {
  max-height: 7.6rem;
  padding: 0.2rem;
  overflow-y: auto;
  overflow-x: hidden;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar {
  width: 6px;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  transition: all 0.3s ease;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(74, 158, 255, 0.8) 100%);
  border-color: rgba(59, 130, 246, 0.5);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list {
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.3);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option {
  padding: 0.2rem 0.4rem;
  color: white;
  font-size: 0.7rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  line-height: 1.1;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 0.1rem;
  margin-bottom: 0.05rem;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option:hover {
  background: rgba(59, 130, 246, 0.3);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option.selected {
  background: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option .checkmark {
  color: #00ff88;
  font-weight: bold;
  font-size: 0.8rem;
}

.filter-section .filter-form .dropdown-group .date-range-picker {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  background: #081F40;
  border: 0.0625rem solid #2873CC;
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(0.625rem);
  flex: 0 0 auto;
  width: 10rem;
  min-width: 10rem;
  max-width: 10rem;
  padding: 0.3rem 0.5rem;
}

.filter-section .filter-form .dropdown-group .date-range-picker:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.filter-section .filter-form .dropdown-group .date-range-picker :deep(.ant-picker-input) input {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
}

.filter-section .filter-form .dropdown-group .date-range-picker :deep(.ant-picker-separator) {
  color: rgba(255, 255, 255, 0.7);
}

.filter-section .filter-form .dropdown-group .date-range-picker :deep(.ant-picker-suffix) {
  color: rgba(255, 255, 255, 0.7);
}

.filter-section .filter-form .dropdown-group .filter-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
  flex-shrink: 0;
}

.filter-section .filter-form .dropdown-group .filter-actions .ant-btn {
  height: 1.6rem;
  background: #2873cc;
  box-shadow:
    1px 1px 1px 0px #1e6cc8,
    inset 0px 1px 1px 0px #c5dfff;
  border-radius: 2px;
  border: none;
  color: white;
  font-weight: 500;
  transition: all 0.3s;
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0 12px;
  flex-shrink: 0;
}

.filter-section .filter-form .dropdown-group .filter-actions .ant-btn:hover:not(:disabled) {
  background: #1e6cc8;
  box-shadow:
    1px 1px 1px 0px #1c5fb8,
    inset 0px 1px 1px 0px #b8d5ff;
}

.filter-section .filter-form .dropdown-group .filter-actions .ant-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.table-section {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  border-radius: 8px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.table-section :deep(.ant-spin-container) {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-section :deep(.ant-table-wrapper) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-section :deep(.ant-table-container) {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  width: 100%;
}

.table-section :deep(.ant-table) {
  background: transparent;
}

.table-section :deep(.ant-table) .ant-table-expand-icon-col {
  display: none !important;
  width: 0 !important;
  padding: 0 !important;
}

.table-section :deep(.ant-table) .ant-table-thead > tr > th {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  font-size: 0.75rem;
}

.table-section :deep(.ant-table) .ant-table-thead > tr > th:first-child.ant-table-expand-icon-col {
  display: none !important;
}

.table-section :deep(.ant-table) .ant-table-tbody > tr > td {
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  color: white;
  font-size: 0.7rem;
  text-align: center;
}

.table-section :deep(.ant-table) .ant-table-tbody > tr > td:first-child.ant-table-expand-icon-cell {
  display: none !important;
  width: 0 !important;
  padding: 0 !important;
}

.table-section :deep(.ant-table) .ant-table-tbody > tr:hover > td {
  background: rgba(74, 158, 255, 0.1);
}

.table-section :deep(.ant-table) .ant-table-row-expand-icon,
.table-section :deep(.ant-table) .ant-table-row-expand-icon-cell {
  display: none !important;
}

.table-section .parent-row {
  display: flex;
  align-items: center;
  justify-content: start;
  gap: 8px;
  margin-left: 0.5rem;
}

.table-section .parent-row .expand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid rgba(74, 158, 255, 0.6);
  border-radius: 4px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.9);
  font-weight: bold;
  transition: all 0.3s;
  user-select: none;
  flex-shrink: 0;
}

.table-section .parent-row .expand-icon:hover {
  background: rgba(74, 158, 255, 0.2);
  border-color: #4a9eff;
}

.table-section .parent-row .expand-icon.expanded {
  background: rgba(74, 158, 255, 0.3);
}

.table-section .parent-row .expand-icon-placeholder {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.table-section .parent-row .reason-text {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.table-section .child-row {
  display: flex;
  align-items: center;
}

.table-section .child-row .child-indent {
  display: inline-block;
  width: 28px;
}

.table-section .child-row-text {
  color: rgba(255, 255, 255, 0.8);
}

.table-section :deep(.ant-table-tbody > tr).child-row {
  background: rgba(0, 0, 0, 0.2) !important;
}

.table-section :deep(.ant-table-tbody > tr).child-row:hover {
  background: rgba(74, 158, 255, 0.15) !important;
}

.table-section .no-data {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 2rem;
  font-style: italic;
}

.table-section :deep(.ant-table-body) {
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}

.table-section :deep(.ant-table-body::-webkit-scrollbar) {
  width: 4px;
  height: 4px;
}

.table-section :deep(.ant-table-body::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.table-section :deep(.ant-table-body::-webkit-scrollbar-thumb) {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.table-section :deep(.ant-table-body::-webkit-scrollbar-thumb:hover) {
  background: rgba(74, 158, 255, 0.5);
}
</style>
