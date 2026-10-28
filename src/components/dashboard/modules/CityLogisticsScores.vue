<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore';
import { useDashboardDataStore } from '../../../stores/dashboardDataStore';
import { queryDeliveryKpiSummary, exportDeliveryLogisticKpiScoreSummary, exportDeliveryLogisticKpiScoreDetail } from '../../../services/transportApi';

const { t } = useI18n();

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>();

const selectOptionsStore = useSelectOptionsStore();
const dataStore = useDashboardDataStore();

const getInitialDateRange = (): [Dayjs, Dayjs] => {
  const now = dayjs();
  const lastMonth = now.subtract(1, 'month');
  return [lastMonth.startOf('month'), lastMonth.endOf('month')];
};

const dateRange = ref<[Dayjs, Dayjs]>(getInitialDateRange());
const selectedLogisticProvider = ref<string[]>([]);
const selectedCdcWarehouse = ref<string[]>([]);
const showDetails = ref(false);

const bizType = '3';

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
  return [{ code: '__reset__', name: t('dashboard.cityLogistics.filters.reset') }, ...filtered];
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
  return [{ code: '__reset__', name: t('dashboard.cityLogistics.filters.reset') }, ...filtered];
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
  if (colorValue === 'red') return '#ff4d4f';
  if (colorValue === 'yellow') return '#faad14';
  if (colorValue === 'green') return '#52c41a';
  return 'rgba(255, 255, 255, 0.7)';
};

const renderNumberCellWithTrend = (value: number | string, trend: 'up' | 'same' | 'down' | null, colorValue: 'red' | 'yellow' | 'green' | null, isDetailMode: boolean = false) => {
  const textColor = getColorByValue(colorValue);
  const displayValue = value !== null && value !== undefined ? String(value) : '-';
  
  if (isDetailMode) {
    return h('span', { style: { color: textColor } }, displayValue);
  }
  
  let arrowIcon = '';
  if (trend === 'up') arrowIcon = '↑';
  else if (trend === 'same') arrowIcon = '→';
  else if (trend === 'down') arrowIcon = '↓';
  
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

const renderRateCell = (value: number, trend: 'up' | 'same' | 'down' | null, colorValue: 'red' | 'yellow' | 'green' | null, isDetailMode: boolean = false, decimalPlaces: number = 1) => {
  const percentage = (value !== null && value !== undefined) ? `${Number(value).toFixed(decimalPlaces)}%` : '-';
  const textColor = getColorByValue(colorValue);
  
  if (isDetailMode) {
    return h('span', { style: { color: textColor } }, percentage);
  }
  
  let arrowIcon = '';
  if (trend === 'up') arrowIcon = '↑';
  else if (trend === 'same') arrowIcon = '→';
  else if (trend === 'down') arrowIcon = '↓';
  
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
      width: child.dataKey === 'score' ? 120 : (child.title.length > 10 ? 160 : 140),
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

const createSimpleKpiColumn = (title: string, key: string, kpiType: number, width: number = 150, decimalPlaces: number = 1) => {
  return {
    title,
    key,
    dataIndex: key,
    width,
    align: 'center' as const,
    customRender: ({ record }: { record: any }) => {
      const kpi = record.kpiData?.find((k: any) => k.kpiType === kpiType);
      if (!kpi) return '-';
      const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
      return renderRateCell(rate, kpi.trend || null, kpi.color || null, false, decimalPlaces);
    },
  };
};

const createSimpleSatisfactColumn = (title: string, key: string, kpiType: number, width: number = 150) => {
  return {
    title,
    key,
    dataIndex: key,
    width,
    align: 'center' as const,
    customRender: ({ record }: { record: any }) => {
      const kpi = record.kpiData?.find((k: any) => k.kpiType === kpiType);
      if (!kpi) return '-';
      const satisfaction = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate : 0;
      return renderNumberCellWithTrend(satisfaction, kpi.trend || null, kpi.color || null);
    },
  };
};

const tableColumns = computed(() => {
  const p = 'dashboard.cityLogistics.tableColumns.';
  const baseColumns = [
    {
      title: t(p + 'yearMonth'),
      key: 'yearMonth',
      dataIndex: 'yearMonth',
      width: 100,
      align: 'center' as const,
      customRender: ({ text }: { text: string | undefined }) => {
        if (!text || text === t(p + 'summary')) return text || '-';
        const textStr = text || '';
        const parts = textStr.split('-');
        if (parts.length === 2 && parts[0] && parts[1]) {
          return t(p + 'yearMonthFormat', { year: parts[0], month: parseInt(parts[1]) });
        }
        return text || '-';
      },
    },
    {
      title: t(p + 'logisticProvider'),
      key: 'logistic',
      dataIndex: 'logistic',
      width: 120,
      align: 'center' as const,
    },
    {
      title: t(p + 'cdcWarehouse'),
      key: 'cdcWarehouse',
      dataIndex: 'cdcWarehouse',
      width: 120,
      align: 'center' as const,
    },
  ];

  if (showDetails.value) {
    baseColumns.push({
      title: t(p + 'totalScore'),
      key: 'totalScore',
      dataIndex: 'totalScore',
      width: 100,
      align: 'center' as const,
      customRender: ({ text }: { text: any }) => {
        return text !== null && text !== undefined ? text : '-';
      },
    });
  }

  if (showDetails.value) {
    const firstGroupKpiColumns = [
      createKpiDetailColumn(t(p + 'secInboundCycleComplianceRate'), 12, [
        { title: t(p + 'secNumerator'), key: 'sec_numerator', dataKey: 'numerator' },
        { title: t(p + 'secDenominator'), key: 'sec_denominator', dataKey: 'denominator' },
        { title: t(p + 'secRate'), key: 'sec_rate', dataKey: 'rate' },
        { title: t(p + 'scoreLabel', { max: 15 }), key: 'sec_score', dataKey: 'score', maxScore: 15 },
      ]),
      createKpiDetailColumn(t(p + 'deliveryOnTimeRate'), 1, [
        { title: t(p + 'deliveryNumerator'), key: 'delivery_numerator', dataKey: 'numerator' },
        { title: t(p + 'deliveryDenominator'), key: 'delivery_denominator', dataKey: 'denominator' },
        { title: t(p + 'deliveryRate'), key: 'delivery_rate', dataKey: 'rate' },
        { title: t(p + 'scoreLabel', { max: 5 }), key: 'delivery_score', dataKey: 'score', maxScore: 5 },
      ]),
      createKpiDetailColumn(t(p + 'inventoryAccuracyRate'), 4, [
        { title: t(p + 'inventoryNumerator'), key: 'inventory_numerator', dataKey: 'numerator' },
        { title: t(p + 'inventoryDenominator'), key: 'inventory_denominator', dataKey: 'denominator' },
        { title: t(p + 'inventoryRate'), key: 'inventory_rate', dataKey: 'rate' },
        { title: t(p + 'scoreLabel', { max: 5 }), key: 'inventory_score', dataKey: 'score', maxScore: 5 },
      ]),
      createKpiDetailColumn(t(p + 'onTimeDeliveryRate'), 13, [
        { title: t(p + 'ontimeNumerator'), key: 'ontime_numerator', dataKey: 'numerator' },
        { title: t(p + 'ontimeDenominator'), key: 'ontime_denominator', dataKey: 'denominator' },
        { title: t(p + 'ontimeRate'), key: 'ontime_rate', dataKey: 'rate' },
        { title: t(p + 'scoreLabel', { max: 30 }), key: 'ontime_score', dataKey: 'score', maxScore: 30 },
      ]),
      createKpiDetailColumn(t(p + 'cargoDamageRate'), 14, [
        { title: t(p + 'damageNumerator'), key: 'damage_numerator', dataKey: 'numerator' },
        { title: t(p + 'damageDenominator'), key: 'damage_denominator', dataKey: 'denominator' },
        { title: t(p + 'damageRate'), key: 'damage_rate', dataKey: 'rate', decimalPlaces: 3 },
        { title: t(p + 'scoreLabel', { max: 5 }), key: 'damage_score', dataKey: 'score', maxScore: 5 },
      ]),
    ];

    const secondGroupKpiColumns = [
      createKpiDetailColumn(t(p + 'abnormalResolutionRate'), 15, [
        { title: t(p + 'abnormalNumerator'), key: 'abnormal_numerator', dataKey: 'numerator' },
        { title: t(p + 'abnormalDenominator'), key: 'abnormal_denominator', dataKey: 'denominator' },
        { title: t(p + 'abnormalRate'), key: 'abnormal_rate', dataKey: 'rate' },
        { title: t(p + 'scoreLabel', { max: 5 }), key: 'abnormal_score', dataKey: 'score', maxScore: 5 },
      ]),
      createKpiDetailColumn(t(p + 'secAppSignOffRate'), 43, [
        { title: t(p + 'secAppNumerator'), key: 'sec_app_numerator', dataKey: 'numerator' },
        { title: t(p + 'secAppDenominator'), key: 'sec_app_denominator', dataKey: 'denominator' },
        { title: t(p + 'secAppRate'), key: 'sec_app_rate', dataKey: 'rate' },
        { title: t(p + 'scoreLabel', { max: 5 }), key: 'sec_app_score', dataKey: 'score', maxScore: 5 },
      ]),
      createKpiDetailColumn(t(p + 'tmsAppSignOffRate'), 16, [
        { title: t(p + 'tmsAppNumerator'), key: 'tms_app_numerator', dataKey: 'numerator' },
        { title: t(p + 'tmsAppDenominator'), key: 'tms_app_denominator', dataKey: 'denominator' },
        { title: t(p + 'tmsAppRate'), key: 'tms_app_rate', dataKey: 'rate' },
        { title: t(p + 'scoreLabel', { max: 5 }), key: 'tms_app_score', dataKey: 'score', maxScore: 5 },
      ]),
      createKpiDetailColumn(t(p + 'tmsInfoSignOffTimeliness'), 17, [
        { title: t(p + 'tmsNumerator'), key: 'tms_numerator', dataKey: 'numerator' },
        { title: t(p + 'tmsDenominator'), key: 'tms_denominator', dataKey: 'denominator' },
        { title: t(p + 'tmsRate'), key: 'tms_rate', dataKey: 'rate' },
        { title: t(p + 'scoreLabel', { max: 10 }), key: 'tms_score', dataKey: 'score', maxScore: 10 },
      ]),
      createKpiDetailColumn(t(p + 'returnOrderTimelinessRate'), 11, [
        { title: t(p + 'returnNumerator'), key: 'return_numerator', dataKey: 'numerator' },
        { title: t(p + 'returnDenominator'), key: 'return_denominator', dataKey: 'denominator' },
        { title: t(p + 'returnRate'), key: 'return_rate', dataKey: 'rate' },
        { title: t(p + 'scoreLabel', { max: 10 }), key: 'return_score', dataKey: 'score', maxScore: 10 },
      ]),
      createKpiDetailColumn(t(p + 'operationAccuracyRate'), 5, [
        { title: t(p + 'operationRate'), key: 'operation_rate', dataKey: 'rate' },
        { title: t(p + 'scoreLabel', { max: 5 }), key: 'operation_score', dataKey: 'score', maxScore: 5 },
      ]),
      createKpiDetailColumn(t(p + 'customerSatisfaction'), 18, [
        { title: t(p + 'customerRating'), key: 'customer_rate', dataKey: 'satisfact' },
        { title: t(p + 'scoreLabel', { max: 10 }), key: 'customer_score', dataKey: 'score', maxScore: 5 },
      ]),
    ];

    return [...baseColumns, ...firstGroupKpiColumns, ...secondGroupKpiColumns];
  } else {
    const firstGroupKpiColumns = [
      createSimpleKpiColumn(t(p + 'secInboundCycleComplianceRate'), 'secInboundCycleComplianceRate', 12, 160),
      createSimpleKpiColumn(t(p + 'deliveryOnTimeRate'), 'deliveryOnTimeRate', 1, 120),
      createSimpleKpiColumn(t(p + 'inventoryAccuracyRate'), 'inventoryAccuracyRate', 4, 120),
      createSimpleKpiColumn(t(p + 'onTimeDeliveryRate'), 'onTimeDeliveryRate', 13, 120),
      createSimpleKpiColumn(t(p + 'cargoDamageRate'), 'cargoDamageRate', 14, 120, 3),
    ];

    const secondGroupKpiColumns = [
      createSimpleKpiColumn(t(p + 'abnormalResolutionRate'), 'abnormalResolutionRate', 15, 140),
      createSimpleKpiColumn(t(p + 'secAppSignOffRate'), 'secAppSignOffRate', 43, 140),
      createSimpleKpiColumn(t(p + 'tmsAppSignOffRate'), 'tmsAppSignOffRate', 16, 140),
      createSimpleKpiColumn(t(p + 'tmsInfoSignOffTimeliness'), 'tmsInfoSignOffTimeliness', 17, 160),
      createSimpleKpiColumn(t(p + 'returnOrderTimelinessRate'), 'returnOrderTimelinessRate', 11, 120),
      createSimpleKpiColumn(t(p + 'operationAccuracyRate'), 'operationAccuracyRate', 5, 120),
      createSimpleSatisfactColumn(t(p + 'customerSatisfaction'), 'customerSatisfaction', 18, 120),
    ];

    return [...baseColumns, ...firstGroupKpiColumns, ...secondGroupKpiColumns];
  }
});

const selectedLogisticProviderText = computed(() => {
  if (selectedLogisticProvider.value.length === 0) return t('dashboard.cityLogistics.filters.logisticProvider');
  const names = selectedLogisticProvider.value.map(code => {
    const option = logisticProviderOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const selectedCdcWarehouseText = computed(() => {
  if (selectedCdcWarehouse.value.length === 0) return t('dashboard.cityLogistics.filters.cdcWarehouse');
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
    fetchData();
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
    fetchData();
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

const fetchData = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
    return;
  }

  try {
    loading.value = true;
    tableData.value = [];
    
    const params = {
      startDate: dateRange.value[0].format('YYYY-MM'),
      endDate: dateRange.value[1].format('YYYY-MM'),
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
    };
    
    const result = await queryDeliveryKpiSummary(params);
    
    if (result && result.code === 200 && result.data) {
      dataStore.updateModuleData('cityLogisticsScores', result.data);
      if (Array.isArray(result.data)) {
        const processedData: any[] = [];
        
        result.data.forEach((item: any) => {
          const isAllNull = !item.month && 
                           !item.logistic && 
                           !item.cdcWarehouse && 
                           item.totalScore === null && 
                           (!item.kpi || item.kpi.length === 0);
          
          if (!isAllNull) {
            processedData.push({
              key: `${item.month || ''}_${item.logistic || ''}_${item.cdcWarehouse || ''}`,
              yearMonth: item.month || '',
              logistic: item.logistic || '-',
              cdcWarehouse: item.cdcWarehouse || '-',
              totalScore: item.totalScore !== undefined ? item.totalScore : null,
              kpiData: item.kpi || [],
            });
          }
        });
        
        tableData.value = processedData;
      } else {
        tableData.value = [];
      }
    } else {
      message.error(result?.msg || t('dashboard.cityLogistics.messages.fetchDataFailed'));
      tableData.value = [];
    }
  } catch (error) {
    console.error('获取数据失败:', error);
    message.error(t('dashboard.cityLogistics.messages.fetchDataFailed'));
    tableData.value = [];
  } finally {
    loading.value = false;
  }
};

watch(dateRange, () => {
  fetchData();
}, { deep: true });

watch(showDetails, () => {
  nextTick(() => {
    calculateTableScrollY();
  });
});

const calculateTableScrollY = () => {
  nextTick(() => {
    if (tableSectionRef.value) {
      const containerHeight = tableSectionRef.value.clientHeight;
      const tableElement = tableSectionRef.value.querySelector('.ant-table');
      let headerHeight = 0;
      if (tableElement) {
        const thead = tableElement.querySelector('.ant-table-thead');
        if (thead) {
          headerHeight = thead.clientHeight;
        }
      }
      const calculatedHeight = containerHeight > 300 
        ? containerHeight - headerHeight - 20 
        : 200;
      tableScrollY.value = Math.max(calculatedHeight, 200);
    }
  });
};

const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (target.closest('.custom-modal')) {
    return;
  }
  if (!target.closest('.dropdown-item') && !target.closest('.dropdown-content')) {
    if (isLogisticProviderOpen.value || isCdcWarehouseOpen.value) {
      closeAllDropdowns();
      fetchData();
    }
  }
};

onMounted(async () => {
  await selectOptionsStore.fetchLogisticsByBizType('3');
  await selectOptionsStore.fetchWarehouseByBizType('3');
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

const handleExportSummary = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
    message.warning(t('dashboard.cityLogistics.messages.selectDateRange'));
    return;
  }
  if (!tableData.value || tableData.value.length === 0) {
    message.warning(t('dashboard.cityLogistics.messages.noDataToExport'));
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
    };
    const result = await exportDeliveryLogisticKpiScoreSummary(params);
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : t('dashboard.cityLogistics.messages.exportSummaryFilename', [dateRange.value[0].format('YYYY-MM'), dateRange.value[1].format('YYYY-MM')]);
        link.download = downloadFilename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(t('dashboard.cityLogistics.messages.exportSummarySuccess'));
      }
    } else {
      message.error(result?.message || t('dashboard.cityLogistics.messages.exportSummaryFailed'));
    }
  } catch (error: any) {
    const errCode = error?.code || error?.response?.status;
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || t('dashboard.cityLogistics.messages.exportDataTooLarge'));
    } else {
      message.error(error.msg || t('dashboard.cityLogistics.messages.exportSummaryFailed'));
    }
  } finally {
    exportSummaryLoading.value = false;
  }
};

const handleExportDetail = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
    message.warning(t('dashboard.cityLogistics.messages.selectDateRange'));
    return;
  }
  if (!tableData.value || tableData.value.length === 0) {
    message.warning(t('dashboard.cityLogistics.messages.noDataToExport'));
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
    };
    const result = await exportDeliveryLogisticKpiScoreDetail(params);
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : t('dashboard.cityLogistics.messages.exportDetailFilename', [dateRange.value[0].format('YYYY-MM'), dateRange.value[1].format('YYYY-MM')]);
        link.download = downloadFilename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(t('dashboard.cityLogistics.messages.exportDetailSuccess'));
      }
    } else {
      message.error(result?.message || t('dashboard.cityLogistics.messages.exportDetailFailed'));
    }
  } catch (error: any) {
    const errCode = error?.code || error?.response?.status;
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || t('dashboard.cityLogistics.messages.exportDataTooLarge'));
    } else {
      message.error(error.msg || t('dashboard.cityLogistics.messages.exportDetailFailed'));
    }
  } finally {
    exportDetailLoading.value = false;
  }
};

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', calculateTableScrollY);
  if (tableSectionRef.value && (tableSectionRef.value as any)._resizeObserver) {
    (tableSectionRef.value as any)._resizeObserver.disconnect();
  }
});
</script>

<template>
  <div class="rank-container">
    <div class="header-bar">
      <h2 class="header-title">{{ t('dashboard.cityLogistics.title') }}</h2>
    </div>
    <div class="control-panel">
      <div class="filter-group">
        <div class="date-range-item">
          <a-range-picker
            v-model:value="dateRange"
            picker="month"
            format="YYYY-MM"
            :separator="t('dashboard.cityLogistics.filters.separator')"
            :placeholder="[t('dashboard.cityLogistics.filters.startMonth'), t('dashboard.cityLogistics.filters.endMonth')]"
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
                :placeholder="t('dashboard.cityLogistics.placeholders.searchLogisticProvider')" 
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
                {{ t('dashboard.cityLogistics.placeholders.noSearchResults') }}
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
                :placeholder="t('dashboard.cityLogistics.placeholders.searchCdcWarehouse')" 
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
                {{ t('dashboard.cityLogistics.placeholders.noSearchResults') }}
              </div>
            </div>
          </div>
        </div>

        <div class="switch-item">
          <span class="switch-label">{{ t('dashboard.cityLogistics.filters.showDetails') }}</span>
          <a-switch v-model:checked="showDetails" />
        </div>

      </div>
      
      <div class="action-buttons">
        <a-button @click="handleExportSummary" class="action-btn" :loading="exportSummaryLoading">
          {{ t('dashboard.cityLogistics.buttons.exportSummary') }}
        </a-button>
        <a-button @click="handleExportDetail" class="action-btn" :loading="exportDetailLoading">
          {{ t('dashboard.cityLogistics.buttons.exportDetail') }}
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
          :scroll="{ x: 'max-content', y: tableScrollY }"
        />
      </a-spin>
    </div>

  </div>
</template>

<style scoped>
.rank-container {
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

.control-panel .filter-group {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  position: relative;
  overflow: visible;
}

.control-panel .filter-group .date-range-item {
  flex-shrink: 1;
}

.control-panel .filter-group .date-range-item .date-range-picker {
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

.control-panel .filter-group .date-range-item .date-range-picker:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.control-panel .filter-group .switch-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  flex-shrink: 0;
}

.control-panel .filter-group .switch-item .switch-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  white-space: nowrap;
}

.control-panel .filter-group .dropdown-item {
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

.control-panel .filter-group .dropdown-item:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.control-panel .filter-group .dropdown-item .dropdown-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.control-panel .filter-group .dropdown-item .dropdown-icon {
  width: 0.8rem;
  height: 0.8rem;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease;
}

.control-panel .filter-group .dropdown-item .dropdown-content {
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

.control-panel .filter-group .dropdown-item .dropdown-content .search-box {
  padding: 0.2rem;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
  flex-shrink: 0;
}

.control-panel .filter-group .dropdown-item .dropdown-content .search-box .search-input {
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

.control-panel .filter-group .dropdown-item .dropdown-content .search-box .search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.control-panel .filter-group .dropdown-item .dropdown-content .search-box .search-input:focus {
  border-color: rgba(59, 130, 246, 0.8);
  background: rgba(0, 0, 0, 0.5);
}

.control-panel .filter-group .dropdown-item .dropdown-content .options-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 7.6rem;
  padding: 0.2rem;
}

.control-panel .filter-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar {
  width: 6px;
}

.control-panel .filter-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}

.control-panel .filter-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.control-panel .filter-group .dropdown-item .dropdown-content .options-list .dropdown-option {
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

.control-panel .filter-group .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
  margin-bottom: 0.1rem;
  padding-bottom: 0.3rem;
  position: relative;
}

.control-panel .filter-group .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0.0625rem;
  background: rgba(59, 130, 246, 0.3);
}

.control-panel .filter-group .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option:hover {
  background: rgba(59, 130, 246, 0.3);
  color: rgba(255, 255, 255, 1);
}

.control-panel .filter-group .dropdown-item .dropdown-content .options-list .dropdown-option:hover {
  background: rgba(59, 130, 246, 0.3);
}

.control-panel .filter-group .dropdown-item .dropdown-content .options-list .dropdown-option.selected {
  background: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}

.control-panel .filter-group .dropdown-item .dropdown-content .options-list .dropdown-option .checkmark {
  color: #00ff88;
  font-weight: bold;
  font-size: 0.8rem;
}

.control-panel .filter-group .dropdown-item .dropdown-content .options-list .no-results {
  padding: 0.25rem 0.6rem;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.75rem;
  text-align: center;
  font-style: italic;
}

.table-section {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  padding: 1rem;
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

.table-section .custom-table :deep(.ant-table) {
  background: transparent;
}

.table-section .custom-table :deep(.ant-table-thead > tr > th) {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  font-size: 0.75rem;
}

.table-section .custom-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  color: white;
  font-size: 0.7rem;
  text-align: center;
}

.table-section .custom-table :deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(74, 158, 255, 0.1);
}

.table-section .custom-table :deep(.ant-table-container) {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  width: 100%;
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}

.table-section .custom-table :deep(.ant-table-container)::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.table-section .custom-table :deep(.ant-table-container)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.table-section .custom-table :deep(.ant-table-container)::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.table-section .custom-table :deep(.ant-table-container)::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.5);
}

.table-section .custom-table :deep(.ant-table-container)::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.1);
}

.table-section .custom-table :deep(.ant-table-body) {
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}

.table-section .custom-table :deep(.ant-table-body::-webkit-scrollbar) {
  width: 4px;
  height: 4px;
}

.table-section .custom-table :deep(.ant-table-body::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.table-section .custom-table :deep(.ant-table-body::-webkit-scrollbar-thumb) {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.table-section .custom-table :deep(.ant-table-body::-webkit-scrollbar-thumb:hover) {
  background: rgba(74, 158, 255, 0.5);
}

.table-section .custom-table :deep(.ant-table-body::-webkit-scrollbar-corner) {
  background: rgba(0, 0, 0, 0.1);
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-left: auto;
}

.action-buttons .action-btn {
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

.action-buttons .action-btn:hover:not(:disabled) {
  background: #1e6cc8;
  box-shadow: 1px 1px 1px 0px #1c5fb8, inset 0px 1px 1px 0px #b8d5ff;
}

.action-buttons .action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
