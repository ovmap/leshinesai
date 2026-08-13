<template>
  <div class="global-filter-bar">
    <div class="filter-dropdown-group">
      <!-- 始发仓下拉框 -->
      <div class="filter-dropdown-item" @click="toggleWarehouseDropdown">
        <span class="dropdown-text">{{ displayWarehouse }}</span>
        <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6,9 12,15 18,9"></polyline>
        </svg>
        <div class="dropdown-content" v-show="isWarehouseOpen" @click.stop>
          <div class="search-box">
            <input
              v-model="warehouseSearch"
              type="text"
              placeholder="搜索始发仓"
              class="search-input"
              @click.stop
            />
          </div>
          <div class="options-list">
            <div
              v-for="option in filteredWarehouseOptions"
              :key="option"
              class="dropdown-option"
              :class="{ selected: selectedWarehouse.includes(option) }"
              @click.stop="selectWarehouse(option)"
            >
              <span class="checkmark" v-if="selectedWarehouse.includes(option)">✓</span>
              {{ option }}
            </div>
            <div v-if="filteredWarehouseOptions.length === 0" class="no-results">
              无搜索结果
            </div>
          </div>
          <div class="dropdown-footer">
            <button class="done-btn" @click="closeWarehouseDropdown">完成</button>
          </div>
        </div>
      </div>

      <!-- 目的省下拉框 -->
      <div class="filter-dropdown-item" @click="toggleProvinceDropdown">
        <span class="dropdown-text">{{ displayProvince }}</span>
        <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6,9 12,15 18,9"></polyline>
        </svg>
        <div class="dropdown-content" v-show="isProvinceOpen" @click.stop>
          <div class="search-box">
            <input
              v-model="provinceSearch"
              type="text"
              placeholder="搜索目的省"
              class="search-input"
              @click.stop
            />
          </div>
          <div class="options-list">
            <div
              v-for="option in filteredProvinceOptions"
              :key="option"
              class="dropdown-option"
              :class="{ selected: selectedProvince.includes(option) }"
              @click.stop="selectProvince(option)"
            >
              <span class="checkmark" v-if="selectedProvince.includes(option)">✓</span>
              {{ option }}
            </div>
            <div v-if="filteredProvinceOptions.length === 0" class="no-results">
              无搜索结果
            </div>
          </div>
          <div class="dropdown-footer">
            <button class="done-btn" @click="closeProvinceDropdown">完成</button>
          </div>
        </div>
      </div>

      <!-- 目的RDC下拉框 -->
      <div class="filter-dropdown-item" @click="toggleRdcDropdown">
        <span class="dropdown-text">{{ displayRdc }}</span>
        <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6,9 12,15 18,9"></polyline>
        </svg>
        <div class="dropdown-content" v-show="isRdcOpen" @click.stop>
          <div class="search-box">
            <input
              v-model="rdcSearch"
              type="text"
              placeholder="搜索目的RDC"
              class="search-input"
              @click.stop
            />
          </div>
          <div class="options-list">
            <div
              v-for="option in filteredRdcOptions"
              :key="option"
              class="dropdown-option"
              :class="{ selected: selectedRdc.includes(option) }"
              @click.stop="selectRdc(option)"
            >
              <span class="checkmark" v-if="selectedRdc.includes(option)">✓</span>
              {{ option }}
            </div>
            <div v-if="filteredRdcOptions.length === 0" class="no-results">
              无搜索结果
            </div>
          </div>
          <div class="dropdown-footer">
            <button class="done-btn" @click="closeRdcDropdown">完成</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useGlobalFilterStore } from '../../stores/globalFilterStore'
import { useSelectOptionsStore } from '../../stores/selectOptionsStore'

const globalFilterStore = useGlobalFilterStore()
const selectOptionsStore = useSelectOptionsStore()

// 下拉框开关状态
const isWarehouseOpen = ref(false)
const isProvinceOpen = ref(false)
const isRdcOpen = ref(false)

// 搜索关键词
const warehouseSearch = ref('')
const provinceSearch = ref('')
const rdcSearch = ref('')

// 从 store 获取选中值
const selectedWarehouse = computed(() => globalFilterStore.selectedWarehouse)
const selectedProvince = computed(() => globalFilterStore.selectedProvince)
const selectedRdc = computed(() => globalFilterStore.selectedRdc)

// 文本截断处理
const maxDisplayLength = 15

const truncateText = (items: string[], maxLength: number) => {
  if (items.length === 0) return '全部'
  if (items.length === 1) return items[0]

  let result = items[0]
  let count = 1

  for (let i = 1; i < items.length; i++) {
    const nextText = result + ', ' + items[i]
    if (nextText.length <= maxLength) {
      result = nextText
      count++
    } else {
      break
    }
  }

  if (count < items.length) {
    result += ` +${items.length - count}`
  }

  return result
}

// 显示文本
const displayWarehouse = computed(() => {
  if (selectedWarehouse.value.length === 0) return '始发仓'
  return truncateText(selectedWarehouse.value, maxDisplayLength)
})

const displayProvince = computed(() => {
  if (selectedProvince.value.length === 0) return '目的省'
  return truncateText(selectedProvince.value, maxDisplayLength)
})

const displayRdc = computed(() => {
  if (selectedRdc.value.length === 0) return '目的RDC'
  return truncateText(selectedRdc.value, maxDisplayLength)
})

// 过滤后的选项
const filteredWarehouseOptions = computed(() => {
  return selectOptionsStore.fromWarehouseOptions.filter(option =>
    option.toLowerCase().includes(warehouseSearch.value.toLowerCase())
  )
})

const filteredProvinceOptions = computed(() => {
  return selectOptionsStore.provinceOptions.filter(option =>
    option.toLowerCase().includes(provinceSearch.value.toLowerCase())
  )
})

const filteredRdcOptions = computed(() => {
  return selectOptionsStore.rdcOptions.filter(option =>
    option.toLowerCase().includes(rdcSearch.value.toLowerCase())
  )
})

// 下拉框切换方法
const toggleWarehouseDropdown = () => {
  isProvinceOpen.value = false
  isRdcOpen.value = false
  provinceSearch.value = ''
  rdcSearch.value = ''
  isWarehouseOpen.value = !isWarehouseOpen.value
}

const toggleProvinceDropdown = () => {
  isWarehouseOpen.value = false
  isRdcOpen.value = false
  warehouseSearch.value = ''
  rdcSearch.value = ''
  isProvinceOpen.value = !isProvinceOpen.value
}

const toggleRdcDropdown = () => {
  isWarehouseOpen.value = false
  isProvinceOpen.value = false
  warehouseSearch.value = ''
  provinceSearch.value = ''
  isRdcOpen.value = !isRdcOpen.value
}

// 关闭下拉框并触发联动
const closeWarehouseDropdown = () => {
  isWarehouseOpen.value = false
  warehouseSearch.value = ''
  globalFilterStore.syncToControlStore()
}

const closeProvinceDropdown = () => {
  isProvinceOpen.value = false
  provinceSearch.value = ''
  globalFilterStore.syncToControlStore()
}

const closeRdcDropdown = () => {
  isRdcOpen.value = false
  rdcSearch.value = ''
  globalFilterStore.syncToControlStore()
}

// 选择选项
const selectWarehouse = (option: string) => {
  globalFilterStore.toggleWarehouse(option)
}

const selectProvince = (option: string) => {
  globalFilterStore.toggleProvince(option)
}

const selectRdc = (option: string) => {
  globalFilterStore.toggleRdc(option)
}

// 点击外部关闭
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.filter-dropdown-item')) {
    const wasAnyOpen = isWarehouseOpen.value || isProvinceOpen.value || isRdcOpen.value
    isWarehouseOpen.value = false
    isProvinceOpen.value = false
    isRdcOpen.value = false
    warehouseSearch.value = ''
    provinceSearch.value = ''
    rdcSearch.value = ''
    if (wasAnyOpen) {
      globalFilterStore.syncToControlStore()
    }
  }
}

onMounted(() => {
  // 加载下拉选项数据
  selectOptionsStore.ensureDataLoaded()
  
  // 添加全局点击事件监听
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.global-filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 1;
}

.filter-dropdown-group {
  display: flex;
  gap: 12px;
}

.filter-dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 4px 12px;
  background: rgba(8, 31, 64, 0.8);
  border: 1px solid rgba(74, 158, 255, 0.4);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 80px;
  max-width: 120px;
}

.filter-dropdown-item:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(74, 158, 255, 0.7);
  color: #fff;
}

.dropdown-icon {
  width: 12px;
  height: 12px;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.filter-dropdown-item:hover .dropdown-icon {
  color: #60a5fa;
}

.dropdown-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  letter-spacing: 0.5px;
}

.dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, rgba(8, 31, 64, 0.98) 0%, rgba(15, 40, 80, 0.98) 100%);
  border: 1px solid rgba(59, 130, 246, 0.6);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 12px rgba(59, 130, 246, 0.2);
  z-index: 1000;
  margin-top: 6px;
  min-width: 120px;
  max-width: 160px;
  backdrop-filter: blur(16px);
}

.search-box {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.3);
}

.search-input {
  width: 100%;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 3px;
  color: white;
  font-size: 12px;
  outline: none;
  transition: all 0.3s ease;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.search-input:focus {
  border-color: rgba(59, 130, 246, 0.8);
  background: rgba(0, 0, 0, 0.6);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
}

.options-list {
  max-height: 200px;
  overflow-y: auto;
}

.options-list::-webkit-scrollbar {
  width: 4px;
}

.options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.options-list::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.6);
  border-radius: 2px;
}

.options-list::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.8);
}

.dropdown-option {
  padding: 4px 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  border-left: 2px solid transparent;
}

.dropdown-option:hover {
  background: rgba(59, 130, 246, 0.2);
  border-left-color: rgba(59, 130, 246, 0.6);
  color: #60a5fa;
}

.dropdown-option.selected {
  background: rgba(59, 130, 246, 0.3);
  border-left-color: #00ff88;
  color: #60a5fa;
}

.checkmark {
  color: #00ff88;
  font-weight: bold;
  font-size: 11px;
  text-shadow: 0 0 4px rgba(0, 255, 136, 0.4);
}

.no-results {
  padding: 6px 10px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  text-align: center;
  font-style: italic;
}

.dropdown-footer {
  padding: 6px 8px;
  border-top: 1px solid rgba(59, 130, 246, 0.3);
  text-align: center;
}

.done-btn {
  padding: 4px 16px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.9) 100%);
  border: 1px solid rgba(59, 130, 246, 0.6);
  border-radius: 3px;
  color: white;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.done-btn:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 1) 0%, rgba(37, 99, 235, 1) 100%);
  border-color: rgba(59, 130, 246, 0.8);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
  transform: translateY(-1px);
}
</style>
