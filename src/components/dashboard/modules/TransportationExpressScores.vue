<template>
  <div class="transportation-express-scores">
    <div class="header-bar">
      <h2 class="header-title">运输快递KPI评分</h2>
    </div>
    
    <div class="control-panel">
      <div class="filter-group">
        <div class="date-range-item">
          <a-range-picker
            v-model:value="dateRange"
            picker="month"
            format="YYYY-MM"
            :placeholder="['开始月份', '结束月份']"
            class="date-range-picker"
          />
        </div>

        <div class="dropdown-item" @click.stop="toggleLogisticProviderDropdown">
          <span class="dropdown-text">{{ selectedLogisticProviderText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isLogisticProviderOpen" @click.stop>
            <div class="search-box">
              <input
                v-model="logisticProviderSearch"
                type="text"
                placeholder="搜索物流商..."
                class="search-input"
                @click.stop
              />
            </div>
            <div class="options-list">
              <div
                v-for="option in filteredLogisticProviderOptions"
                :key="option.code"
                class="dropdown-option"
                :class="{
                  'selected': option.code !== '__reset__' && selectedLogisticProvider.includes(option.code),
                  'reset-option': option.code === '__reset__'
                }"
                @click.stop="selectLogisticProvider(option.code)"
              >
                <span class="checkmark" v-if="option.code !== '__reset__' && selectedLogisticProvider.includes(option.code)">✓</span>
                {{ option.name }}
              </div>
              <div v-if="filteredLogisticProviderOptions.length === 1 && logisticProviderSearch" class="no-results">
                暂无搜索结果
              </div>
            </div>
          </div>
        </div>

        <div class="dropdown-item" @click.stop="toggleCdcWarehouseDropdown">
          <span class="dropdown-text">{{ selectedCdcWarehouseText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isCdcWarehouseOpen" @click.stop>
            <div class="search-box">
              <input
                v-model="cdcWarehouseSearch"
                type="text"
                placeholder="搜索仓库..."
                class="search-input"
                @click.stop
              />
            </div>
            <div class="options-list">
              <div
                v-for="option in filteredCdcWarehouseOptions"
                :key="option.code"
                class="dropdown-option"
                :class="{
                  'selected': option.code !== '__reset__' && selectedCdcWarehouse.includes(option.code),
                  'reset-option': option.code === '__reset__'
                }"
                @click.stop="selectCdcWarehouse(option.code)"
              >
                <span class="checkmark" v-if="option.code !== '__reset__' && selectedCdcWarehouse.includes(option.code)">✓</span>
                {{ option.name }}
              </div>
              <div v-if="filteredCdcWarehouseOptions.length === 1 && cdcWarehouseSearch" class="no-results">
                暂无搜索结果
              </div>
            </div>
          </div>
        </div>

        <div class="switch-item">
          <span class="switch-label">显示详情</span>
          <a-switch v-model:checked="showDetails" />
        </div>
      </div>

      <div class="action-buttons">
        <a-button
          type="primary"
          :loading="exportSummaryLoading"
          @click="handleExportSummary"
          class="action-btn"
        >
          导出汇总
        </a-button>
        <a-button
          type="primary"
          :loading="exportDetailLoading"
          @click="handleExportDetail"
          class="action-btn"
        >
          导出明细
        </a-button>
      </div>
    </div>

    <div class="table-section" ref="tableSectionRef">
      <a-spin :spinning="loading">
        <a-table
          :columns="tableColumns"
          :data-source="tableData"
          :pagination="false"
          size="small"
          class="custom-table"
          :scroll="{ x: 1000, y: tableScrollY }"
        />
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h, nextTick } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import { queryExpressKpiSummary, exportExpressLogisticKpiScoreSummary, exportExpressLogisticKpiScoreDetail } from '../../../services/transportApi';
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore';

const selectOptionsStore = useSelectOptionsStore();

const getInitialDateRange = (): [Dayjs, Dayjs] => {
  const now = dayjs();
  const start = now.subtract(2, 'month').startOf('month');
  const end = now.subtract(1, 'month').endOf('month');
  return [start, end];
};

const dateRange = ref<[Dayjs, Dayjs]>(getInitialDateRange());
const selectedLogisticProvider = ref<string[]>([]);
const selectedCdcWarehouse = ref<string[]>([]);
const showDetails = ref(false);

const bizType = '5';

const logisticProviderOptions = computed(() => selectOptionsStore.getLogisticsByBizType(bizType));
const cdcWarehouseOptions = computed(() => selectOptionsStore.getWarehouseByBizType(bizType));

const logisticProviderSearch = ref('');
const cdcWarehouseSearch = ref('');

const filteredLogisticProviderOptions = computed(() => {
  let filtered: { code: string; name: string }[] = [];
  
  if (!logisticProviderSearch.value.trim()) {
    filtered = logisticProviderOptions.value;
  } else {
    const searchLower = logisticProviderSearch.value.toLowerCase();
    filtered = logisticProviderOptions.value.filter((option: { code: string; name: string }) =>
      option.name.toLowerCase().includes(searchLower)
    );
  }
  
  return [{ code: '__reset__', name: '重置' }, ...filtered];
});

const filteredCdcWarehouseOptions = computed(() => {
  let filtered: { code: string; name: string }[] = [];
  
  if (!cdcWarehouseSearch.value.trim()) {
    filtered = cdcWarehouseOptions.value;
  } else {
    const searchLower = cdcWarehouseSearch.value.toLowerCase();
    filtered = cdcWarehouseOptions.value.filter((option: { code: string; name: string }) =>
      option.name.toLowerCase().includes(searchLower)
    );
  }
  
  return [{ code: '__reset__', name: '重置' }, ...filtered];
});

const isLogisticProviderOpen = ref(false);
const isCdcWarehouseOpen = ref(false);

const tableData = ref<any[]>([]);
const loading = ref(false);
const exportSummaryLoading = ref(false);
const exportDetailLoading = ref(false);

const tableSectionRef = ref<HTMLElement | null>(null);
const tableScrollY = ref<number | undefined>(200);

const getColorByValue = (colorValue: 'red' | 'yellow' | 'green' | null): string => {
  if (colorValue === 'red') {
    return '#ff4d4f';
  } else if (colorValue === 'yellow') {
    return '#faad14';
  } else if (colorValue === 'green') {
    return '#52c41a';
  }
  return 'rgba(255, 255, 255, 0.7)';
};

const renderNumberCell = (value: number | string, colorValue: 'red' | 'yellow' | 'green' | null) => {
  const textColor = getColorByValue(colorValue);
  const displayValue = value !== null && value !== undefined ? String(value) : '-';
  return h('span', { style: { color: textColor } }, displayValue);
};

const renderRateCell = (value: number, trend: 'up' | 'same' | 'down' | null, colorValue: 'red' | 'yellow' | 'green' | null, showDetails: boolean = false, decimalPlaces: number = 1) => {
  const percentage = (value !== null && value !== undefined) ? `${Number(value).toFixed(decimalPlaces)}%` : '-';
  const textColor = getColorByValue(colorValue);
  
  if (showDetails) {
    return h('span', { style: { color: textColor } }, percentage);
  }
  
  let arrowIcon = '';
  if (trend === 'up') {
    arrowIcon = '↑';
  } else if (trend === 'same') {
    arrowIcon = '→';
  } else if (trend === 'down') {
    arrowIcon = '↓';
  }
  
  if (arrowIcon) {
    return h('span', { style: { color: textColor } }, [
      h('span', { 
        style: { 
          marginRight: '6px', 
          color: 'rgba(255, 255, 255, 0.85)',
          fontSize: '16px',
          fontWeight: 'bold',
          display: 'inline-block',
          lineHeight: '1'
        } 
      }, arrowIcon),
      percentage
    ]);
  }
  return h('span', { style: { color: textColor } }, percentage);
};

const renderNumberCellWithTrend = (value: number | string, trend: 'up' | 'same' | 'down' | null, colorValue: 'red' | 'yellow' | 'green' | null, isDetailMode: boolean = false) => {
  const textColor = getColorByValue(colorValue);
  const displayValue = value !== null && value !== undefined ? String(value) : '-';
  
  if (isDetailMode) {
    return h('span', { style: { color: textColor } }, displayValue);
  }
  
  let arrowIcon = '';
  if (trend === 'up') {
    arrowIcon = '↑';
  } else if (trend === 'same') {
    arrowIcon = '→';
  } else if (trend === 'down') {
    arrowIcon = '↓';
  }
  
  if (arrowIcon) {
    return h('span', { style: { color: textColor } }, [
      h('span', { 
        style: { 
          marginRight: '6px', 
          color: 'rgba(255, 255, 255, 0.85)',
          fontSize: '16px',
          fontWeight: 'bold',
          display: 'inline-block',
          lineHeight: '1'
        } 
      }, arrowIcon),
      displayValue
    ]);
  }
  return h('span', { style: { color: textColor } }, displayValue);
};

const createKpiDetailColumn = (
  parentTitle: string, 
  kpiType: number, 
  children: Array<{ title: string; key: string; dataKey: string; maxScore?: number; decimalPlaces?: number }>
) => {
  return {
    title: parentTitle,
    key: `kpi_${kpiType}`,
    align: 'center' as const,
    children: children.map(child => ({
      title: child.title,
      key: child.key,
      dataIndex: child.key,
      width: child.title.includes('得分') ? 140 : (child.title.length > 12 ? 180 : 160),
      align: 'center' as const,
      customRender: ({ record }: { record: any }) => {
        const kpi = record.kpiData?.find((k: any) => k.kpiType === kpiType);
        if (!kpi) return '-';
        
        if (child.dataKey === 'numerator') {
          return kpi.numerator ?? '-';
        } else if (child.dataKey === 'denominator') {
          return kpi.denominator ?? '-';
        } else if (child.dataKey === 'rate') {
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          const decimalPlaces = child.decimalPlaces ?? 1;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, true, decimalPlaces);
        } else if (child.dataKey === 'satisfact') {
          const satisfaction = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate : 0;
          return renderNumberCellWithTrend(satisfaction, kpi.trend || null, kpi.color || null, true);
        } else if (child.dataKey === 'score') {
          return kpi.score ?? '-';
        }
        return '-';
      },
    })),
  };
};

const tableColumns = computed(() => {
  const baseColumns = [
    {
      title: '年月',
      key: 'month',
      dataIndex: 'month',
      width: 120,
      align: 'center' as const,
      customRender: ({ text }: { text: string }) => {
        if (!text) return '-';
        const parts = text.split('-');
        if (parts.length === 2 && parts[0] && parts[1]) {
          return `${parts[0]}年${parseInt(parts[1])}月`;
        }
        return text;
      },
    },
    {
      title: '物流商',
      key: 'logisticProvider',
      dataIndex: 'logisticProvider',
      width: 120,
      align: 'center' as const,
    },
  ];

  if (showDetails.value) {
    const kpiColumns = [
      createKpiDetailColumn('正向订单准时交货率', 23, [
        { title: '正向准时交货的发货单数量', key: 'doa_ontime_numerator', dataKey: 'numerator' },
        { title: '总发货单数量', key: 'doa_ontime_denominator', dataKey: 'denominator' },
        { title: '正向订单准时交货率', key: 'doa_ontime_rate', dataKey: 'rate' },
        { title: '得分(满分50分)', key: 'doa_ontime_score', dataKey: 'score', maxScore: 50 },
      ]),
      createKpiDetailColumn('正向发货及时率', 24, [
        { title: '及时发货的订单数量', key: 'express_deliver_numerator', dataKey: 'numerator' },
        { title: '总发货订单量', key: 'express_deliver_denominator', dataKey: 'denominator' },
        { title: '正向发货及时率', key: 'express_deliver_rate', dataKey: 'rate' },
        { title: '得分(满分20分)', key: 'express_deliver_score', dataKey: 'score', maxScore: 20 },
      ]),
      createKpiDetailColumn('破损率', 25, [
        { title: '发生货破货损货物件数', key: 'express_damager_numerator', dataKey: 'numerator' },
        { title: '总发货货物件数', key: 'express_damager_denominator', dataKey: 'denominator' },
        { title: '破损率', key: 'express_damager_rate', dataKey: 'rate', decimalPlaces: 3 },
        { title: '得分(满分10分)', key: 'express_damager_score', dataKey: 'score', maxScore: 10 },
      ]),
      createKpiDetailColumn('遗失率', 26, [
        { title: '发生遗失货物件数', key: 'express_lost_numerator', dataKey: 'numerator' },
        { title: '总发货货物件数', key: 'express_lost_denominator', dataKey: 'denominator' },
        { title: '遗失率', key: 'express_lost_rate', dataKey: 'rate' },
        { title: '得分(满分10分)', key: 'express_lost_score', dataKey: 'score', maxScore: 10 },
      ]),
      createKpiDetailColumn('客户满意度', 27, [
        { title: '客户评分', key: 'express_satisfaction_rate', dataKey: 'satisfact' },
        { title: '得分(满分10分)', key: 'express_satisfaction_score', dataKey: 'score', maxScore: 10 },
      ]),
    ];
    
    return [
      ...baseColumns,
      {
        title: '仓库',
        key: 'cdcWarehouse',
        dataIndex: 'cdcWarehouse',
        width: 120,
        align: 'center' as const,
      },
      {
        title: '总成绩',
        key: 'totalScore',
        dataIndex: 'totalScore',
        width: 120,
        align: 'center' as const,
      },
      ...kpiColumns,
      {
        title: '得分汇总',
        key: 'scoreSummary',
        dataIndex: 'scoreSummary',
        width: 150,
        align: 'center' as const,
      },
      {
        title: '扣分项',
        key: 'totalDeduction',
        dataIndex: 'totalDeduction',
        width: 150,
        align: 'center' as const,
      },
      {
        title: '扣分说明',
        key: 'deductionDesc',
        dataIndex: 'deductionDesc',
        width: 150,
        align: 'center' as const,
      },
      {
        title: '加分项',
        key: 'totalBonus',
        dataIndex: 'totalBonus',
        width: 150,
        align: 'center' as const,
      },
      {
        title: '加分说明',
        key: 'bonusDescription',
        dataIndex: 'bonusDescription',
        width: 150,
        align: 'center' as const,
      },
    ];
  } else {
    return [
      ...baseColumns,
      {
        title: '仓库',
        key: 'cdcWarehouse',
        dataIndex: 'cdcWarehouse',
        width: 120,
        align: 'center' as const,
      },
      {
        title: '正向订单准时交货率',
        key: 'expressOnTimeRate',
        dataIndex: 'expressOnTimeRate',
        width: 150,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 23);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      },
      {
        title: '正向发货及时率',
        key: 'expressDeliverOnTimeRate',
        dataIndex: 'expressDeliverOnTimeRate',
        width: 150,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 24);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      },
      {
        title: '破损率',
        key: 'expressDamagerRate',
        dataIndex: 'expressDamagerRate',
        width: 200,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 25);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false, 3);
        },
      },
      {
        title: '遗失率',
        key: 'expressLostRate',
        dataIndex: 'expressLostRate',
        width: 150,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 26);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      },
      {
        title: '客户满意度',
        key: 'CustomerSatisfactionRate',
        dataIndex: 'CustomerSatisfactionRate',
        width: 200,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 27);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate : 0;
          return renderNumberCellWithTrend(rate, kpi.trend || null, kpi.color || null);
        }
      }
    ];
  }
});

const selectedLogisticProviderText = computed(() => {
  if (selectedLogisticProvider.value.length === 0) return '物流商';
  const names = selectedLogisticProvider.value.map(code => {
    const option = logisticProviderOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const selectedCdcWarehouseText = computed(() => {
  if (selectedCdcWarehouse.value.length === 0) return '仓库';
  const names = selectedCdcWarehouse.value.map(code => {
    const option = cdcWarehouseOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const toggleLogisticProviderDropdown = () => {
  if (isLogisticProviderOpen.value) {
    isLogisticProviderOpen.value = false;
    logisticProviderSearch.value = '';
    fetchTableData();
  } else {
    closeAllDropdowns();
    isLogisticProviderOpen.value = true;
    logisticProviderSearch.value = '';
  }
};

const toggleCdcWarehouseDropdown = () => {
  if (isCdcWarehouseOpen.value) {
    isCdcWarehouseOpen.value = false;
    cdcWarehouseSearch.value = '';
    fetchTableData();
  } else {
    closeAllDropdowns();
    isCdcWarehouseOpen.value = true;
    cdcWarehouseSearch.value = '';
  }
};

const closeAllDropdowns = () => {
  isLogisticProviderOpen.value = false;
  isCdcWarehouseOpen.value = false;
  logisticProviderSearch.value = '';
  cdcWarehouseSearch.value = '';
};

const selectLogisticProvider = (code: string) => {
  if (code === '__reset__') {
    selectedLogisticProvider.value = [];
    logisticProviderSearch.value = '';
    return;
  }
  
  const index = selectedLogisticProvider.value.indexOf(code);
  if (index > -1) {
    selectedLogisticProvider.value.splice(index, 1);
  } else {
    selectedLogisticProvider.value.push(code);
  }
};

const selectCdcWarehouse = (code: string) => {
  if (code === '__reset__') {
    selectedCdcWarehouse.value = [];
    cdcWarehouseSearch.value = '';
    return;
  }
  
  const index = selectedCdcWarehouse.value.indexOf(code);
  if (index > -1) {
    selectedCdcWarehouse.value.splice(index, 1);
  } else {
    selectedCdcWarehouse.value.push(code);
  }
};

const fetchTableData = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
    return;
  }

  try {
    loading.value = true;
    
    const params = {
      startDate: dateRange.value[0].format('YYYY-MM'),
      endDate: dateRange.value[1].format('YYYY-MM'),
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
      transType: [] as string[],
    };
    
    const result = await queryExpressKpiSummary(params);
    
    if (result && result.code === 200 && result.data) {
      if (Array.isArray(result.data) && result.data.length > 0) {
        tableData.value = result.data.map((item: any, index: number) => {
          const row: any = {
            key: String(index + 1),
            month: item.month || '',
            logisticProvider: item.logistic || '',
            cdcWarehouse: item.cdcWarehouse || '',
            customer: item.customer || '',
            totalScore: item.totalScore || 0,            
            scoreSummary: item.scoreSummary || 0,
            totalDeduction: item.totalDeduction || 0,
            deductionDesc: item.deductionDesc || '',
            totalBonus: item.totalBonus || 0,
            bonusDescription: item.bonusDescription || '',
            kpiData: item.kpi || [],
          };
          return row;
        });
      } else {
        console.warn('接口返回数据格式不正确:', result.data);
        tableData.value = [];
      }
    } else {
      message.error(result?.msg || '获取数据失败');
      tableData.value = [];
    }
  } catch (error) {
    console.error('获取表格数据失败:', error);
    message.error('获取数据失败');
    tableData.value = [];
  } finally {
    loading.value = false;
  }
};

const handleExportSummary = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
    message.warning('请选择日期范围');
    return;
  }

  try {
    exportSummaryLoading.value = true;
    
    const params = {
      startDate: dateRange.value[0].format('YYYY-MM'),
      endDate: dateRange.value[1].format('YYYY-MM'),
      agg: ["LOGISTIC","CDC_WAREHOUSE","MONTH","CUSTOMER"],
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
      bizType: '5',
    };
    
    const result = await exportExpressLogisticKpiScoreSummary(params);
    
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1]! : `运输快递物流商KPI评分汇总_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`;
        
        link.download = downloadFilename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('导出汇总成功');
      }
    } else {
      console.error('导出汇总失败:', result?.message || '未知错误');
      message.error(result?.message || '导出汇总失败');
    }
  } catch (error: any) {
    console.error('导出汇总失败:', error);
    
    const errCode = error?.code || error?.response?.status;
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || '导出数据量过大，请缩小查询范围');
    } else {
      message.error(error.msg || '导出汇总失败');
    }
  } finally {
    exportSummaryLoading.value = false;
  }
};

const handleExportDetail = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
    message.warning('请选择日期范围');
    return;
  }

  try {
    exportDetailLoading.value = true;
    
    const params = {
      startDate: dateRange.value[0].format('YYYY-MM'),
      endDate: dateRange.value[1].format('YYYY-MM'),
      agg: ["LOGISTIC","CDC_WAREHOUSE","MONTH","CUSTOMER"],
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
      bizType: '5',
    };
    
    const result = await exportExpressLogisticKpiScoreDetail(params);
    
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1]! : `运输快递物流商KPI评分明细_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`;
        
        link.download = downloadFilename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('导出明细成功');
      }
    } else {
      console.error('导出明细失败:', result?.message || '未知错误');
      message.error(result?.message || '导出明细失败');
    }
  } catch (error: any) {
    console.error('导出明细失败:', error);
    
    const errCode = error?.code || error?.response?.status;
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || '导出数据量过大，请缩小查询范围');
    } else {
      message.error(error.msg || '导出明细失败');
    }
  } finally {
    exportDetailLoading.value = false;
  }
};

watch(dateRange, () => {
  fetchTableData();
}, { deep: true });

watch(showDetails, () => {
  fetchTableData();
});

const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.dropdown-item') && !target.closest('.dropdown-content')) {
    if (isLogisticProviderOpen.value || isCdcWarehouseOpen.value) {
      closeAllDropdowns();
      fetchTableData();
    }
  }
};

const calculateTableScrollY = () => {
  nextTick(() => {
    if (tableSectionRef.value) {
      const containerHeight = tableSectionRef.value.clientHeight;
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 200;
      tableScrollY.value = calculatedHeight;
    }
  });
};

onMounted(async () => {
  await selectOptionsStore.fetchLogisticsByBizType('5');
  await selectOptionsStore.fetchWarehouseByBizType('5');
  await fetchTableData();
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

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', calculateTableScrollY);
  
  if (tableSectionRef.value && (tableSectionRef.value as any)._resizeObserver) {
    (tableSectionRef.value as any)._resizeObserver.disconnect();
  }
});
</script>

<style scoped>
.transportation-express-scores {
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

.date-range-item {
  flex-shrink: 1;
}

.date-range-picker {
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

.date-range-picker:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

:deep(.ant-picker-input) input {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
}

:deep(.ant-picker-separator) {
  color: rgba(255, 255, 255, 0.7);
}

:deep(.ant-picker-separator) svg {
  display: none !important;
}

:deep(.ant-picker-suffix) {
  color: rgba(255, 255, 255, 0.7);
}

.switch-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  flex-shrink: 0;
}

.switch-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  white-space: nowrap;
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
  margin-left: auto;
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

.custom-table :deep(.ant-table-thead > tr:first-child > th) {
  white-space: normal;
  word-wrap: break-word;
  word-break: break-all;
}

.custom-table :deep(.ant-table-thead > tr:not(:first-child) > th) {
  white-space: normal;
  word-wrap: break-word;
  word-break: break-all;
  font-size: 0.7rem;
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
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.3);
}

.custom-table :deep(.ant-table-container)::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.custom-table :deep(.ant-table-container)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}

.custom-table :deep(.ant-table-container)::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.custom-table :deep(.ant-table-container)::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(74, 158, 255, 0.8) 100%);
  border-color: rgba(59, 130, 246, 0.5);
}

.custom-table :deep(.ant-table-container)::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.3);
}
</style>
