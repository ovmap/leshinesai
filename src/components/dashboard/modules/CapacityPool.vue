<script setup lang="ts">
import { ref, onMounted, onUnmounted, Teleport, computed, nextTick, watch } from 'vue';
import {
  queryPowerPool,
  queryPowerPoolItemByPage,
  queryFromCityList,
  queryToCityList,
  queryLogisticList,
} from '../../../services/transportApi';
import { useDashboardDataStore } from '../../../stores/dashboardDataStore';

const dataStore = useDashboardDataStore();

// 表格数据
const tableData = ref<Array<{
  id: number;
  thirdParty: string;
  route: string;
  vehicleCount: number;
  vehicleType: string;
}>>([]);

// 弹窗相关状态
const modalVisible = ref(false);
const modalTitle = ref('车辆详情');
const modalData = ref<any[]>([]);
const modalLoading = ref(false);

// 分页相关状态
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);

// 表格容器引用和高度
const modalTableSectionRef = ref<HTMLElement | null>(null);
const modalTableScrollY = ref<number | undefined>(200);

// 筛选表单数据
const filterForm = ref({
  fromCity: '',
  toCity: '',
  logisticName: [] as string[],
  licenseNumber: '',
});

// 下拉选项数据
interface OptionItem {
  label: string;
  value: string;
}

const fromCityOptions = ref<OptionItem[]>([]);
const toCityOptions = ref<OptionItem[]>([]);
const logisticOptions = ref<OptionItem[]>([]);

// 下拉框开关状态
const isFromCityOpen = ref(false);
const isToCityOpen = ref(false);
const isLogisticOpen = ref(false);

// 搜索关键词
const fromCitySearch = ref('');
const toCitySearch = ref('');
const logisticSearch = ref('');

// 下拉框开关方法
const toggleFromCityDropdown = () => {
  if (isFromCityOpen.value) {
    isFromCityOpen.value = false;
    fromCitySearch.value = '';
  } else {
    closeAllDropdowns();
    isFromCityOpen.value = true;
    fromCitySearch.value = '';
  }
};

const toggleToCityDropdown = () => {
  if (isToCityOpen.value) {
    isToCityOpen.value = false;
    toCitySearch.value = '';
  } else {
    closeAllDropdowns();
    isToCityOpen.value = true;
    toCitySearch.value = '';
  }
};

const toggleLogisticDropdown = () => {
  if (isLogisticOpen.value) {
    isLogisticOpen.value = false;
    logisticSearch.value = '';
  } else {
    closeAllDropdowns();
    isLogisticOpen.value = true;
    logisticSearch.value = '';
  }
};

// 关闭所有下拉框
const closeAllDropdowns = () => {
  isFromCityOpen.value = false;
  isToCityOpen.value = false;
  isLogisticOpen.value = false;
  fromCitySearch.value = '';
  toCitySearch.value = '';
  logisticSearch.value = '';
};

// 选择方法
const selectFromCity = (value: string) => {
  if (value === '__reset__') {
    filterForm.value.fromCity = '';
    fromCitySearch.value = '';
    return;
  }
  filterForm.value.fromCity = value;
  closeAllDropdowns();
};

const selectToCity = (value: string) => {
  if (value === '__reset__') {
    filterForm.value.toCity = '';
    toCitySearch.value = '';
    return;
  }
  filterForm.value.toCity = value;
  closeAllDropdowns();
};

const selectLogistic = (value: string) => {
  if (value === '__reset__') {
    filterForm.value.logisticName = [];
    logisticSearch.value = '';
    return;
  }
  
  const index = filterForm.value.logisticName.indexOf(value);
  if (index > -1) {
    filterForm.value.logisticName.splice(index, 1);
  } else {
    filterForm.value.logisticName.push(value);
  }
};

// 显示文本
const selectedFromCityText = computed(() => {
  if (!filterForm.value.fromCity) return '始发城市';
  const option = fromCityOptions.value.find(item => item.value === filterForm.value.fromCity);
  return option ? option.label : '始发城市';
});

const selectedToCityText = computed(() => {
  if (!filterForm.value.toCity) return '目的城市';
  const option = toCityOptions.value.find(item => item.value === filterForm.value.toCity);
  return option ? option.label : '目的城市';
});

const selectedLogisticText = computed(() => {
  if (!filterForm.value.logisticName || filterForm.value.logisticName.length === 0) return '物流商';
  
  const selectedLabels = filterForm.value.logisticName
    .map(value => {
      const option = logisticOptions.value.find(item => item.value === value);
      return option ? option.label : '';
    })
    .filter(label => label);
  
  if (selectedLabels.length === 0) return '物流商';
  if (selectedLabels.length === 1) return selectedLabels[0];
  return `已选${selectedLabels.length}项`;
});

// 过滤后的选项
const filteredFromCityOptions = computed(() => {
  let filtered = fromCityOptions.value;
  if (fromCitySearch.value.trim()) {
    filtered = fromCityOptions.value.filter((option) =>
      option.label.toLowerCase().includes(fromCitySearch.value.toLowerCase()),
    );
  }
  return [{ value: '__reset__', label: '重置' }, ...filtered];
});

const filteredToCityOptions = computed(() => {
  let filtered = toCityOptions.value;
  if (toCitySearch.value.trim()) {
    filtered = toCityOptions.value.filter((option) =>
      option.label.toLowerCase().includes(toCitySearch.value.toLowerCase()),
    );
  }
  return [{ value: '__reset__', label: '重置' }, ...filtered];
});

const filteredLogisticOptions = computed(() => {
  const filtered = logisticOptions.value.filter((option) =>
    option.label.toLowerCase().includes(logisticSearch.value.toLowerCase()),
  );
  return [{ value: '__reset__', label: '重置' }, ...filtered];
});

// 自动滚动相关
const tableContainer = ref<HTMLDivElement | null>(null);
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let isScrolling = ref(false);
let currentScrollPosition = ref(0);

// 自动滚动函数
const startAutoScroll = () => {
  if (!tableContainer.value) return;
  
  stopAutoScroll();
  
  isScrolling.value = true;
  const container = tableContainer.value;
  const scrollHeight = container.scrollHeight;
  const clientHeight = container.clientHeight;
  const maxScroll = scrollHeight - clientHeight;
  
  if (maxScroll <= 0) return;
  
  const scrollStep = 2;
  const scrollInterval = 80;
  const resetDelay = 500;
  
  const scroll = () => {
    if (!isScrolling.value || !tableContainer.value) return;
    
    currentScrollPosition.value += scrollStep;
    
    if (currentScrollPosition.value >= maxScroll) {
      currentScrollPosition.value = 0;
      container.scrollTop = 0;
      
      scrollTimer = setTimeout(() => {
        if (isScrolling.value && tableContainer.value) {
          scroll();
        }
      }, resetDelay);
    } else {
      container.scrollTop = currentScrollPosition.value;
      scrollTimer = setTimeout(scroll, scrollInterval);
    }
  };
  
  scroll();
};

// 停止自动滚动
const stopAutoScroll = () => {
  isScrolling.value = false;
  if (scrollTimer) {
    clearTimeout(scrollTimer);
    scrollTimer = null;
  }
};

// 鼠标悬停时暂停滚动
const handleMouseEnter = () => {
  stopAutoScroll();
};

// 鼠标离开时从当前位置恢复滚动
const handleMouseLeave = () => {
  if (!tableContainer.value) return;
  
  currentScrollPosition.value = tableContainer.value.scrollTop;
  
  setTimeout(() => {
    if (tableContainer.value) {
      startAutoScroll();
    }
  }, 100);
};

// 查看详情
const handleViewDetail = () => {
  modalVisible.value = true;
  modalTitle.value = '车辆详情';
  currentPage.value = 1;
  total.value = 0;
  
  filterForm.value = {
    fromCity: '',
    toCity: '',
    logisticName: [],
    licenseNumber: '',
  };
  
  if (fromCityOptions.value.length === 0 || toCityOptions.value.length === 0 || logisticOptions.value.length === 0) {
    loadDropdownOptions();
  }
  
  fetchModalData();
};

// 加载数据
const loadData = async () => {
  try {
    const res = await queryPowerPool();
    if (res && Array.isArray(res.data)) {
      tableData.value = res.data.map((item: any, index: number) => ({
        id: index + 1,
        thirdParty: item.logisticName || '',
        route: item.route || '',
        vehicleCount: item.truckCount || 0,
        vehicleType: item.truckType || ''
      }));
      // 同步到数据 Store
      dataStore.updateModuleData('capacityPool', {
        list: tableData.value,
        total: tableData.value.length,
        rawData: res.data,
      });
    }
  } catch (error) {
    console.error('加载运力池数据失败:', error);
  }
};

// 加载下拉选项数据
const loadDropdownOptions = async () => {
  try {
    const fromCityRes = await queryFromCityList();
    if (fromCityRes && (fromCityRes.code === 0 || fromCityRes.code === 200) && Array.isArray(fromCityRes.data)) {
      fromCityOptions.value = fromCityRes.data.map((item: any) => ({
        label: item.name,
        value: item.code,
      }));
    }

    const toCityRes = await queryToCityList();
    if (toCityRes && (toCityRes.code === 0 || toCityRes.code === 200) && Array.isArray(toCityRes.data)) {
      toCityOptions.value = toCityRes.data.map((item: any) => ({
        label: item.name,
        value: item.code,
      }));
    }

    const logisticRes = await queryLogisticList();
    if (logisticRes && (logisticRes.code === 0 || logisticRes.code === 200) && Array.isArray(logisticRes.data)) {
      logisticOptions.value = logisticRes.data.map((item: any) => ({
        label: item.name,
        value: item.code,
      }));
    }
  } catch (error) {
    console.error('加载下拉选项数据失败:', error);
  }
};

// 获取弹窗详细数据
const fetchModalData = async (currentPageNum: number = currentPage.value) => {
  try {
    modalLoading.value = true;

    const result = await queryPowerPoolItemByPage({
      page: currentPageNum,
      pageSize: pageSize.value,
      fromCity: filterForm.value.fromCity || '',
      toCity: filterForm.value.toCity || '',
      logisticName: filterForm.value.logisticName || [],
      licenseNumber: filterForm.value.licenseNumber || '',
    });

    if (result && result.code === 200 && result.data) {
      total.value = result.total || 0;

      if (Array.isArray(result.data)) {
        modalData.value = result.data;
      } else if (result.data.list && Array.isArray(result.data.list)) {
        modalData.value = result.data.list;
      } else if (result.data.records && Array.isArray(result.data.records)) {
        modalData.value = result.data.records;
      } else {
        modalData.value = [];
      }
    } else {
      modalData.value = [];
      total.value = 0;
    }
  } catch (error) {
    console.error('获取弹窗数据失败:', error);
    modalData.value = [];
    total.value = 0;
  } finally {
    modalLoading.value = false;
  }
};

// 处理弹窗内容区域点击
const handleModalBodyClick = (event: Event) => {
  const target = event.target as HTMLElement;

  const isClickInsideDropdown =
    target.closest('.dropdown-item') ||
    target.closest('.dropdown-content') ||
    target.closest('.search-input') ||
    target.closest('.dropdown-option') ||
    target.closest('.done-btn');

  if (!isClickInsideDropdown) {
    closeAllDropdowns();
  }
};

// 打开详情弹窗
const showDetailModal = () => {
  modalVisible.value = true;
  modalTitle.value = '车辆详情';
  currentPage.value = 1;
  total.value = 0;
  
  nextTick(() => {
    calculateModalTableScrollY();
  });
  
  filterForm.value = {
    fromCity: '',
    toCity: '',
    logisticName: [],
    licenseNumber: '',
  };
  
  if (fromCityOptions.value.length === 0 || toCityOptions.value.length === 0 || logisticOptions.value.length === 0) {
    loadDropdownOptions();
  }
  
  fetchModalData();
};

// 关闭弹窗
const handleModalClose = () => {
  modalVisible.value = false;
  modalData.value = [];
  currentPage.value = 1;
  total.value = 0;
};

// 处理分页变化
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  fetchModalData(pagination.current);
};

// 计算总页数
const totalPages = computed(() => {
  return Math.ceil(total.value / pageSize.value);
});

// 查询数据
const handleQuery = () => {
  currentPage.value = 1;
  fetchModalData();
};

// 重置筛选条件
const handleReset = () => {
  filterForm.value = {
    fromCity: '',
    toCity: '',
    logisticName: [],
    licenseNumber: '',
  };
  currentPage.value = 1;
  fetchModalData();
};

// 表格列配置
const tableColumns = [
  { title: '线路', dataIndex: 'route', key: 'route', width: 180 },
  { title: '车牌号', dataIndex: 'licenseNumber', key: 'licenseNumber', width: 150 },
  { title: '车辆类型', dataIndex: 'truckType', key: 'truckType', width: 120 },
  { title: '归属类型', dataIndex: 'belongType', key: 'belongType', width: 120 },
  { title: '物流商', dataIndex: 'logisticName', key: 'logisticName', width: 150 },
  { title: '司机姓名', dataIndex: 'driverName', key: 'driverName', width: 100 },
  { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 120 },
];

// 计算弹窗表格滚动高度
const calculateModalTableScrollY = () => {
  nextTick(() => {
    if (modalTableSectionRef.value) {
      const containerHeight = modalTableSectionRef.value.clientHeight;
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 200;
      modalTableScrollY.value = calculatedHeight;
    }
  });
};

onMounted(() => {
  loadData();
  
  window.addEventListener('resize', calculateModalTableScrollY);
  
  watch(modalVisible, (newVal) => {
    if (newVal) {
      nextTick(() => {
        calculateModalTableScrollY();
        if (modalTableSectionRef.value) {
          const resizeObserver = new ResizeObserver(() => {
            calculateModalTableScrollY();
          });
          resizeObserver.observe(modalTableSectionRef.value);
          (modalTableSectionRef.value as any)._resizeObserver = resizeObserver;
        }
      });
    } else {
      if (modalTableSectionRef.value && (modalTableSectionRef.value as any)._resizeObserver) {
        (modalTableSectionRef.value as any)._resizeObserver.disconnect();
        (modalTableSectionRef.value as any)._resizeObserver = null;
      }
    }
  });
  
  loadDropdownOptions();
  
  setTimeout(() => {
    startAutoScroll();
  }, 1000);
});

onUnmounted(() => {
  stopAutoScroll();
  window.removeEventListener('resize', calculateModalTableScrollY);
  
  if (modalTableSectionRef.value && (modalTableSectionRef.value as any)._resizeObserver) {
    (modalTableSectionRef.value as any)._resizeObserver.disconnect();
  }
});
</script>

<template>
  <div class="capacity-pool-wrapper">
    <div class="header-bar">
      <h2 class="header-title">运力池</h2>
    </div>
    <div class="capacity-pool-container">
      <!-- 数据表格 -->
      <div class="table-wrapper">
        <!-- 固定的表头 -->
        <div class="table-header">
          <table class="data-table">
            <thead>
              <tr>
                <th>3PL</th>
                <th>线路</th>
                <th>车辆数量</th>
                <th>车辆类型</th>
                <th class="action-header">操作</th>
              </tr>
            </thead>
          </table>
        </div>
        
        <!-- 可滚动的表格内容 -->
        <div 
          class="table-container" 
          ref="tableContainer"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
        >
          <table class="data-table">
            <tbody>
              <tr v-if="tableData.length === 0">
                <td colspan="5" class="no-data">
                  暂无数据
                </td>
              </tr>
              <tr v-else v-for="row in tableData" :key="row.id">
                <td class="third-party">{{ row.thirdParty }}</td>
                <td class="route">{{ row.route }}</td>
                <td class="vehicle-count clickable" @click="showDetailModal">{{ row.vehicleCount }}</td>
                <td class="vehicle-type">{{ row.vehicleType }}</td>
                <td class="action-cell">
                  <button @click="handleViewDetail()" class="view-btn">
                    查看
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 详情弹窗 -->
      <Teleport to="body">
        <div v-if="modalVisible" class="custom-modal-overlay" @click.self="handleModalClose">
          <div class="custom-modal">
            <!-- 弹窗头部 -->
            <div class="modal-header">
              <h3 class="modal-title">{{ modalTitle }}</h3>
              <button class="close-btn" @click="handleModalClose">×</button>
            </div>

            <!-- 弹窗内容 -->
            <div class="modal-body" @click="handleModalBodyClick">
              <!-- 筛选区域 -->
              <div class="filter-section">
                <div class="filter-form">
                  <!-- 始发城市 -->
                  <div class="filter-item">
                    <div class="dropdown-item" :title="selectedFromCityText" @click="toggleFromCityDropdown">
                      <span class="dropdown-text">{{ selectedFromCityText }}</span>
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                      <div class="dropdown-content" v-show="isFromCityOpen && fromCityOptions?.length" @click.stop>
                        <div class="search-box">
                          <input 
                            v-model="fromCitySearch" 
                            type="text" 
                            placeholder="搜索始发城市..." 
                            class="search-input"
                            @click.stop 
                          />
                        </div>
                        <div class="options-list">
                          <div 
                            v-for="option in filteredFromCityOptions" 
                            :key="option.value" 
                            class="dropdown-option" 
                            :class="{
                              selected: option.value !== '__reset__' && filterForm.fromCity === option.value
                            }" 
                            @click.stop="selectFromCity(option.value)"
                          >
                            <span class="checkmark" v-if="option.value !== '__reset__' && filterForm.fromCity === option.value">✓</span>
                            {{ option.label }}
                          </div>
                          <div v-if="filteredFromCityOptions.length === 1 && fromCitySearch" class="no-results">
                            暂无搜索结果
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 目的城市 -->
                  <div class="filter-item">
                    <div class="dropdown-item" :title="selectedToCityText" @click="toggleToCityDropdown">
                      <span class="dropdown-text">{{ selectedToCityText }}</span>
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                      <div class="dropdown-content" v-show="isToCityOpen && toCityOptions?.length" @click.stop>
                        <div class="search-box">
                          <input 
                            v-model="toCitySearch" 
                            type="text" 
                            placeholder="搜索目的城市..." 
                            class="search-input"
                            @click.stop 
                          />
                        </div>
                        <div class="options-list">
                          <div 
                            v-for="option in filteredToCityOptions" 
                            :key="option.value" 
                            class="dropdown-option" 
                            :class="{
                              selected: option.value !== '__reset__' && filterForm.toCity === option.value
                            }" 
                            @click.stop="selectToCity(option.value)"
                          >
                            <span class="checkmark" v-if="option.value !== '__reset__' && filterForm.toCity === option.value">✓</span>
                            {{ option.label }}
                          </div>
                          <div v-if="filteredToCityOptions.length === 1 && toCitySearch" class="no-results">
                            暂无搜索结果
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 物流商 -->
                  <div class="filter-item">
                    <div class="dropdown-item" :title="selectedLogisticText" @click="toggleLogisticDropdown">
                      <span class="dropdown-text">{{ selectedLogisticText }}</span>
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                      <div class="dropdown-content" v-show="isLogisticOpen && logisticOptions?.length" @click.stop>
                        <div class="search-box">
                          <input v-model="logisticSearch" type="text" placeholder="搜索物流商..." class="search-input"
                            @click.stop />
                        </div>
                        <div class="options-list">
                          <div v-for="option in filteredLogisticOptions" :key="option.value" class="dropdown-option" :class="{
                            selected: filterForm.logisticName.includes(option.value),
                          }" @click.stop="selectLogistic(option.value)">
                            <span class="checkmark" v-if="filterForm.logisticName.includes(option.value)">✓</span>
                            {{ option.label }}
                          </div>
                          <div v-if="filteredLogisticOptions.length === 1 && logisticSearch" class="no-results">
                            暂无搜索结果
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 车牌号 -->
                  <div class="filter-item">
                    <input 
                      v-model="filterForm.licenseNumber" 
                      type="text" 
                      placeholder="请输入车牌号" 
                      class="license-number-input"
                    />
                  </div>

                  <!-- 操作按钮 -->
                  <div class="filter-actions">
                    <button @click="handleQuery" class="action-btn primary">
                      查询
                    </button>
                    <button @click="handleReset" class="action-btn">
                      重置
                    </button>
                  </div>
                </div>
              </div>

              <!-- 表格区域 -->
              <div class="table-section" ref="modalTableSectionRef">
                <div v-if="modalLoading" class="loading-mask">加载中...</div>
                <table class="modal-table">
                  <thead>
                    <tr>
                      <th v-for="col in tableColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                        {{ col.title }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in modalData" :key="row.id || row.licenseNumber">
                      <td v-for="col in tableColumns" :key="col.key">{{ row[col.dataIndex] || '-' }}</td>
                    </tr>
                    <tr v-if="modalData.length === 0 && !modalLoading">
                      <td :colspan="tableColumns.length" class="empty-cell">暂无数据</td>
                    </tr>
                  </tbody>
                </table>

                <!-- 分页 -->
                <div v-if="total > 0" class="pagination">
                  <span class="pagination-info">第 {{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, total) }} 条/共 {{ total }} 条</span>
                  <div class="pagination-controls">
                    <button
                      class="page-btn"
                      :disabled="currentPage <= 1"
                      @click="handleTableChange({ current: currentPage - 1, pageSize })"
                    >上一页</button>
                    <span class="page-number">{{ currentPage }} / {{ totalPages }}</span>
                    <button
                      class="page-btn"
                      :disabled="currentPage >= totalPages"
                      @click="handleTableChange({ current: currentPage + 1, pageSize })"
                    >下一页</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
.capacity-pool-wrapper {
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

.capacity-pool-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 表格包装器 */
.table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 固定的表头区域 */
.table-header {
  flex-shrink: 0;
  z-index: 10;
  position: relative;
}

.table-header .data-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.table-header thead th {
  padding: 0.375rem 0.25rem;
  text-align: center;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(0, 0, 0, 0.2);
  font-size: 0.5rem;
}

.table-header thead th:nth-child(1) { width: 18%; }
.table-header thead th:nth-child(2) { width: 28%; }
.table-header thead th:nth-child(3) { width: 14%; }
.table-header thead th:nth-child(4) { width: 22%; }
.table-header thead th:nth-child(5) { width: 18%; }

.action-header {
  padding-right: 1rem !important;
}

/* 可滚动的表格内容容器 */
.table-container {
  flex: 1;
  overflow: auto;
  scroll-behavior: smooth;
  min-height: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  color: white;
  font-size: 0.5rem;
  table-layout: fixed;
}

.table-container tbody tr {
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  transition: background 0.2s ease;
}

.table-container tbody tr:hover {
  background: rgba(74, 158, 255, 0.1);
}

.table-container td {
  padding: 0.375rem 0.25rem;
  vertical-align: middle;
  text-align: center;
}

.table-container td:nth-child(1) { width: 18%; }
.table-container td:nth-child(2) { width: 30%; }
.table-container td:nth-child(3) { width: 12%; }
.table-container td:nth-child(4) { width: 22%; }
.table-container td:nth-child(5) { width: 18%; }

.third-party {
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.route {
  color: rgba(255, 255, 255, 0.8);
}

.vehicle-count {
  color: #51cf66;
  font-weight: 600;
}

.vehicle-count.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.vehicle-count.clickable:hover {
  color: #51cf66;
  text-decoration: underline;
}

.vehicle-type {
  color: #51cf66;
  font-weight: 600;
}

.action-cell {
  text-align: center;
}

.view-btn {
  background: #4A9EFF;
  color: white;
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.6rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-btn:hover {
  background: #3A8EFF;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(74, 158, 255, 0.3);
}

.view-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(74, 158, 255, 0.2);
}

/* 滚动条样式 */
.table-container::-webkit-scrollbar {
  width: 4px;
}

.table-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.table-container::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.table-container::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.5);
}

.table-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}

.no-data {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 2rem;
  font-style: italic;
}

/* 弹窗样式 */
.custom-modal-overlay {
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

.custom-modal {
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
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
  padding: 16px;
  position: relative;
  z-index: 10;
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
  gap: 8px;
}

.dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  padding: 0.25rem 0.4rem;
  background: #081f40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(0.625rem);
  width: 140px;
  height: 1.8rem;
  min-height: 1.8rem;
  z-index: 100;
}

.dropdown-item:hover {
  color: white;
}

.dropdown-icon {
  width: 0.5rem;
  height: 0.5rem;
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.3s ease;
}

.dropdown-item:hover .dropdown-icon {
  color: white;
}

.dropdown-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #081f40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.15rem;
  box-shadow: 0 0.1rem 0.4rem rgba(0, 0, 0, 0.2);
  z-index: 1000;
  margin-top: 0.05rem;
  min-width: 5rem;
  max-width: 15rem;
}

.search-box {
  padding: 0.2rem;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
}

.search-input {
  width: 100%;
  padding: 0.15rem 0.3rem;
  background: rgba(0, 0, 0, 0.3);
  border: 0.0625rem solid rgba(59, 130, 246, 0.4);
  border-radius: 0.125rem;
  color: white;
  font-size: 0.65rem;
  outline: none;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.search-input:focus {
  border-color: rgba(59, 130, 246, 0.8);
  background: rgba(0, 0, 0, 0.5);
}

.options-list {
  max-height: 6rem;
  position: relative;
  overflow: hidden;
  overflow-y: auto;
}

.options-list::-webkit-scrollbar {
  width: 0.25rem;
}

.options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 0.125rem;
}

.options-list::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.6);
  border-radius: 0.125rem;
}

.options-list::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.8);
}

.options-list {
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.2);
}

.dropdown-option {
  padding: 0.12rem 0.3rem;
  color: white;
  font-size: 0.65rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  line-height: 1.1;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.dropdown-option:hover {
  background: rgba(59, 130, 246, 0.3);
}

.dropdown-option.selected {
  background: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}

.checkmark {
  color: #00ff88;
  font-weight: bold;
  font-size: 0.8rem;
}

.no-results {
  padding: 0.25rem 0.6rem;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.75rem;
  text-align: center;
  font-style: italic;
  line-height: 1.2;
}

.license-number-input {
  width: 10.2rem;
  height: 1.8rem;
  min-height: 1.8rem;
  padding: 0 0.4rem;
  background: #081f40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.7rem;
  outline: none;
  transition: all 0.3s ease;
  backdrop-filter: blur(0.625rem);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.license-number-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.license-number-input:hover {
  border-color: rgba(59, 130, 246, 0.8);
}

.license-number-input:focus {
  border-color: rgba(59, 130, 246, 1);
  background: rgba(8, 31, 64, 0.95);
  color: white;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.action-btn {
  height: 1.6rem;
  padding: 0 12px;
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
  min-height: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
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

.modal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.modal-table th,
.modal-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  white-space: nowrap;
}

.modal-table th {
  background: rgba(74, 158, 255, 0.1);
  color: #a0c4ff;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
}

.modal-table td {
  color: rgba(255, 255, 255, 0.8);
}

.modal-table tr:hover td {
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
  flex-shrink: 0;
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
  border-radius: 4px;
}

.table-section::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.4);
  border-radius: 4px;
}

.table-section::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.6);
}
</style>
