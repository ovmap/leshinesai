<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h, nextTick } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore';
import { queryHuaxingKpiSummary, exportHuaxingLogisticKpiScoreSummary, exportHuaxingLogisticKpiScoreDetail } from '../../../services/transportApi';

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

// TCL华星业务类型为 '7'
const bizType = '7';

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

// 表格列定义
const tableColumns = computed(() => {
  const baseColumns = [
    { title: '年月', key: 'month', dataIndex: 'month', width: 120, align: 'center' as const },
    { title: '物流商', key: 'logisticProvider', dataIndex: 'logisticProvider', width: 120, align: 'center' as const },
    { title: '运输方式', key: 'transType', dataIndex: 'transType', width: 120, align: 'center' as const },
    { title: '发货平台', key: 'cdcWarehouse', dataIndex: 'cdcWarehouse', width: 120, align: 'center' as const },
  ];

  if (showDetails.value) {
    // 显示详情时的表头（带子列）
    const kpiColumns = [
      // 提货及时率 (kpiType: 34)
      createKpiDetailColumn('提货及时率', 34, [
        { title: '达标数量', key: 'doa_ontime_numerator', dataKey: 'numerator' },
        { title: '总数量', key: 'doa_ontime_denominator', dataKey: 'denominator' },
        { title: '达标率', key: 'doa_ontime_rate', dataKey: 'rate' },
        { title: '得分(满分10分)', key: 'doa_ontime_score', dataKey: 'score', maxScore: 10 },
      ]),
      // 送货及时率 (kpiType: 35)
      createKpiDetailColumn('送货及时率', 35, [
        { title: '达标数量', key: 'doa_delivery_numerator', dataKey: 'numerator' },
        { title: '总数量', key: 'doa_delivery_denominator', dataKey: 'denominator' },
        { title: '达标率', key: 'doa_delivery_rate', dataKey: 'rate' },
        { title: '得分(满分20分)', key: 'doa_delivery_score', dataKey: 'score', maxScore: 20 },
      ]),
      // 返单及时率 (kpiType: 36)
      createKpiDetailColumn('返单及时率', 36, [
        { title: '达标数量', key: 'doa_return_numerator', dataKey: 'numerator' },
        { title: '总数量', key: 'doa_return_denominator', dataKey: 'denominator' },
        { title: '达标率', key: 'doa_return_rate', dataKey: 'rate' },
        { title: '得分(满分10分)', key: 'doa_return_score', dataKey: 'score', maxScore: 10 },
      ]),
    ];
    return [
      ...baseColumns,
      { title: '总成绩', key: 'totalScore', dataIndex: 'totalScore', width: 120, align: 'center' as const },
      ...kpiColumns,
      { title: '得分汇总', key: 'scoreSummary', dataIndex: 'scoreSummary', width: 150, align: 'center' as const },
      {
        title: '扣分项', key: 'deductionitem',
        children: [
          { title: '质量（默认满分30）', key: 'qualityDeduction', dataIndex: 'qualityDeduction', width: 150, align: 'center' as const },
          { title: '服务（默认满分15）', key: 'serviceDeduction', dataIndex: 'serviceDeduction', width: 150, align: 'center' as const },
          { title: '安全（默认满分15）', key: 'safetyDeduction', dataIndex: 'safetyDeduction', width: 150, align: 'center' as const },
          { title: '其他扣分项', key: 'otherDeduction', dataIndex: 'otherDeduction', width: 150, align: 'center' as const },
          { title: '扣分说明', key: 'deductionDesc', dataIndex: 'deductionDesc', width: 150, align: 'center' as const },
        ]
      },
      {
        title: '加分项', key: 'bonusitem',
        children: [
          { title: '其他加分项', key: 'otherBonus', dataIndex: 'otherBonus', width: 150, align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderNumberCell(text, record.otherBonusTrend);
            }
          },
          { title: '加分说明', key: 'bonusDescription', dataIndex: 'bonusDescription', width: 150, align: 'center' as const },
        ]
      }
    ];
  } else {
    // 不显示详情时的简化表头
    return [
      ...baseColumns,
      {
        title: '提货及时率', key: 'pickupTimelinessRate', dataIndex: 'pickupTimelinessRate', width: 150, align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 34);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      },
      {
        title: '送货及时率', key: 'deliveryOnTimeRate', dataIndex: 'deliveryOnTimeRate', width: 150, align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 35);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      },
      {
        title: '返单及时率', key: 'onTimeReturnRate', dataIndex: 'onTimeReturnRate', width: 200, align: 'center' as const,
        customRender: ({ record }: { record: any }) => {
          const kpi = record.kpiData?.find((k: any) => k.kpiType === 36);
          if (!kpi) return '-';
          const rate = kpi.rate !== undefined && kpi.rate !== null ? kpi.rate * 100 : 0;
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, false);
        },
      }
    ];
  }
});

// 根据 color 值获取颜色
const getColorByValue = (colorValue: 'red' | 'yellow' | 'green' | null): string => {
  if (colorValue === 'red') return '#ff4d4f';
  if (colorValue === 'yellow') return '#faad14';
  if (colorValue === 'green') return '#52c41a';
  return 'rgba(255, 255, 255, 0.7)';
};

// 渲染数字单元格
const renderNumberCell = (value: number | string, colorValue: 'red' | 'yellow' | 'green' | null) => {
  const textColor = getColorByValue(colorValue);
  const displayValue = value !== null && value !== undefined ? String(value) : '-';
  return h('span', { style: { color: textColor } }, displayValue);
};

// 渲染比率单元格
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

// 创建KPI详情列
const createKpiDetailColumn = (
  parentTitle: string, 
  kpiType: number, 
  children: Array<{ title: string; key: string; dataKey: string; maxScore?: number }>
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
          return renderRateCell(rate, kpi.trend || null, kpi.color || null, true);
        } else if (child.dataKey === 'score') {
          return kpi.score ?? '-';
        }
        return '-';
      },
    })),
  };
};

// 显示文本
const selectedLogisticProviderText = computed(() => {
  if (selectedLogisticProvider.value.length === 0) return '物流商';
  const names = selectedLogisticProvider.value.map(code => {
    const option = logisticProviderOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const selectedCdcWarehouseText = computed(() => {
  if (selectedCdcWarehouse.value.length === 0) return '发货平台';
  const names = selectedCdcWarehouse.value.map(code => {
    const option = cdcWarehouseOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

// 下拉框切换
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

// 选择选项
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

// 获取表格数据
const fetchTableData = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) return;
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
    const result = await queryHuaxingKpiSummary(params);
    if (result && result.code === 200 && result.data) {
      if (Array.isArray(result.data) && result.data.length > 0) {
        tableData.value = result.data.map((item: any, index: number) => {
          const row: any = {
            key: String(index + 1),
            month: item.month || '',
            logisticProvider: item.logistic || '',
            transType: item.transType || '',
            cdcWarehouse: item.cdcWarehouse || '',
            totalScore: item.totalScore || 0,
            scoreSummary: item.scoreSummary || 0,
            qualityDeduction: item.qualityDeduction || 0,
            serviceDeduction: item.serviceDeduction || 0,
            safetyDeduction: item.safetyDeduction || 0,
            otherDeduction: item.otherDeduction || 0,
            otherBonus: item.otherBonus || 0,
            otherBonusTrend: item.otherBonusTrend || null,
            deductionDesc: item.deductionDesc || '',
            bonusDescription: item.bonusDescription || '',
            kpiData: item.kpi || [],
          };
          return row;
        });
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

// 导出汇总
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
      agg: ["LOGISTIC","CDC_WAREHOUSE","MONTH","CUSTOMER"],
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
      bizType: '7',
    };
    const result = await exportHuaxingLogisticKpiScoreSummary(params);
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : `华星物流商KPI评分汇总_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`;
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

// 导出明细
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
      agg: ["LOGISTIC","CDC_WAREHOUSE","MONTH","CUSTOMER"],
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
      bizType: '7',
    };
    const result = await exportHuaxingLogisticKpiScoreDetail(params);
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : `华星物流商KPI评分明细_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`;
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

// 监听变化
watch(dateRange, () => { fetchTableData(); }, { deep: true });

watch(showDetails, () => {
  nextTick(() => { calculateTableScrollY(); });
});

// 点击外部关闭下拉框
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.dropdown-item') && !target.closest('.dropdown-content')) {
    if (isLogisticProviderOpen.value || isCdcWarehouseOpen.value) {
      closeAllDropdowns();
      fetchTableData();
    }
  }
};

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

onMounted(async () => {
  await selectOptionsStore.fetchLogisticsByBizType('7');
  await selectOptionsStore.fetchWarehouseByBizType('7');
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
  <div class="tcl-card-container">
    <div class="header-bar">
      <h2 class="header-title">华星物流商KPI评分</h2>
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
        <!-- 发货平台下拉框 -->
        <div class="dropdown-item" @click.stop="toggleCdcWarehouseDropdown">
          <span class="dropdown-text">{{ selectedCdcWarehouseText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isCdcWarehouseOpen" @click.stop>
            <div class="search-box">
              <input v-model="cdcWarehouseSearch" type="text" placeholder="搜索发货平台..." class="search-input" @click.stop />
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
.tcl-card-container {
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

.export-group {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}
.export-btn {
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
