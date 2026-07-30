<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { queryPickupRate } from '../../../services/transportApi'

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>()

// 日期范围：默认最近3个月
const getDefaultDates = () => {
  const now = new Date()
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  return { startDate, endDate }
}

const defaults = getDefaultDates()
const startDate = ref(defaults.startDate)
const endDate = ref(defaults.endDate)
const showDetail = ref(false)
const loading = ref(false)
const rawData = ref<any[]>([])

// 从原始数据中提取排序后的月份列表
const months = computed(() => {
  const set = new Set<string>()
  rawData.value.forEach(item => {
    if (item.month) set.add(item.month)
  })
  return Array.from(set).sort()
})

// 将纵向数据转为横向表格数据
const tableData = computed(() => {
  const groupMap = new Map<string, any>()

  rawData.value.forEach(item => {
    const key = `${item.customer}__${item.cdcWarehouse}`
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        customer: item.customer,
        cdcWarehouse: item.cdcWarehouse,
      })
    }
    const row = groupMap.get(key)
    const m = item.month
    if (m) {
      row[`${m}_rate`] = item.rate
      row[`${m}_numerator`] = item.numerator
      row[`${m}_denominator`] = item.denominator
    }
  })

  return Array.from(groupMap.values())
})

// 获取数据
const fetchData = async () => {
  try {
    loading.value = true
    const result = await queryPickupRate({
      customer: [],
      startDate: startDate.value,
      endDate: endDate.value,
      cdcWarehouse: [],
    })
    if (result?.code === 200 && Array.isArray(result.data)) {
      rawData.value = result.data
    } else {
      rawData.value = []
    }
  } catch (error) {
    console.error('获取揽收及时率数据失败:', error)
    rawData.value = []
  } finally {
    loading.value = false
  }
}

// 格式化月份显示
const formatMonth = (m: string) => {
  // '2025-01' -> '2025-01'
  return m
}

// 获取速率颜色
const getRateColor = (rate: number | null) => {
  if (rate === null || rate === undefined) return '#94a3b8'
  if (rate >= 0.9) return '#52c41a'
  if (rate >= 0.8) return '#faad14'
  return '#ff4d4f'
}

// 格式化速率显示
const formatRate = (rate: number | null) => {
  if (rate === null || rate === undefined) return '-'
  return `${(rate * 100).toFixed(1)}%`
}

// 格式化数值显示
const formatNum = (val: number | null) => {
  if (val === null || val === undefined) return '-'
  return String(val)
}

// 获取单元格数据
const getCellData = (row: any, month: string) => {
  return {
    rate: row[`${month}_rate`] ?? null,
    numerator: row[`${month}_numerator`] ?? null,
    denominator: row[`${month}_denominator`] ?? null,
  }
}

// 查询
const handleQuery = () => {
  fetchData()
}

// 监听 props 变化
watch(
  () => props,
  () => {
    fetchData()
  },
  { deep: true }
)

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="pickup-rate-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="date-range">
        <input type="month" v-model="startDate" class="month-input" />
        <span class="date-separator">至</span>
        <input type="month" v-model="endDate" class="month-input" />
        <button class="query-btn" @click="handleQuery">查询</button>
      </div>
      <div class="toggle-detail">
        <label class="toggle-label">
          <input type="checkbox" v-model="showDetail" />
          <span>显示明细</span>
        </label>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="table-section">
      <div v-if="loading" class="loading-mask">
        <span class="loading-text">加载中...</span>
      </div>
      <table class="custom-table">
        <thead>
          <tr>
            <th class="fixed-col warehouse-col">始发仓库</th>
            <th class="fixed-col customer-col">客户</th>
            <template v-for="month in months" :key="month">
              <th v-if="showDetail" :colspan="3" class="month-group-header">
                <div class="month-header">{{ formatMonth(month) }}</div>
              </th>
              <th v-else class="month-col">
                <div class="month-header">{{ formatMonth(month) }}</div>
              </th>
            </template>
          </tr>
          <tr v-if="showDetail">
            <th class="fixed-col warehouse-col"></th>
            <th class="fixed-col customer-col"></th>
            <template v-for="month in months" :key="month + '_sub'">
              <th class="sub-header">达标单数</th>
              <th class="sub-header">总单数</th>
              <th class="sub-header">揽收及时率</th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-if="tableData.length === 0 && !loading">
            <td :colspan="2 + (showDetail ? months.length * 3 : months.length)" class="empty-cell">
              暂无数据
            </td>
          </tr>
          <tr v-for="(row, idx) in tableData" :key="idx">
            <td class="fixed-col warehouse-col">{{ row.cdcWarehouse }}</td>
            <td class="fixed-col customer-col">{{ row.customer }}</td>
            <template v-for="month in months" :key="month + '_data'">
              <template v-if="showDetail">
                <td class="num-cell">{{ formatNum(getCellData(row, month).numerator) }}</td>
                <td class="num-cell">{{ formatNum(getCellData(row, month).denominator) }}</td>
                <td class="rate-cell" :style="{ color: getRateColor(getCellData(row, month).rate) }">
                  {{ formatRate(getCellData(row, month).rate) }}
                </td>
              </template>
              <template v-else>
                <td class="rate-cell" :style="{ color: getRateColor(getCellData(row, month).rate) }">
                  {{ formatRate(getCellData(row, month).rate) }}
                </td>
              </template>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.pickup-rate-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  flex-shrink: 0;
  gap: 12px;
  background: rgba(15, 23, 42, 0.6);
  border-bottom: 1px solid rgba(74, 158, 255, 0.15);
}

.date-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.month-input {
  background: rgba(8, 31, 64, 0.9);
  border: 1px solid rgba(74, 158, 255, 0.4);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.85);
  font-size: clamp(11px, 1.2vw, 13px);
  padding: 4px 8px;
  outline: none;
  cursor: pointer;
}

.month-input:hover,
.month-input:focus {
  border-color: rgba(74, 158, 255, 0.7);
}

.month-input::-webkit-calendar-picker-indicator {
  filter: invert(0.7);
  cursor: pointer;
}

.date-separator {
  color: rgba(255, 255, 255, 0.5);
  font-size: clamp(11px, 1.2vw, 13px);
}

.query-btn {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: 4px;
  color: #a0c4ff;
  font-size: clamp(11px, 1.2vw, 13px);
  padding: 4px 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.query-btn:hover {
  background: rgba(59, 130, 246, 0.35);
  border-color: rgba(59, 130, 246, 0.8);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: clamp(11px, 1.2vw, 13px);
  cursor: pointer;
  user-select: none;
}

.toggle-label input[type="checkbox"] {
  accent-color: #3b82f6;
  cursor: pointer;
}

.table-section {
  flex: 1;
  overflow: auto;
  position: relative;
}

/* 滚动条美化 */
.table-section::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.table-section::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.table-section::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.6);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.table-section::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.8);
}

.table-section::-webkit-scrollbar-thumb:active {
  background: rgba(59, 130, 246, 1);
}

.table-section {
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.2);
}

.loading-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-text {
  color: #a0c4ff;
  font-size: 14px;
}

.custom-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}

.custom-table th,
.custom-table td {
  border: 1px solid rgba(74, 158, 255, 0.3);
  padding: 6px 10px;
  text-align: center;
  white-space: nowrap;
  font-size: clamp(11px, 1.2vw, 13px);
}

.custom-table thead th {
  background: rgba(74, 158, 255, 0.1);
  color: #a0c4ff;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 2;
}

.custom-table thead tr:nth-child(2) th {
  top: 34px;
}

.month-header {
  font-size: clamp(11px, 1.2vw, 13px);
}

.month-group-header {
  background: rgba(74, 158, 255, 0.1);
  color: #a0c4ff;
  font-weight: 600;
}

.sub-header {
  background: rgba(74, 158, 255, 0.06);
  color: rgba(160, 196, 255, 0.8);
  font-weight: 500;
  font-size: clamp(10px, 1.1vw, 12px);
}

.fixed-col {
  position: sticky;
  z-index: 3;
  background: rgba(15, 23, 42, 0.95);
}

thead .fixed-col {
  z-index: 5;
  background: rgba(15, 23, 42, 0.98);
}

.warehouse-col {
  left: 0;
  min-width: 90px;
}

.customer-col {
  left: 90px;
  min-width: 80px;
  border-left: 2px solid rgba(74, 158, 255, 0.4);
}

.month-col {
  min-width: 80px;
}

.custom-table tbody td {
  color: rgba(255, 255, 255, 0.85);
}

.custom-table tbody tr:hover td {
  background: rgba(74, 158, 255, 0.05);
}

.num-cell {
  color: rgba(255, 255, 255, 0.7);
  font-size: clamp(10px, 1.1vw, 12px);
}

.rate-cell {
  font-weight: 600;
  min-width: 70px;
}

.empty-cell {
  color: rgba(255, 255, 255, 0.4);
  padding: 32px 10px !important;
  font-size: 14px;
}
</style>
