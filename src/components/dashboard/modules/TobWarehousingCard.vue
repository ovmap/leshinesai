<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h, nextTick } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore';
import { queryToBKpiSummary, exportToBLogisticKpiScoreSummary, exportToBLogisticKpiScoreDetail } from '../../../services/transportApi';

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>();

const selectOptionsStore = useSelectOptionsStore();

const getInitialDateRange = (): [Dayjs, Dayjs] => {
  const now = dayjs();
  const lastMonth = now.subtract(1, 'month');
  return [lastMonth.startOf('month'), lastMonth.endOf('month')];
};

const dateRange = ref<[Dayjs, Dayjs]>(getInitialDateRange());
const selectedLogisticProvider = ref<string[]>([]);
const selectedCdcWarehouse = ref<string[]>([]);
const showDetails = ref(false);

const bizType = '1';

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

const tableColumns = computed(() => {
  const baseColumns = [
    { title: '年月', key: 'month', dataIndex: 'month', width: 120, align: 'center' as const },
    { title: '物流商', key: 'logisticProvider', dataIndex: 'logisticProvider', width: 120, align: 'center' as const },
    { title: 'CDC仓库', key: 'cdcWarehouse', dataIndex: 'cdcWarehouse', width: 120, align: 'center' as const },
  ];

  if (showDetails.value) {
    return [
      ...baseColumns,
      { title: '得分合计', key: 'totalScore', dataIndex: 'totalScore', width: 120, align: 'center' as const },
      {
        title: '发货及时率', key: 'deliveryOnTimeRate',
        children: [
          { title: '达标发货体积', key: 'standardDeliveryVolume', dataIndex: 'standardDeliveryVolume', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.deliveryOnTimeRateColor) },
          { title: '当期总发货体积', key: 'totalDeliveryVolume', dataIndex: 'totalDeliveryVolume', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.deliveryOnTimeRateColor) },
          { title: '发货及时率', key: 'deliveryOnTimeRate', dataIndex: 'deliveryOnTimeRate', width: 120, align: 'center' as const, customRender: ({ text, record }: any) => renderRateCell(text, record.deliveryOnTimeRateTrend, record.deliveryOnTimeRateColor, true) },
          { title: '得分 (满分50分)', key: 'deliveryScore', dataIndex: 'deliveryScore', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.deliveryOnTimeRateColor) },
        ]
      },
      {
        title: '入库及时率', key: 'warehousingOnTimeRate',
        children: [
          { title: '入库达标单数', key: 'warehousingStandardCount', dataIndex: 'warehousingStandardCount', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.warehousingOnTimeRateColor) },
          { title: '总发货单数', key: 'totalShipmentCount', dataIndex: 'totalShipmentCount', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.warehousingOnTimeRateColor) },
          { title: '入库及时率', key: 'warehousingOnTimeRate', dataIndex: 'warehousingOnTimeRate', width: 120, align: 'center' as const, customRender: ({ text, record }: any) => renderRateCell(text, record.warehousingOnTimeRateTrend, record.warehousingOnTimeRateColor, true) },
          { title: '得分 (满分10分)', key: 'warehousingScore', dataIndex: 'warehousingScore', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.warehousingOnTimeRateColor) },
        ]
      },
      {
        title: '仓储STD (24小时) 达标率', key: 'storageStdRate',
        children: [
          { title: '达标单数', key: 'storageStandardCount', dataIndex: 'storageStandardCount', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.storageStdRateColor) },
          { title: '总发货单数', key: 'storageTotalShipmentCount', dataIndex: 'storageTotalShipmentCount', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.storageStdRateColor) },
          { title: '仓储STD (24小时) 达标率', key: 'storageStdRate', dataIndex: 'storageStdRate', width: 180, align: 'center' as const, customRender: ({ text, record }: any) => renderRateCell(text, record.storageStdRateTrend, record.storageStdRateColor, true) },
          { title: '得分 (满分20分)', key: 'storageScore', dataIndex: 'storageScore', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.storageStdRateColor) },
        ]
      },
      {
        title: '库存准确率', key: 'inventoryAccuracyRate',
        children: [
          { title: '达标数量', key: 'inventoryStandardQuantity', dataIndex: 'inventoryStandardQuantity', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.inventoryAccuracyRateColor) },
          { title: '月末库存总量', key: 'monthEndInventoryTotal', dataIndex: 'monthEndInventoryTotal', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.inventoryAccuracyRateColor) },
          { title: '库存准确率', key: 'inventoryAccuracyRate', dataIndex: 'inventoryAccuracyRate', width: 120, align: 'center' as const, customRender: ({ text, record }: any) => renderRateCell(text, record.inventoryAccuracyRateTrend, record.inventoryAccuracyRateColor, true) },
          { title: '得分 (满分10分)', key: 'inventoryScore', dataIndex: 'inventoryScore', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.inventoryAccuracyRateColor) },
        ]
      },
      {
        title: '运作准确率', key: 'operationAccuracyRate',
        children: [
          { title: '运作准确率', key: 'operationAccuracyRate', dataIndex: 'operationAccuracyRate', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderRateCell(text, record.operationAccuracyRateTrend, record.operationAccuracyRateColor, true) },
          { title: '得分 (满分10分)', key: 'operationScore', dataIndex: 'operationScore', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderNumberCell(text, record.operationAccuracyRateColor) },
        ]
      },
    ];
  } else {
    return [
      ...baseColumns,
      { title: '发货及时率', key: 'deliveryOnTimeRate', dataIndex: 'deliveryOnTimeRate', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderRateCell(text, record.deliveryOnTimeRateTrend, record.deliveryOnTimeRateColor, false) },
      { title: '入库及时率', key: 'warehousingOnTimeRate', dataIndex: 'warehousingOnTimeRate', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderRateCell(text, record.warehousingOnTimeRateTrend, record.warehousingOnTimeRateColor, false) },
      { title: '仓储STD (24小时) 达标率', key: 'storageStdRate', dataIndex: 'storageStdRate', width: 200, align: 'center' as const, customRender: ({ text, record }: any) => renderRateCell(text, record.storageStdRateTrend, record.storageStdRateColor, false) },
      { title: '库存准确率', key: 'inventoryAccuracyRate', dataIndex: 'inventoryAccuracyRate', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderRateCell(text, record.inventoryAccuracyRateTrend, record.inventoryAccuracyRateColor, false) },
      { title: '运作准确率', key: 'operationAccuracyRate', dataIndex: 'operationAccuracyRate', width: 150, align: 'center' as const, customRender: ({ text, record }: any) => renderRateCell(text, record.operationAccuracyRateTrend, record.operationAccuracyRateColor, false) },
    ];
  }
});

const getColorByValue = (colorValue: 'red' | 'yellow' | 'green' | null): string => {
  if (colorValue === 'red') return '#ff4d4f';
  if (colorValue === 'yellow') return '#faad14';
  if (colorValue === 'green') return '#52c41a';
  return 'rgba(255, 255, 255, 0.7)';
};

const renderNumberCell = (value: number | string, colorValue: 'red' | 'yellow' | 'green' | null) => {
  const textColor = getColorByValue(colorValue);
  const displayValue = value !== null && value !== undefined ? String(value) : '-';
  return h('span', { style: { color: textColor } }, displayValue);
};

const renderRateCell = (value: number, trend: 'up' | 'same' | 'down' | null, colorValue: 'red' | 'yellow' | 'green' | null, showDetails: boolean = false) => {
  const percentage = (value !== null && value !== undefined) ? `${Number(value).toFixed(1)}%` : '-';
  const textColor = getColorByValue(colorValue);
  if (showDetails) {
    return h('span', { style: { color: textColor } }, percentage);
  }
  let arrowIcon = '';
  if (trend === 'up') arrowIcon = '↑';
  else if (trend === 'same') arrowIcon = '→';
  else if (trend === 'down') arrowIcon = '↓';
  if (arrowIcon) {
    return h('span', { style: { color: textColor } }, [
      h('span', { style: { marginRight: '6px', color: 'rgba(255, 255, 255, 0.85)', fontSize: '16px', fontWeight: 'bold', display: 'inline-block', lineHeight: '1' } }, arrowIcon),
      percentage
    ]);
  }
  return h('span', { style: { color: textColor } }, percentage);
};

const selectedLogisticProviderText = computed(() => {
  if (selectedLogisticProvider.value.length === 0) return '物流商';
  const names = selectedLogisticProvider.value.map(code => {
    const option = logisticProviderOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const selectedCdcWarehouseText = computed(() => {
  if (selectedCdcWarehouse.value.length === 0) return 'CDC仓库';
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
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) return;
  try {
    loading.value = true;
    tableData.value = [];
    const params = {
      startDate: dateRange.value[0].format('YYYY-MM'),
      endDate: dateRange.value[1].format('YYYY-MM'),
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
      transType: [] as string[],
    };
    const result = await queryToBKpiSummary(params);
    if (result && result.code === 200 && result.data) {
      if (Array.isArray(result.data) && result.data.length > 0) {
        const processedData = result.data
          .filter((item: any) => {
            const isAllNull = !item.month && !item.logistic && !item.cdcWarehouse &&
              (item.totalScore === null || item.totalScore === undefined) &&
              (!item.kpi || item.kpi.length === 0);
            return !isAllNull;
          })
          .map((item: any, index: number) => {
            const row: any = {
              key: String(index + 1),
              month: item.month || '',
              logisticProvider: item.logistic || '',
              cdcWarehouse: item.cdcWarehouse || '',
              totalScore: item.totalScore || 0,
            };
            if (Array.isArray(item.kpi)) {
              item.kpi.forEach((kpi: any) => {
                const kpiType = String(kpi.kpiType);
                switch (kpiType) {
                  case '1':
                    row.standardDeliveryVolume = kpi.numerator;
                    row.totalDeliveryVolume = kpi.denominator;
                    row.deliveryOnTimeRate = kpi.rate ? kpi.rate * 100 : 0;
                    row.deliveryOnTimeRateTrend = kpi.trend || null;
                    row.deliveryOnTimeRateColor = kpi.color || null;
                    row.deliveryScore = kpi.score || 0;
                    break;
                  case '2':
                    row.warehousingStandardCount = kpi.numerator;
                    row.totalShipmentCount = kpi.denominator;
                    row.warehousingOnTimeRate = kpi.rate ? kpi.rate * 100 : 0;
                    row.warehousingOnTimeRateTrend = kpi.trend || null;
                    row.warehousingOnTimeRateColor = kpi.color || null;
                    row.warehousingScore = kpi.score || 0;
                    break;
                  case '3':
                    row.storageStandardCount = kpi.numerator;
                    row.storageTotalShipmentCount = kpi.denominator;
                    row.storageStdRate = kpi.rate ? kpi.rate * 100 : 0;
                    row.storageStdRateTrend = kpi.trend || null;
                    row.storageStdRateColor = kpi.color || null;
                    row.storageScore = kpi.score || 0;
                    break;
                  case '4':
                    row.inventoryStandardQuantity = kpi.numerator;
                    row.monthEndInventoryTotal = kpi.denominator;
                    row.inventoryAccuracyRate = kpi.rate ? kpi.rate * 100 : 0;
                    row.inventoryAccuracyRateTrend = kpi.trend || null;
                    row.inventoryAccuracyRateColor = kpi.color || null;
                    row.inventoryScore = kpi.score || 0;
                    break;
                  case '5':
                    row.operationAccuracyRate = kpi.rate ? kpi.rate * 100 : 0;
                    row.operationAccuracyRateTrend = kpi.trend || null;
                    row.operationAccuracyRateColor = kpi.color || null;
                    row.operationScore = kpi.score || 0;
                    break;
                }
              });
            }
            return row;
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
  if (!tableData.value || tableData.value.length === 0) {
    message.warning('没有数据可以导出');
    return;
  }
  try {
    exportSummaryLoading.value = true;
    const params = {
      startDate: dateRange.value[0].format('YYYY-MM'),
      endDate: dateRange.value[1].format('YYYY-MM'),
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
      transType: [] as string[],
    };
    const result = await exportToBLogisticKpiScoreSummary(params);
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : `ToB物流商KPI评分汇总_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`;
        link.download = downloadFilename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('导出汇总成功');
      }
    } else {
      message.error(result?.message || '导出汇总失败');
    }
  } catch (error: any) {
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
  if (!tableData.value || tableData.value.length === 0) {
    message.warning('没有数据可以导出');
    return;
  }
  try {
    exportDetailLoading.value = true;
    const params = {
      startDate: dateRange.value[0].format('YYYY-MM'),
      endDate: dateRange.value[1].format('YYYY-MM'),
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
      transType: [] as string[],
    };
    const result = await exportToBLogisticKpiScoreDetail(params);
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : `ToB物流商KPI评分明细_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`;
        link.download = downloadFilename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('导出明细成功');
      }
    } else {
      message.error(result?.message || '导出明细失败');
    }
  } catch (error: any) {
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

watch(dateRange, () => { fetchTableData(); }, { deep: true });

watch(showDetails, () => {
  nextTick(() => { calculateTableScrollY(); });
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

onMounted(async () => {
  await selectOptionsStore.fetchLogisticsByBizType('1');
  await selectOptionsStore.fetchWarehouseByBizType('1');
  await fetchTableData();
  document.addEventListener('click', handleClickOutside);
  calculateTableScrollY();
  window.addEventListener('resize', calculateTableScrollY);
  if (tableSectionRef.value) {
    const resizeObserver = new ResizeObserver(() => { calculateTableScrollY(); });
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

<template>
  <div class="tob-card-container">
    <div class="header-bar">
      <h2 class="header-title">PFP KPI-仓库</h2>
    </div>
    <!-- 控制面板 -->
    <div class="control-panel">
      <div class="filter-group">
        <!-- 月份范围选择器 -->
        <div class="date-range-item">
          <a-range-picker
            v-model:value="dateRange"
            picker="month"
            format="YYYY-MM"
            separator="至"
            :placeholder="['开始月份', '结束月份']"
            class="date-range-picker"
          />
        </div>
        <!-- 物流商下拉框 -->
        <div class="dropdown-item" @click.stop="toggleLogisticProviderDropdown">
          <span class="dropdown-text">{{ selectedLogisticProviderText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isLogisticProviderOpen" @click.stop>
            <div class="search-box">
              <input v-model="logisticProviderSearch" type="text" placeholder="搜索物流商..." class="search-input" @click.stop />
            </div>
            <div class="options-list">
              <div
                v-for="option in filteredLogisticProviderOptions"
                :key="option.code"
                class="dropdown-option"
                :class="{ 'selected': option.code !== '__reset__' && selectedLogisticProvider.includes(option.code), 'reset-option': option.code === '__reset__' }"
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
        <!-- CDC仓库下拉框 -->
        <div class="dropdown-item" @click.stop="toggleCdcWarehouseDropdown">
          <span class="dropdown-text">{{ selectedCdcWarehouseText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isCdcWarehouseOpen" @click.stop>
            <div class="search-box">
              <input v-model="cdcWarehouseSearch" type="text" placeholder="搜索CDC仓库..." class="search-input" @click.stop />
            </div>
            <div class="options-list">
              <div
                v-for="option in filteredCdcWarehouseOptions"
                :key="option.code"
                class="dropdown-option"
                :class="{ 'selected': option.code !== '__reset__' && selectedCdcWarehouse.includes(option.code), 'reset-option': option.code === '__reset__' }"
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
        <!-- 显示详情开关 -->
        <div class="switch-item">
          <span class="switch-label">显示详情</span>
          <a-switch v-model:checked="showDetails" />
        </div>
      </div>
      <!-- 导出按钮组 -->
      <div class="export-group">
        <a-button type="primary" :loading="exportSummaryLoading" @click="handleExportSummary" class="export-btn">导出汇总</a-button>
        <a-button type="primary" :loading="exportDetailLoading" @click="handleExportDetail" class="export-btn">导出明细</a-button>
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
          :scroll="{ x: 1000, y: tableScrollY }"
        />
      </a-spin>
    </div>
  </div>
</template>

<style scoped>
.tob-card-container {
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

.switch-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
}
.switch-label {
  white-space: nowrap;
}
:deep(.ant-switch) {
  background: rgba(255, 255, 255, 0.2);
}
:deep(.ant-switch-checked) {
  background: #2873CC;
}

.export-group {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}
.export-btn {
  height: 1.6rem;
  background: #2873cc;
  box-shadow: 1px 1px 1px 0px #1e6cc8, inset 0px 1px 1px 0px #c5dfff;
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
.export-btn:hover:not(:disabled) {
  background: #1e6cc8;
  box-shadow: 1px 1px 1px 0px #1c5fb8, inset 0px 1px 1px 0px #b8d5ff;
}
.export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.table-section {
  flex: 1;
  overflow: auto;
  min-height: 0;
  padding: 1rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.3);
}
.table-section::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.table-section::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}
.table-section::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
}
.table-section::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(74, 158, 255, 0.8) 100%);
  border-color: rgba(59, 130, 246, 0.5);
}
.table-section::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.3);
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
:deep(.ant-table-container) {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  width: 100%;
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.3);
}
:deep(.ant-table-container)::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
:deep(.ant-table-container)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}
:deep(.ant-table-container)::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
}
:deep(.ant-table-container)::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(74, 158, 255, 0.8) 100%);
  border-color: rgba(59, 130, 246, 0.5);
}
:deep(.ant-table-container)::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.3);
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
  white-space: nowrap;
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
</style>
