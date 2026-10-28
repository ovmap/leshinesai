<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore';
import { useDashboardDataStore } from '../../../stores/dashboardDataStore';
import { queryTransKpiSummary, queryTransTypeList, exportTransLogisticKpiScoreSummary, exportTransLogisticKpiScoreDetail } from '../../../services/transportApi';

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
const selectedTransType = ref<string[]>([]);
const showDetails = ref(false);

const bizType = '2';

const logisticProviderOptions = computed(() => selectOptionsStore.getLogisticsByBizType(bizType));
const cdcWarehouseOptions = computed(() => selectOptionsStore.getWarehouseByBizType(bizType));
const transTypeOptions = ref<{ code: string; name: string }[]>([]);

const logisticProviderSearch = ref('');
const cdcWarehouseSearch = ref('');
const transTypeSearch = ref('');

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
  return [{ code: '__reset__', name: t('dashboard.transportationLogistics.reset') }, ...filtered];
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
  return [{ code: '__reset__', name: t('dashboard.transportationLogistics.reset') }, ...filtered];
});

const filteredTransTypeOptions = computed(() => {
  let filtered: { code: string; name: string }[] = [];
  if (!transTypeSearch.value.trim()) {
    filtered = transTypeOptions.value;
  } else {
    const searchLower = transTypeSearch.value.toLowerCase();
    filtered = transTypeOptions.value.filter((option: { code: string; name: string }) =>
      option.name.toLowerCase().includes(searchLower)
    );
  }
  return [{ code: '__reset__', name: t('dashboard.transportationLogistics.reset') }, ...filtered];
});

const isLogisticProviderOpen = ref(false);
const isCdcWarehouseOpen = ref(false);
const isTransTypeOpen = ref(false);

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
      width: child.key.endsWith('_score') ? 140 : (child.title.length > 12 ? 180 : 160),
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
      title: t('dashboard.transportationLogistics.yearMonth'),
      key: 'yearMonth',
      dataIndex: 'yearMonth',
      width: 100,
      align: 'center' as const,
      customRender: ({ text }: { text: string | undefined }) => {
        if (!text || text === '汇总') return text || '-';
        const textStr = text || '';
        const parts = textStr.split('-');
        if (parts.length === 2 && parts[0] && parts[1]) {
          return `${parts[0]}${t('dashboard.transportationLogistics.year')}${parseInt(parts[1])}${t('dashboard.transportationLogistics.month')}`;
        }
        return text || '-';
      },
    },
    {
      title: t('dashboard.transportationLogistics.transType'),
      key: 'transType',
      dataIndex: 'transType',
      width: 120,
      align: 'center' as const,
    },
    {
      title: t('dashboard.transportationLogistics.logisticProvider'),
      key: 'logistic',
      dataIndex: 'logistic',
      width: 120,
      align: 'center' as const,
    },
    {
      title: t('dashboard.transportationLogistics.cdcWarehouse'),
      key: 'cdcWarehouse',
      dataIndex: 'cdcWarehouse',
      width: 120,
      align: 'center' as const,
    },
  ];

  if (showDetails.value) {
    baseColumns.push({
      title: t('dashboard.transportationLogistics.totalScore'),
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
    const kpiColumns = [
      createKpiDetailColumn(t('dashboard.transportationLogistics.trunkOnTimeDeliveryRate'), 6, [
        { title: t('dashboard.transportationLogistics.deliveryOrderCount'), key: 'trunk_numerator', dataKey: 'numerator' },
        { title: t('dashboard.transportationLogistics.totalDeliveryOrderCount'), key: 'trunk_denominator', dataKey: 'denominator' },
        { title: t('dashboard.transportationLogistics.trunkOnTimeDeliveryRate'), key: 'trunk_rate', dataKey: 'rate' },
        { title: t('dashboard.transportationLogistics.scoreFull50'), key: 'trunk_score', dataKey: 'score', maxScore: 50 },
      ]),
      createKpiDetailColumn(t('dashboard.transportationLogistics.pickupTimelinessRate'), 7, [
        { title: t('dashboard.transportationLogistics.onTimeShipmentCount'), key: 'pickup_numerator', dataKey: 'numerator' },
        { title: t('dashboard.transportationLogistics.totalShipmentCount'), key: 'pickup_denominator', dataKey: 'denominator' },
        { title: t('dashboard.transportationLogistics.pickupTimelinessRate'), key: 'pickup_rate', dataKey: 'rate' },
        { title: t('dashboard.transportationLogistics.scoreFull10'), key: 'pickup_score', dataKey: 'score', maxScore: 10 },
      ]),
      createKpiDetailColumn(t('dashboard.transportationLogistics.trunkDamageRate'), 8, [
        { title: t('dashboard.transportationLogistics.damagedShipmentCount'), key: 'damage_numerator', dataKey: 'numerator' },
        { title: t('dashboard.transportationLogistics.totalShipmentCount'), key: 'damage_denominator', dataKey: 'denominator' },
        { title: t('dashboard.transportationLogistics.trunkDamageRate'), key: 'damage_rate', dataKey: 'rate', decimalPlaces: 3 },
        { title: t('dashboard.transportationLogistics.scoreFull10'), key: 'damage_score', dataKey: 'score', maxScore: 10 },
      ]),
      createKpiDetailColumn(t('dashboard.transportationLogistics.abnormal7dRate'), 9, [
        { title: t('dashboard.transportationLogistics.resolvedOrderCount'), key: 'abnormal_numerator', dataKey: 'numerator' },
        { title: t('dashboard.transportationLogistics.totalAbnormalCount'), key: 'abnormal_denominator', dataKey: 'denominator' },
        { title: t('dashboard.transportationLogistics.abnormal7dRate'), key: 'abnormal_rate', dataKey: 'rate' },
        { title: t('dashboard.transportationLogistics.scoreFull5'), key: 'abnormal_score', dataKey: 'score', maxScore: 10 },
      ]),
      createKpiDetailColumn(t('dashboard.transportationLogistics.infoFeedbackRate'), 10, [
        { title: t('dashboard.transportationLogistics.timelyFeedbackCount'), key: 'feedback_numerator', dataKey: 'numerator' },
        { title: t('dashboard.transportationLogistics.totalShipmentCount'), key: 'feedback_denominator', dataKey: 'denominator' },
        { title: t('dashboard.transportationLogistics.infoFeedbackRate'), key: 'feedback_rate', dataKey: 'rate' },
        { title: t('dashboard.transportationLogistics.scoreFull10'), key: 'feedback_score', dataKey: 'score', maxScore: 5 },
      ]),
      createKpiDetailColumn(t('dashboard.transportationLogistics.returnOrderTimelinessRate'), 11, [
        { title: t('dashboard.transportationLogistics.timelyReturnCount'), key: 'return_numerator', dataKey: 'numerator' },
        { title: t('dashboard.transportationLogistics.totalShipmentCount'), key: 'return_denominator', dataKey: 'denominator' },
        { title: t('dashboard.transportationLogistics.returnOrderTimelinessRate'), key: 'return_rate', dataKey: 'rate' },
        { title: t('dashboard.transportationLogistics.scoreFull10'), key: 'return_score', dataKey: 'score', maxScore: 10 },
      ]),
      createKpiDetailColumn(t('dashboard.transportationLogistics.operationAccuracyRate'), 5, [
        { title: t('dashboard.transportationLogistics.operationAccuracyRate'), key: 'operation_rate', dataKey: 'rate' },
        { title: t('dashboard.transportationLogistics.scoreFull5'), key: 'operation_score', dataKey: 'score', maxScore: 5 },
      ]),
    ];
    return [...baseColumns, ...kpiColumns];
  } else {
    const kpiColumns = [
      {
        title: t('dashboard.transportationLogistics.trunkOnTimeDeliveryRate'),
        key: 'trunkLineOnTimeRate',
        dataIndex: 'trunkLineOnTimeRate',
        width: 150,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 6);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      },
      {
        title: t('dashboard.transportationLogistics.pickupTimelinessRate'),
        key: 'pickupTimelinessRate',
        dataIndex: 'pickupTimelinessRate',
        width: 150,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 7);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      },
      {
        title: t('dashboard.transportationLogistics.trunkDamageRate'),
        key: 'trunkLineDamageRate',
        dataIndex: 'trunkLineDamageRate',
        width: 150,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 8);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false, 3);
        },
      },
      {
        title: t('dashboard.transportationLogistics.abnormal7dRate'),
        key: 'abnormalOrderProcessingRate',
        dataIndex: 'abnormalOrderProcessingRate',
        width: 200,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 9);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      },
      {
        title: t('dashboard.transportationLogistics.infoFeedbackRate'),
        key: 'infoFeedbackTimelinessRate',
        dataIndex: 'infoFeedbackTimelinessRate',
        width: 150,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 10);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      },
      {
        title: t('dashboard.transportationLogistics.returnOrderTimelinessRate'),
        key: 'returnOrderTimelinessRate',
        dataIndex: 'returnOrderTimelinessRate',
        width: 150,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 11);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      },
      {
        title: t('dashboard.transportationLogistics.operationAccuracyRate'),
        key: 'operationAccuracyRate',
        dataIndex: 'operationAccuracyRate',
        width: 150,
        align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 5);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      },
    ];
    return [...baseColumns, ...kpiColumns];
  }
});

const selectedLogisticProviderText = computed(() => {
  if (selectedLogisticProvider.value.length === 0) return t('dashboard.transportationLogistics.logisticProvider');
  const names = selectedLogisticProvider.value.map(code => {
    const option = logisticProviderOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const selectedCdcWarehouseText = computed(() => {
  if (selectedCdcWarehouse.value.length === 0) return t('dashboard.transportationLogistics.cdcWarehouse');
  const names = selectedCdcWarehouse.value.map(code => {
    const option = cdcWarehouseOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const selectedTransTypeText = computed(() => {
  if (selectedTransType.value.length === 0) return t('dashboard.transportationLogistics.transType');
  const names = selectedTransType.value.map(code => {
    const option = transTypeOptions.value.find(item => item.code === code);
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

const toggleTransTypeDropdown = () => {
  if (isTransTypeOpen.value) {
    isTransTypeOpen.value = false;
    transTypeSearch.value = '';
    fetchData();
  } else {
    closeAllDropdowns();
    isTransTypeOpen.value = true;
    transTypeSearch.value = '';
  }
};

const closeAllDropdowns = () => {
  isLogisticProviderOpen.value = false;
  isCdcWarehouseOpen.value = false;
  isTransTypeOpen.value = false;
  logisticProviderSearch.value = '';
  cdcWarehouseSearch.value = '';
  transTypeSearch.value = '';
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

const selectTransType = (code: string) => {
  if (code === '__reset__') {
    selectedTransType.value = [];
    transTypeSearch.value = '';
    return;
  }
  const index = selectedTransType.value.indexOf(code);
  if (index > -1) {
    selectedTransType.value.splice(index, 1);
  } else {
    selectedTransType.value.push(code);
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
      transType: selectedTransType.value || [],
    };
    
    const result = await queryTransKpiSummary(params);
    
    if (result && result.code === 200 && result.data) {
      dataStore.updateModuleData('transportationLogisticsScores', result.data)
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
              key: `${item.month || ''}_${item.transType || ''}_${item.logistic || ''}_${item.cdcWarehouse || ''}`,
              yearMonth: item.month || '',
              transType: item.transType || '-',
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
      message.error(result?.msg || t('dashboard.transportationLogistics.fetchDataFailed'));
      tableData.value = [];
    }
  } catch (error) {
    console.error('Fetch transportation logistics data failed:', error);
    message.error(t('dashboard.transportationLogistics.fetchDataFailed'));
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
    if (isLogisticProviderOpen.value || isCdcWarehouseOpen.value || isTransTypeOpen.value) {
      closeAllDropdowns();
      fetchData();
    }
  }
};

const fetchTransTypeList = async () => {
  try {
    const result = await queryTransTypeList();
    if (result && result.code === 200 && result.data) {
      transTypeOptions.value = result.data
        .filter((item: any) => item != null && item !== undefined)
        .map((item: any) => ({
          code: item.code || item.value || '',
          name: item.name || item.label || '',
        }))
        .filter((option: { code: string; name: string }) => option.code && option.name);
    }
  } catch (error) {
    console.error('Fetch transport type list failed:', error);
    message.error(t('dashboard.transportationLogistics.fetchTransTypeFailed'));
  }
};

onMounted(async () => {
  await selectOptionsStore.fetchLogisticsByBizType('2');
  await selectOptionsStore.fetchWarehouseByBizType('2');
  await fetchTransTypeList();
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
    message.warning(t('dashboard.transportationLogistics.selectDateRange'));
    return;
  }
  if (!tableData.value || tableData.value.length === 0) {
    message.warning(t('dashboard.transportationLogistics.noDataToExport'));
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
      transType: selectedTransType.value || [],
    };
    const result = await exportTransLogisticKpiScoreSummary(params);
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : `${t('dashboard.transportationLogistics.exportSummaryFilename')}_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`;
        link.download = downloadFilename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(t('dashboard.transportationLogistics.exportSummarySuccess'));
      }
    } else {
      message.error(result?.message || t('dashboard.transportationLogistics.exportSummaryFailed'));
    }
  } catch (error: any) {
    const errCode = error?.code || error?.response?.status;
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || t('dashboard.transportationLogistics.exportDataTooLarge'));
    } else {
      message.error(error.msg || t('dashboard.transportationLogistics.exportSummaryFailed'));
    }
  } finally {
    exportSummaryLoading.value = false;
  }
};

const handleExportDetail = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
    message.warning(t('dashboard.transportationLogistics.selectDateRange'));
    return;
  }
  if (!tableData.value || tableData.value.length === 0) {
    message.warning(t('dashboard.transportationLogistics.noDataToExport'));
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
      transType: selectedTransType.value || [],
    };
    const result = await exportTransLogisticKpiScoreDetail(params);
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : `${t('dashboard.transportationLogistics.exportDetailFilename')}_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`;
        link.download = downloadFilename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(t('dashboard.transportationLogistics.exportDetailSuccess'));
      }
    } else {
      message.error(result?.message || t('dashboard.transportationLogistics.exportDetailFailed'));
    }
  } catch (error: any) {
    const errCode = error?.code || error?.response?.status;
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || t('dashboard.transportationLogistics.exportDataTooLarge'));
    } else {
      message.error(error.msg || t('dashboard.transportationLogistics.exportDetailFailed'));
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
      <h2 class="header-title">{{ t('dashboard.transportationLogistics.title') }}</h2>
    </div>
    <div class="control-panel">
      <div class="filter-group">
        <div class="date-range-item">
          <a-range-picker
            v-model:value="dateRange"
            picker="month"
            format="YYYY-MM"
            :separator="t('dashboard.transportationLogistics.dateSeparator')"
            :placeholder="[t('dashboard.transportationLogistics.startMonth'), t('dashboard.transportationLogistics.endMonth')]"
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
                :placeholder="t('dashboard.transportationLogistics.searchLogisticProvider')" 
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
                {{ t('dashboard.transportationLogistics.noSearchResults') }}
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
                :placeholder="t('dashboard.transportationLogistics.searchCdcWarehouse')" 
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
                {{ t('dashboard.transportationLogistics.noSearchResults') }}
              </div>
            </div>
          </div>
        </div>

        <div class="dropdown-item" @click.stop="toggleTransTypeDropdown">
          <span class="dropdown-text">{{ selectedTransTypeText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isTransTypeOpen" @click.stop>
            <div class="search-box">
              <input 
                v-model="transTypeSearch" 
                type="text" 
                :placeholder="t('dashboard.transportationLogistics.searchTransType')" 
                class="search-input"
                @click.stop 
              />
            </div>
            <div class="options-list">
              <div 
                v-for="option in filteredTransTypeOptions" 
                :key="option.code" 
                class="dropdown-option"
                :class="{ 
                  'selected': option.code !== '__reset__' && selectedTransType.includes(option.code),
                  'reset-option': option.code === '__reset__'
                }" 
                @click.stop="selectTransType(option.code)"
              >
                <span class="checkmark" v-if="option.code !== '__reset__' && selectedTransType.includes(option.code)">✓</span>
                {{ option.name }}
              </div>
              <div v-if="filteredTransTypeOptions.length === 1 && transTypeSearch" class="no-results">
                {{ t('dashboard.transportationLogistics.noSearchResults') }}
              </div>
            </div>
          </div>
        </div>

        <div class="switch-item">
          <span class="switch-label">{{ t('dashboard.transportationLogistics.showDetails') }}</span>
          <a-switch v-model:checked="showDetails" />
        </div>

      </div>
      
      <div class="action-buttons">
        <a-button @click="handleExportSummary" class="action-btn" :loading="exportSummaryLoading">
          {{ t('dashboard.transportationLogistics.exportSummary') }}
        </a-button>
        <a-button @click="handleExportDetail" class="action-btn" :loading="exportDetailLoading">
          {{ t('dashboard.transportationLogistics.exportDetail') }}
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
