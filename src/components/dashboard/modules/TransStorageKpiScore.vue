<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import { useDashboardDataStore } from '../../../stores/dashboardDataStore';
import { queryTransStorageKpiScore, exportTransStorageKpiScore, queryAssessmentUnit } from '../../../services/transportApi';

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>();

const dataStore = useDashboardDataStore();

// 初始化默认日期（前2个月的首月）
const getInitialDate = (): Dayjs => {
  return dayjs().subtract(2, 'month').startOf('month');
};

const selectedMonth = ref<Dayjs>(getInitialDate());
const selectedAssessUnit = ref<string[]>([]);
const selectedCustomer = ref<string[]>([]);

// 下拉框选项
const customerOptions = ref<Array<{ code: string; name: string }>>([
  { code: 'storage', name: '仓储运输多业务-仓储' },
  { code: 'transport', name: '仓储运输多业务-运输' },
]);
const assessUnitOptions = ref<Array<{ code: string; name: string }>>([]);

// 搜索关键词
const assessUnitSearch = ref('');
const customerSearch = ref('');

// 过滤后的考核单元选项（包含重置选项）
const filteredAssessUnitOptions = computed(() => {
  let filtered: { code: string; name: string }[] = [];
  
  if (!assessUnitSearch.value.trim()) {
    filtered = assessUnitOptions.value;
  } else {
    const searchLower = assessUnitSearch.value.toLowerCase();
    filtered = assessUnitOptions.value.filter((option: { code: string; name: string }) =>
      option.name.toLowerCase().includes(searchLower)
    );
  }
  
  return [{ code: '__reset__', name: '重置' }, ...filtered];
});

// 过滤后的业务分类选项（包含重置选项）
const filteredCustomerOptions = computed(() => {
  let filtered: { code: string; name: string }[] = [];
  
  if (!customerSearch.value.trim()) {
    filtered = customerOptions.value;
  } else {
    const searchLower = customerSearch.value.toLowerCase();
    filtered = customerOptions.value.filter((option: { code: string; name: string }) =>
      option.name.toLowerCase().includes(searchLower)
    );
  }
  
  return [{ code: '__reset__', name: '重置' }, ...filtered];
});

// 下拉框开关状态
const isAssessUnitOpen = ref(false);
const isCustomerOpen = ref(false);

// 表格数据
const tableData = ref<any[]>([]);
const loading = ref(false);
const exportLoading = ref(false);

// 表格容器引用和高度
const tableSectionRef = ref<HTMLElement | null>(null);
const tableScrollY = ref<number | undefined>(200);

// 文本截断处理
const maxDisplayLength = 15;

const truncateText = (items: string[], maxLength: number) => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];

  let result = items[0];
  let count = 1;

  for (let i = 1; i < items.length; i++) {
    const nextText = result + ', ' + items[i];
    if (nextText.length <= maxLength) {
      result = nextText;
      count++;
    } else {
      break;
    }
  }

  if (count < items.length) {
    result += ` +${items.length - count}`;
  }

  return result;
};

// 显示文本
const selectedAssessUnitText = computed(() => {
  if (selectedAssessUnit.value.length === 0) return '考核单元';
  const selectedLabels = selectedAssessUnit.value.map(code => {
    const option = assessUnitOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return truncateText(selectedLabels, maxDisplayLength);
});

const fullAssessUnitText = computed(() =>
  selectedAssessUnit.value.length > 0
    ? selectedAssessUnit.value
        .map(code => {
          const option = assessUnitOptions.value.find(item => item.code === code);
          return option ? option.name : code;
        })
        .join(', ')
    : '考核单元',
);

const selectedCustomerText = computed(() => {
  if (selectedCustomer.value.length === 0) return '业务分类';
  const selectedLabels = selectedCustomer.value.map(code => {
    const option = customerOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return truncateText(selectedLabels, maxDisplayLength);
});

const fullCustomerText = computed(() =>
  selectedCustomer.value.length > 0
    ? selectedCustomer.value
        .map(code => {
          const option = customerOptions.value.find(item => item.code === code);
          return option ? option.name : code;
        })
        .join(', ')
    : '业务分类',
);

// 下拉框切换
const toggleAssessUnitDropdown = () => {
  if (isAssessUnitOpen.value) {
    isAssessUnitOpen.value = false;
    assessUnitSearch.value = '';
    fetchData();
  } else {
    closeAllDropdowns();
    isAssessUnitOpen.value = true;
    assessUnitSearch.value = '';
  }
};

const toggleCustomerDropdown = () => {
  if (isCustomerOpen.value) {
    isCustomerOpen.value = false;
    customerSearch.value = '';
    fetchData();
  } else {
    closeAllDropdowns();
    isCustomerOpen.value = true;
    customerSearch.value = '';
  }
};

const closeAllDropdowns = () => {
  isAssessUnitOpen.value = false;
  isCustomerOpen.value = false;
  assessUnitSearch.value = '';
  customerSearch.value = '';
};

// 选择选项（多选）
const selectAssessUnit = (code: string) => {
  if (code === '__reset__') {
    selectedAssessUnit.value = [];
    assessUnitSearch.value = '';
    return;
  }

  const index = selectedAssessUnit.value.indexOf(code);
  if (index > -1) {
    selectedAssessUnit.value.splice(index, 1);
  } else {
    selectedAssessUnit.value.push(code);
  }
};

const selectCustomer = (code: string) => {
  if (code === '__reset__') {
    selectedCustomer.value = [];
    customerSearch.value = '';
    return;
  }

  const index = selectedCustomer.value.indexOf(code);
  if (index > -1) {
    selectedCustomer.value.splice(index, 1);
  } else {
    selectedCustomer.value.push(code);
  }
};

// 表格列定义
const tableColumns = computed(() => [
  {
    title: '年月',
    key: 'month',
    dataIndex: 'month',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: string }) => {
      if (!text) return '-';
      if (text.length === 6) {
        const year = text.substring(0, 4);
        const month = parseInt(text.substring(4, 6));
        return `${year}年${month}月`;
      } else if (text.includes('-')) {
        const parts = text.split('-');
        if (parts.length === 2 && parts[0] && parts[1]) {
          return `${parts[0]}年${parseInt(parts[1])}月`;
        }
      }
      return text;
    },
  },
  {
    title: '业务分类',
    key: 'bizType',
    dataIndex: 'bizType',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '考核单元',
    key: 'assessUnit',
    dataIndex: 'assessUnit',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '物流商',
    key: 'logistic',
    dataIndex: 'logistic',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '考核项目',
    key: 'assessProject',
    dataIndex: 'assessProject',
    width: 150,
    align: 'center' as const,
  },
  {
    title: '权重',
    key: 'weight',
    dataIndex: 'weight',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: string }) => {
      return text || '-';
    },
  },
  {
    title: '项目得分',
    key: 'projectScore',
    dataIndex: 'projectScore',
    width: 120,
    align: 'center' as const,
    customRender: ({ text }: { text: string | number }) => {
      if (text === null || text === undefined || text === '') return '-';
      return String(text);
    },
  },
  {
    title: '最终得分',
    key: 'finalScore',
    dataIndex: 'finalScore',
    width: 120,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      if (text === null || text === undefined) return '-';
      return String(text);
    },
  },
]);

// 获取数据
const fetchData = async () => {
  if (!selectedMonth.value) {
    return;
  }

  try {
    loading.value = true;
    tableData.value = [];
    
    const startDate = selectedMonth.value.format('YYYY-MM');
    const endDate = selectedMonth.value.format('YYYY-MM');
    
    const params = {
      startDate,
      endDate,
      customer: selectedCustomer.value.length > 0
        ? selectedCustomer.value.map(code => {
            const option = customerOptions.value.find(item => item.code === code);
            return option ? option.name : code;
          })
        : [],
      assessUnit: selectedAssessUnit.value.length > 0
        ? selectedAssessUnit.value.map(code => {
            const option = assessUnitOptions.value.find(item => item.code === code);
            return option ? option.name : code;
          })
        : [],
    };

    const result = await queryTransStorageKpiScore(params);
    
    if (result && result.code === 200 && result.data) {
      dataStore.updateModuleData('transStorageKpiScore', result.data);
      if (Array.isArray(result.data)) {
        const processedData: any[] = [];
        
        result.data.forEach((item: any, index: number) => {
          const isAllNull = !item.month && 
                           !item.customer && 
                           !item.bizType && 
                           !item.assessUnit && 
                           !item.logistic && 
                           !item.assessProject && 
                           !item.weight && 
                           (item.projectScore === null || item.projectScore === undefined || item.projectScore === '') &&
                           (item.finalScore === null || item.finalScore === undefined);
          
          if (!isAllNull) {
            processedData.push({
              key: `row_${index}`,
              month: item.month || '',
              customer: item.customer || '',
              bizType: item.bizType || '',
              assessUnit: item.assessUnit || '',
              logistic: item.logistic || '',
              assessProject: item.assessProject || '',
              weight: item.weight || '',
              projectScore: item.projectScore !== undefined && item.projectScore !== null ? String(item.projectScore) : '',
              finalScore: item.finalScore !== undefined && item.finalScore !== null ? item.finalScore : null,
            });
          }
        });
        
        tableData.value = processedData;
      } else {
        tableData.value = [];
      }
    } else {
      message.error(result?.msg || '获取数据失败');
      tableData.value = [];
    }
  } catch (error) {
    console.error('获取数据失败:', error);
    message.error('获取数据失败');
    tableData.value = [];
  } finally {
    loading.value = false;
  }
};

// 监听月份变化
watch(selectedMonth, () => {
  fetchData();
}, { deep: true });

// 计算表格滚动高度
const calculateTableScrollY = () => {
  nextTick(() => {
    if (tableSectionRef.value) {
      const containerHeight = tableSectionRef.value.clientHeight;
      const tableElement = tableSectionRef.value.querySelector('.ant-table');
      let headerHeight = 0;
      if (tableElement) {
        const thead = tableElement.querySelector('.ant-table-thead');
        if (thead) headerHeight = thead.clientHeight;
      }
      const calculatedHeight = containerHeight > 300 ? containerHeight - headerHeight - 20 : 200;
      tableScrollY.value = Math.max(calculatedHeight, 200);
    }
  });
};

// 点击外部关闭下拉框
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.dropdown-item') && !target.closest('.dropdown-content')) {
    if (isAssessUnitOpen.value || isCustomerOpen.value) {
      closeAllDropdowns();
      fetchData();
    }
  }
};

// 导出数据
const handleExport = async () => {
  if (!selectedMonth.value) {
    message.warning('请先选择月份');
    return;
  }

  if (!tableData.value || tableData.value.length === 0) {
    message.warning('没有数据可以导出');
    return;
  }

  try {
    exportLoading.value = true;
    
    const startDate = selectedMonth.value.format('YYYY-MM');
    const endDate = selectedMonth.value.format('YYYY-MM');
    
    const params = {
      startDate,
      endDate,
      customer: selectedCustomer.value.length > 0
        ? selectedCustomer.value.map(code => {
            const option = customerOptions.value.find(item => item.code === code);
            return option ? option.name : code;
          })
        : [],
      assessUnit: selectedAssessUnit.value.length > 0
        ? selectedAssessUnit.value.map(code => {
            const option = assessUnitOptions.value.find(item => item.code === code);
            return option ? option.name : code;
          })
        : [],
    };

    const result = await exportTransStorageKpiScore(params);
    
    if (result && result.code === 200 && result.data) {
      const url = result.data;
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('导出成功');
    } else {
      message.error(result?.msg || '导出失败');
    }
  } catch (error: any) {
    console.error('导出失败:', error);
    message.error(error?.msg || '导出失败');
  } finally {
    exportLoading.value = false;
  }
};

// 获取考核单元列表
const fetchAssessUnitOptions = async () => {
  try {
    const result = await queryAssessmentUnit();
    if (result && result.code === 200 && result.data) {
      if (Array.isArray(result.data)) {
        assessUnitOptions.value = result.data.map((item: any) => ({
          code: item.code || '',
          name: item.name || ''
        })).filter((item: { code: string; name: string }) => item.code && item.name);
      }
    }
  } catch (error) {
    console.error('获取考核单元列表失败:', error);
    assessUnitOptions.value = [];
  }
};

// 组件挂载
onMounted(async () => {
  await fetchAssessUnitOptions();
  await fetchData();
  document.addEventListener('click', handleClickOutside);
  
  calculateTableScrollY();
  
  window.addEventListener('resize', calculateTableScrollY);
  
  if (tableSectionRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      calculateTableScrollY();
    });
    resizeObserver.observe(tableSectionRef.value);
    
    (tableSectionRef.value as any)._resizeObserver = resizeObserver;
  }
});

// 组件卸载
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', calculateTableScrollY);
  
  if (tableSectionRef.value && (tableSectionRef.value as any)._resizeObserver) {
    (tableSectionRef.value as any)._resizeObserver.disconnect();
  }
});
</script>

<template>
  <div class="kpi-score-container">
    <div class="header-bar">
      <h2 class="header-title">运输仓储多业务KPI评分</h2>
    </div>
    <!-- 控制面板 -->
    <div class="control-panel">
      <div class="filter-group">
        <!-- 月份选择器 -->
        <div class="date-item">
          <a-date-picker
            v-model:value="selectedMonth"
            picker="month"
            format="YYYY-MM"
            placeholder="请选择月份"
            class="month-picker"
          />
        </div>
        
        <!-- 业务分类下拉框 -->
        <div class="dropdown-item" :title="fullCustomerText" @click.stop="toggleCustomerDropdown">
          <span class="dropdown-text">{{ selectedCustomerText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isCustomerOpen" @click.stop>
            <div class="search-box">
              <input 
                v-model="customerSearch" 
                type="text" 
                placeholder="搜索业务分类..." 
                class="search-input"
                @click.stop 
              />
            </div>
            <div class="options-list">
              <div 
                v-for="option in filteredCustomerOptions" 
                :key="option.code" 
                class="dropdown-option"
                :class="{ 
                  'selected': option.code !== '__reset__' && selectedCustomer.includes(option.code),
                  'reset-option': option.code === '__reset__'
                }" 
                @click.stop="selectCustomer(option.code)"
              >
                <span class="checkmark" v-if="option.code !== '__reset__' && selectedCustomer.includes(option.code)">✓</span>
                {{ option.name }}
              </div>
              <div v-if="filteredCustomerOptions.length === 1 && customerSearch" class="no-results">
                暂无搜索结果
              </div>
            </div>
          </div>
        </div>

        <!-- 考核单元下拉框 -->
        <div class="dropdown-item" :title="fullAssessUnitText" @click.stop="toggleAssessUnitDropdown">
          <span class="dropdown-text">{{ selectedAssessUnitText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isAssessUnitOpen" @click.stop>
            <div class="search-box">
              <input 
                v-model="assessUnitSearch" 
                type="text" 
                placeholder="搜索考核单元..." 
                class="search-input"
                @click.stop 
              />
            </div>
            <div class="options-list">
              <div 
                v-for="option in filteredAssessUnitOptions" 
                :key="option.code" 
                class="dropdown-option"
                :class="{ 
                  'selected': option.code !== '__reset__' && selectedAssessUnit.includes(option.code),
                  'reset-option': option.code === '__reset__'
                }" 
                @click.stop="selectAssessUnit(option.code)"
              >
                <span class="checkmark" v-if="option.code !== '__reset__' && selectedAssessUnit.includes(option.code)">✓</span>
                {{ option.name }}
              </div>
              <div v-if="filteredAssessUnitOptions.length === 1 && assessUnitSearch" class="no-results">
                暂无搜索结果
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 操作按钮组 -->
      <div class="action-buttons">
        <a-button @click="handleExport" class="action-btn" :loading="exportLoading">
          导出
        </a-button>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="table-section" ref="tableSectionRef">
      <a-spin :spinning="loading">
        <a-table 
          :columns="tableColumns" 
          :data-source="tableData" 
          :pagination="false"
          size="small" 
          class="custom-table"
          :scroll="{ x: 'max-content', y: tableScrollY }"
        />
      </a-spin>
    </div>
  </div>
</template>

<style scoped>
.kpi-score-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
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
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
}
.header-title {
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.control-panel {
  width: 100%;
  min-height: 60px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  position: relative;
  z-index: 100;
  overflow: visible;
}

.filter-group {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  position: relative;
  overflow: visible;
}

.date-item {
  flex-shrink: 1;
}

.month-picker {
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
  min-width: 8rem;
  max-width: 10rem;
  padding: 0.3rem 0.5rem;
}
.month-picker:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}
:deep(.ant-picker-input) input {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
}
:deep(.ant-picker-suffix) {
  color: rgba(255, 255, 255, 0.7);
}

.dropdown-item {
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
  min-width: 6rem;
  max-width: 7rem;
  padding: 0.3rem 0.5rem;
  flex-shrink: 1;
}
.dropdown-item:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}
.dropdown-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dropdown-icon {
  width: 0.8rem;
  height: 0.8rem;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease;
}
.dropdown-content {
  position: absolute;
  top: calc(100% + 0.2rem);
  left: 0;
  right: 0;
  background: #081F40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.1875rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
  z-index: 1001;
  max-height: 12rem;
  overflow: hidden;
  backdrop-filter: blur(0.625rem);
  display: flex;
  flex-direction: column;
}
.search-box {
  padding: 0.2rem;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
  flex-shrink: 0;
}
.search-input {
  width: 100%;
  padding: 0.15rem 0.3rem;
  background: rgba(0, 0, 0, 0.3);
  border: 0.0625rem solid rgba(59, 130, 246, 0.4);
  border-radius: 0.125rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  outline: none;
  transition: all 0.2s ease;
}
.search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}
.search-input:focus {
  border-color: rgba(59, 130, 246, 0.8);
  background: rgba(0, 0, 0, 0.5);
}
.options-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 7.6rem;
  padding: 0.2rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.3);
}
.options-list::-webkit-scrollbar {
  width: 6px;
}
.options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}
.options-list::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
}
.options-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(74, 158, 255, 0.8) 100%);
  border-color: rgba(59, 130, 246, 0.5);
}
.dropdown-option {
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
.dropdown-option.reset-option {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
  margin-bottom: 0.1rem;
  padding-bottom: 0.3rem;
  position: relative;
}
.dropdown-option.reset-option::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0.0625rem;
  background: rgba(59, 130, 246, 0.3);
}
.dropdown-option.reset-option:hover {
  background: rgba(59, 130, 246, 0.3);
  color: rgba(255, 255, 255, 1);
}
.dropdown-option:hover {
  background: rgba(59, 130, 246, 0.3);
}
.dropdown-option.selected {
  background: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}
.dropdown-option .checkmark {
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
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.action-btn {
  height: 1.8rem;
  background: #2873cc;
  box-shadow: 1px 1px 1px 0px #1e6cc8, inset 0px 1px 1px 0px #c5dfff;
  border-radius: 2px;
  border: none;
  color: white;
  font-weight: 500;
  transition: all 0.3s;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0 0.75rem;
}
.action-btn:hover:not(:disabled) {
  background: #1e6cc8;
  box-shadow: 1px 1px 1px 0px #1c5fb8, inset 0px 1px 1px 0px #b8d5ff;
}
.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.table-section {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  padding: 1rem;
}
:deep(.ant-spin-container) {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
:deep(.ant-table-wrapper) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.custom-table :deep(.ant-table) {
  background: transparent;
}
.custom-table :deep(.ant-table-thead > tr > th) {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(0, 0, 0, 0.2);
  white-space: normal;
  word-wrap: break-word;
  word-break: break-all;
  line-height: 1.4;
  font-size: 0.75rem;
}
.custom-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  color: white;
  font-size: 0.7rem;
  text-align: center;
}
.custom-table :deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(74, 158, 255, 0.1);
}
.custom-table :deep(.ant-table-container) {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  width: 100%;
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}
.custom-table :deep(.ant-table-container)::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
.custom-table :deep(.ant-table-container)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}
.custom-table :deep(.ant-table-container)::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}
.custom-table :deep(.ant-table-container)::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.5);
}
.custom-table :deep(.ant-table-container)::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.1);
}
.custom-table :deep(.ant-table-body) {
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}
.custom-table :deep(.ant-table-body)::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
.custom-table :deep(.ant-table-body)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}
.custom-table :deep(.ant-table-body)::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}
.custom-table :deep(.ant-table-body)::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.5);
}
.custom-table :deep(.ant-table-body)::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.1);
}
</style>
