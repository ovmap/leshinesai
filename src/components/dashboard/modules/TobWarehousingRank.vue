<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, Teleport } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore';
import { useDashboardDataStore } from '../../../stores/dashboardDataStore';
import {
  queryToBKpiRank,
  queryToBKpiRankDetail,
  queryToBLogisticPunishInfo,
  exportToBLogisticKpiRank,
  exportToBLogisticKpiRankScoreDetail,
  exportToBLogisticKpiRankPunishDetail
} from '../../../services/transportApi';

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>();

const selectOptionsStore = useSelectOptionsStore();
const dataStore = useDashboardDataStore();

const getInitialDateRange = (): [Dayjs, Dayjs] => {
  const now = dayjs();
  const startDate = now.subtract(3, 'month').startOf('month');
  const endDate = now.subtract(1, 'month').endOf('month');
  return [startDate, endDate];
};

const dateRange = ref<[Dayjs, Dayjs]>(getInitialDateRange());
const selectedLogisticProvider = ref<string[]>([]);
const selectedCdcWarehouse = ref<string[]>([]);

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

const modalVisible = ref(false);
const modalTitle = ref('PFP-仓库-ToB物流商KPI排名详情');
const activeTab = ref<'score' | 'reward'>('score');
const modalLoading = ref(false);
const exportLoading = ref(false);

const detailTableData = ref<any[]>([]);
const scoreTableData = ref<any[]>([]);
const rewardTableData = ref<any[]>([]);

let detailFetchRequestId = 0;

const modalIsLogisticProviderOpen = ref(false);
const modalIsCdcWarehouseOpen = ref(false);
const modalLogisticProviderSearch = ref('');
const modalCdcWarehouseSearch = ref('');
const modalSelectedLogisticProvider = ref<string[]>([]);
const modalSelectedCdcWarehouse = ref<string[]>([]);
const modalDateRange = ref<[Dayjs, Dayjs]>(getInitialDateRange());

const tableSectionRef = ref<HTMLElement | null>(null);
const tableScrollY = ref<number | undefined>(200);

const modalTableSectionRef = ref<HTMLElement | null>(null);
const modalTableScrollY = ref<number | undefined>(200);

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
    fetchRankData();
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
    fetchRankData();
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

const monthList = ref<string[]>([]);

const tableColumns = computed(() => {
  const baseColumns = [
    { title: '物流商', key: 'logistic', dataIndex: 'logistic', width: 120, align: 'center' as const },
    { title: '仓库', key: 'warehouse', dataIndex: 'warehouse', width: 120, align: 'center' as const },
  ];

  const monthColumns: any[] = [];
  const sortedMonths = [...monthList.value].sort((a, b) => dayjs(b).valueOf() - dayjs(a).valueOf());

  sortedMonths.forEach((month) => {
    let monthLabel: string;
    if (month === '0000-00' || !month || month.startsWith('0000')) {
      monthLabel = '0000年00月';
    } else {
      monthLabel = dayjs(month).format('YYYY年M月');
    }

    monthColumns.push({
      title: monthLabel,
      key: `month_${month}_performance`,
      align: 'center' as const,
      children: [
        { title: '排名', key: `${month}_rank`, dataIndex: `${month}_rank`, width: 80, align: 'center' as const },
        { title: '总成绩', key: `${month}_totalScore`, dataIndex: `${month}_totalScore`, width: 100, align: 'center' as const },
      ],
    });
  });

  sortedMonths.forEach((month) => {
    let monthLabel: string;
    if (month === '0000-00' || !month || month.startsWith('0000')) {
      monthLabel = '0000年00月';
    } else {
      monthLabel = dayjs(month).format('YYYY年M月');
    }

    monthColumns.push({
      title: monthLabel,
      key: `month_${month}_reward`,
      align: 'center' as const,
      children: [
        {
          title: '是否进行奖励',
          key: `${month}_hasReward`,
          dataIndex: `${month}_hasReward`,
          width: 120,
          align: 'center' as const,
          customRender: ({ text }: { text: boolean | null }) => {
            if (text === true) return '是';
            if (text === false) return '否';
            return '-';
          },
        },
        {
          title: '红线/重大/严重问题',
          key: `${month}_hasPunish`,
          dataIndex: `${month}_hasPunish`,
          width: 150,
          align: 'center' as const,
          customRender: ({ text }: { text: boolean | null }) => {
            if (text === true) return '是';
            if (text === false) return '否';
            return '-';
          },
        },
      ],
    });
  });

  return [...baseColumns, ...monthColumns];
});

const fetchRankData = async () => {
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

    const result = await queryToBKpiRank(params);

    if (result && result.code === 200 && result.data) {
      dataStore.updateModuleData('tobWarehousingRank', result.data)
      if (Array.isArray(result.data)) {
        const monthSet = new Set<string>();
        result.data.forEach((item: any) => {
          if (item.rankList && Array.isArray(item.rankList)) {
            item.rankList.forEach((rankItem: any) => {
              if (rankItem.month) monthSet.add(rankItem.month);
            });
          }
        });

        monthList.value = Array.from(monthSet).sort((a, b) => dayjs(b).valueOf() - dayjs(a).valueOf());

        const dataMap = new Map<string, any>();
        result.data.forEach((item: any) => {
          const key = `${item.logistic}_${item.cdcWarehouse || ''}`;
          if (!dataMap.has(key)) {
            dataMap.set(key, { key, logistic: item.logistic || '', warehouse: item.cdcWarehouse || '' });
          }
          if (item.rankList && Array.isArray(item.rankList)) {
            item.rankList.forEach((rankItem: any) => {
              const month = rankItem.month;
              if (month) {
                const row = dataMap.get(key);
                if (row) {
                  row[`${month}_rank`] = rankItem.rank !== undefined ? rankItem.rank : null;
                  row[`${month}_totalScore`] = rankItem.totalScore !== undefined ? rankItem.totalScore : null;
                  row[`${month}_hasReward`] = rankItem.hasReward !== undefined ? rankItem.hasReward : null;
                  row[`${month}_hasPunish`] = rankItem.hasPunish !== undefined ? rankItem.hasPunish : null;
                  row[`${month}_hasComplaint`] = rankItem.hasFakeInfoOrComplaint !== undefined ? rankItem.hasFakeInfoOrComplaint : null;
                }
              }
            });
          }
        });
        tableData.value = Array.from(dataMap.values());
      } else {
        tableData.value = [];
        monthList.value = [];
      }
    } else {
      message.error(result?.msg || '获取数据失败');
      tableData.value = [];
      monthList.value = [];
    }
  } catch (error) {
    console.error('获取排名数据失败:', error);
    message.error('获取数据失败');
    tableData.value = [];
  } finally {
    loading.value = false;
  }
};

watch(dateRange, () => { fetchRankData(); }, { deep: true });

const calculateTableScrollY = () => {
  nextTick(() => {
    if (tableSectionRef.value) {
      const containerHeight = tableSectionRef.value.clientHeight;
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 200;
      tableScrollY.value = calculatedHeight;
    }
  });
};

const calculateModalTableScrollY = () => {
  nextTick(() => {
    if (modalTableSectionRef.value) {
      const containerHeight = modalTableSectionRef.value.clientHeight;
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 200;
      modalTableScrollY.value = calculatedHeight;
    }
  });
};

const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (target.closest('.custom-modal')) return;
  if (!target.closest('.dropdown-item') && !target.closest('.dropdown-content')) {
    if (isLogisticProviderOpen.value || isCdcWarehouseOpen.value) {
      closeAllDropdowns();
      fetchRankData();
    }
  }
};

onMounted(async () => {
  await selectOptionsStore.fetchLogisticsByBizType('1');
  await selectOptionsStore.fetchWarehouseByBizType('1');
  await fetchRankData();
  document.addEventListener('click', handleClickOutside);
  calculateTableScrollY();
  window.addEventListener('resize', calculateTableScrollY);
  window.addEventListener('resize', calculateModalTableScrollY);
  if (tableSectionRef.value) {
    const resizeObserver = new ResizeObserver(() => { calculateTableScrollY(); });
    resizeObserver.observe(tableSectionRef.value);
    (tableSectionRef.value as any)._resizeObserver = resizeObserver;
  }
  watch(modalVisible, (newVal) => {
    if (newVal) {
      nextTick(() => {
        calculateModalTableScrollY();
        if (modalTableSectionRef.value) {
          const resizeObserver = new ResizeObserver(() => { calculateModalTableScrollY(); });
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
});

const fetchDetailData = async () => {
  if (!modalDateRange.value || !modalDateRange.value[0] || !modalDateRange.value[1]) return;

  const requestId = ++detailFetchRequestId;
  modalLoading.value = true;
  detailTableData.value = [];
  scoreTableData.value = [];
  rewardTableData.value = [];

  const isStale = () => requestId !== detailFetchRequestId;

  try {
    const baseParams = {
      startDate: modalDateRange.value[0].format('YYYY-MM'),
      endDate: modalDateRange.value[1].format('YYYY-MM'),
      logisticName: modalSelectedLogisticProvider.value.length > 0 ? modalSelectedLogisticProvider.value : selectedLogisticProvider.value || [],
      cdcWarehouse: modalSelectedCdcWarehouse.value.length > 0 ? modalSelectedCdcWarehouse.value : selectedCdcWarehouse.value || [],
    };

    if (activeTab.value === 'score') {
      const params = { ...baseParams, customer: [] as string[], transType: [] as string[] };
      const result = await queryToBKpiRankDetail(params);
      if (isStale()) return;

      if (result && result.code === 200 && result.data) {
        if (Array.isArray(result.data)) {
          const scoreData: any[] = [];
          const kpiTypeMap: { [key: number]: string } = {
            1: 'deliveryOnTimeScore',
            2: 'inboundOnTimeScore',
            3: 'stdComplianceScore',
            4: 'inventoryAccuracyScore',
            5: 'operationAccuracyScore',
          };

          result.data.forEach((item: any) => {
            const key = `${item.logistic || ''}_${item.cdcWarehouse || ''}_${item.month || ''}`;
            const scoreRow: any = {
              key,
              yearMonth: item.month || '',
              logistic: item.logistic || '',
              warehouse: item.cdcWarehouse || '',
              totalScore: item.totalScore !== undefined ? item.totalScore : null,
              deliveryOnTimeScore: null,
              inboundOnTimeScore: null,
              stdComplianceScore: null,
              inventoryAccuracyScore: null,
              operationAccuracyScore: null,
              kpiScore: item.kpiScore !== undefined ? item.kpiScore : null,
              redLineIssue: item.redLineIssue !== undefined ? item.redLineIssue : null,
              majorIssue: item.majorIssue !== undefined ? item.majorIssue : null,
              seriousIssue: item.seriousIssue !== undefined ? item.seriousIssue : null,
              minorIssue: item.minorIssue !== undefined ? item.minorIssue : null,
              issueDescription: item.deductionDesc || '-',
              bonusDeductionTotal: null,
            };

            const redLine = scoreRow.redLineIssue ?? 0;
            const major = scoreRow.majorIssue ?? 0;
            const serious = scoreRow.seriousIssue ?? 0;
            const minor = scoreRow.minorIssue ?? 0;
            scoreRow.bonusDeductionTotal = redLine + major + serious + minor;

            if (item.kpi && Array.isArray(item.kpi)) {
              item.kpi.forEach((kpiItem: any) => {
                const kpiType = kpiItem.kpiType;
                const fieldName = kpiTypeMap[kpiType];
                if (fieldName && kpiItem.score !== undefined && kpiItem.score !== null) {
                  scoreRow[fieldName] = kpiItem.score;
                }
              });
            }
            scoreData.push(scoreRow);
          });
          scoreTableData.value = scoreData;
          detailTableData.value = scoreData;
        } else {
          scoreTableData.value = [];
          detailTableData.value = [];
        }
      } else {
        message.error(result?.msg || '获取得分详情数据失败');
        scoreTableData.value = [];
        detailTableData.value = [];
      }
    } else {
      const result = await queryToBLogisticPunishInfo(baseParams);
      if (isStale()) return;

      if (result && result.code === 200 && result.data) {
        if (Array.isArray(result.data)) {
          const rewardData: any[] = [];
          result.data.forEach((item: any) => {
            const key = `${item.logistic || ''}_${item.warehouse || ''}_${item.month || ''}`;
            rewardData.push({
              key,
              yearMonth: item.month || '',
              logistic: item.logistic || '',
              warehouse: item.warehouse || '',
              redLineIssue: item.redLineIssue !== undefined ? item.redLineIssue : null,
              majorIssue: item.majorIssue !== undefined ? item.majorIssue : null,
              seriousIssue: item.seriousIssue !== undefined ? item.seriousIssue : null,
              minorIssue: item.minorIssue !== undefined ? item.minorIssue : null,
              breachHandling: item.breachAmount !== undefined ? item.breachAmount : null,
              totalPenalty: item.deductionAmount !== undefined ? item.deductionAmount : null,
              rewardAmount: item.rewardAmount !== undefined ? item.rewardAmount : null,
              remarkReason: item.remarkReason || '-',
              totalScore: item.totalScore !== undefined ? item.totalScore : null,
              avgMonthlyShipVolume: item.avgMonthlyShipVolume !== undefined ? item.avgMonthlyShipVolume : null,
              standardBreachAmount: item.standardBreachAmount !== undefined ? item.standardBreachAmount : null,
              breachCoefficient: item.breachCoefficient || '-',
              hasReward: item.hasReward !== undefined ? (item.hasReward ? '是' : '否') : '-',
            });
          });
          rewardTableData.value = rewardData;
          detailTableData.value = rewardData;
        } else {
          rewardTableData.value = [];
          detailTableData.value = [];
        }
      } else {
        message.error(result?.msg || '获取奖惩详情数据失败');
        rewardTableData.value = [];
        detailTableData.value = [];
      }
    }
  } catch (error) {
    if (isStale()) return;
    console.error('获取详情数据失败:', error);
    message.error('获取详情数据失败');
    scoreTableData.value = [];
    rewardTableData.value = [];
    detailTableData.value = [];
  } finally {
    if (requestId === detailFetchRequestId) {
      modalLoading.value = false;
    }
  }
};

const modalFilteredLogisticProviderOptions = computed(() => {
  let filtered: { code: string; name: string }[] = [];
  if (!modalLogisticProviderSearch.value.trim()) {
    filtered = logisticProviderOptions.value;
  } else {
    const searchLower = modalLogisticProviderSearch.value.toLowerCase();
    filtered = logisticProviderOptions.value.filter((option: { code: string; name: string }) =>
      option.name.toLowerCase().includes(searchLower)
    );
  }
  return [{ code: '__reset__', name: '重置' }, ...filtered];
});

const modalFilteredCdcWarehouseOptions = computed(() => {
  let filtered: { code: string; name: string }[] = [];
  if (!modalCdcWarehouseSearch.value.trim()) {
    filtered = cdcWarehouseOptions.value;
  } else {
    const searchLower = modalCdcWarehouseSearch.value.toLowerCase();
    filtered = cdcWarehouseOptions.value.filter((option: { code: string; name: string }) =>
      option.name.toLowerCase().includes(searchLower)
    );
  }
  return [{ code: '__reset__', name: '重置' }, ...filtered];
});

const modalSelectedLogisticProviderText = computed(() => {
  if (modalSelectedLogisticProvider.value.length === 0) return '物流商';
  const names = modalSelectedLogisticProvider.value.map(code => {
    const option = logisticProviderOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const modalSelectedCdcWarehouseText = computed(() => {
  if (modalSelectedCdcWarehouse.value.length === 0) return 'CDC仓库';
  const names = modalSelectedCdcWarehouse.value.map(code => {
    const option = cdcWarehouseOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const modalToggleLogisticProviderDropdown = () => {
  modalIsCdcWarehouseOpen.value = false;
  modalIsLogisticProviderOpen.value = !modalIsLogisticProviderOpen.value;
  if (modalIsLogisticProviderOpen.value) modalLogisticProviderSearch.value = '';
};

const modalToggleCdcWarehouseDropdown = () => {
  modalIsLogisticProviderOpen.value = false;
  modalIsCdcWarehouseOpen.value = !modalIsCdcWarehouseOpen.value;
  if (modalIsCdcWarehouseOpen.value) modalCdcWarehouseSearch.value = '';
};

const modalSelectLogisticProvider = (code: string) => {
  if (code === '__reset__') {
    modalSelectedLogisticProvider.value = [];
    modalLogisticProviderSearch.value = '';
    return;
  }
  const index = modalSelectedLogisticProvider.value.indexOf(code);
  if (index > -1) modalSelectedLogisticProvider.value.splice(index, 1);
  else modalSelectedLogisticProvider.value.push(code);
};

const modalSelectCdcWarehouse = (code: string) => {
  if (code === '__reset__') {
    modalSelectedCdcWarehouse.value = [];
    modalCdcWarehouseSearch.value = '';
    return;
  }
  const index = modalSelectedCdcWarehouse.value.indexOf(code);
  if (index > -1) modalSelectedCdcWarehouse.value.splice(index, 1);
  else modalSelectedCdcWarehouse.value.push(code);
};

const closeAllModalDropdowns = () => {
  modalIsLogisticProviderOpen.value = false;
  modalIsCdcWarehouseOpen.value = false;
  modalLogisticProviderSearch.value = '';
  modalCdcWarehouseSearch.value = '';
};

const showDetailModal = () => {
  modalVisible.value = true;
  activeTab.value = 'score';
  modalSelectedLogisticProvider.value = [...selectedLogisticProvider.value];
  modalSelectedCdcWarehouse.value = [...selectedCdcWarehouse.value];
  modalDateRange.value = [dateRange.value[0], dateRange.value[1]];
  modalLogisticProviderSearch.value = '';
  modalCdcWarehouseSearch.value = '';
  modalIsLogisticProviderOpen.value = false;
  modalIsCdcWarehouseOpen.value = false;
  nextTick(() => { calculateModalTableScrollY(); });
  fetchDetailData();
};

const handleModalClose = () => {
  detailFetchRequestId += 1;
  modalVisible.value = false;
  modalLoading.value = false;
  scoreTableData.value = [];
  rewardTableData.value = [];
  detailTableData.value = [];
};

const handleModalReset = () => {
  modalSelectedLogisticProvider.value = [];
  modalSelectedCdcWarehouse.value = [];
  modalLogisticProviderSearch.value = '';
  modalCdcWarehouseSearch.value = '';
  closeAllModalDropdowns();
  modalDateRange.value = getInitialDateRange();
  fetchDetailData();
};

const handleTabChange = (key: string) => {
  activeTab.value = key as 'score' | 'reward';
  modalSelectedLogisticProvider.value = [];
  modalSelectedCdcWarehouse.value = [];
  modalLogisticProviderSearch.value = '';
  modalCdcWarehouseSearch.value = '';
  closeAllModalDropdowns();
  modalDateRange.value = getInitialDateRange();
  fetchDetailData();
};

const handleExport = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
    message.warning('请选择日期范围');
    return;
  }
  try {
    exportLoading.value = true;
    const params = {
      startDate: dateRange.value[0].format('YYYY-MM'),
      endDate: dateRange.value[1].format('YYYY-MM'),
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
      transType: [] as string[],
    };
    const result = await exportToBLogisticKpiRank(params);
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : `ToB物流商KPI排名_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`;
        link.download = downloadFilename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('导出成功');
      }
    } else {
      message.error(result?.message || '导出失败');
    }
  } catch (error: any) {
    const errCode = error?.code || error?.response?.status;
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || '导出数据量过大，请缩小查询范围');
    } else {
      message.error(error.msg || '导出失败');
    }
  } finally {
    exportLoading.value = false;
  }
};

const handleModalExport = async () => {
  if (!modalDateRange.value || !modalDateRange.value[0] || !modalDateRange.value[1]) {
    message.warning('请选择日期范围');
    return;
  }
  try {
    exportLoading.value = true;
    const params = {
      startDate: modalDateRange.value[0].format('YYYY-MM'),
      endDate: modalDateRange.value[1].format('YYYY-MM'),
      logisticName: modalSelectedLogisticProvider.value || [],
      cdcWarehouse: modalSelectedCdcWarehouse.value || [],
      customer: [] as string[],
      transType: [] as string[],
    };
    let result;
    let defaultFilename = '';
    if (activeTab.value === 'score') {
      result = await exportToBLogisticKpiRankScoreDetail(params);
      defaultFilename = `ToB物流商KPI排名得分详情_${modalDateRange.value[0].format('YYYY-MM')}_${modalDateRange.value[1].format('YYYY-MM')}.xlsx`;
    } else {
      result = await exportToBLogisticKpiRankPunishDetail(params);
      defaultFilename = `ToB物流商KPI排名奖惩详情_${modalDateRange.value[0].format('YYYY-MM')}_${modalDateRange.value[1].format('YYYY-MM')}.xlsx`;
    }
    if (result && result.code === 200) {
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : defaultFilename;
        link.download = downloadFilename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('导出成功');
      }
    } else {
      message.error(result?.message || '导出失败');
    }
  } catch (error: any) {
    const errCode = error?.code || error?.response?.status;
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || '导出数据量过大，请缩小查询范围');
    } else {
      message.error(error.msg || '导出失败');
    }
  } finally {
    exportLoading.value = false;
  }
};

const formatYearMonth = (text: string) => {
  if (!text) return '-';
  if (text === '汇总') return '汇总';
  if (text === '0000-00' || text.startsWith('0000')) return '0000年00月';
  const parts = text.split('-');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${parts[0]}年${parseInt(parts[1])}月`;
  }
  return text;
};

const scoreTableColumns = [
  { title: '年月', key: 'yearMonth', dataIndex: 'yearMonth', width: 100, align: 'center' as const, customRender: ({ text }: { text: string }) => formatYearMonth(text) },
  { title: '物流商', key: 'logistic', dataIndex: 'logistic', width: 120, align: 'center' as const },
  { title: '仓库', key: 'warehouse', dataIndex: 'warehouse', width: 120, align: 'center' as const },
  { title: '总成绩', key: 'totalScore', dataIndex: 'totalScore', width: 100, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '发货及时率得分(满分: 50)', key: 'deliveryOnTimeScore', dataIndex: 'deliveryOnTimeScore', width: 190, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '入库及时率得分(满分: 20)', key: 'inboundOnTimeScore', dataIndex: 'inboundOnTimeScore', width: 180, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '仓储STD达标率得分(满分: 10)', key: 'stdComplianceScore', dataIndex: 'stdComplianceScore', width: 200, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '库存准确率得分(满分: 10)', key: 'inventoryAccuracyScore', dataIndex: 'inventoryAccuracyScore', width: 180, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '运作准确率得分(满分: 10)', key: 'operationAccuracyScore', dataIndex: 'operationAccuracyScore', width: 190, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '得分汇总', key: 'kpiScore', dataIndex: 'kpiScore', width: 120, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '红线问题', key: 'redLineIssue', dataIndex: 'redLineIssue', width: 100, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '重大问题', key: 'majorIssue', dataIndex: 'majorIssue', width: 100, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '严重问题', key: 'seriousIssue', dataIndex: 'seriousIssue', width: 100, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '一般问题', key: 'minorIssue', dataIndex: 'minorIssue', width: 100, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '问题描述', key: 'issueDescription', dataIndex: 'issueDescription', width: 240, align: 'center' as const },
  { title: '加分/扣分合计', key: 'bonusDeductionTotal', dataIndex: 'bonusDeductionTotal', width: 140, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
];

const rewardTableColumns = computed(() => [
  { title: '年月', key: 'yearMonth', dataIndex: 'yearMonth', width: 100, align: 'center' as const, customRender: ({ text }: { text: string }) => formatYearMonth(text) },
  { title: '物流商', key: 'logistic', dataIndex: 'logistic', width: 120, align: 'center' as const },
  { title: '仓库', key: 'warehouse', dataIndex: 'warehouse', width: 120, align: 'center' as const },
  { title: '红线问题(元)', key: 'redLineIssue', dataIndex: 'redLineIssue', width: 140, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '重大问题(元)', key: 'majorIssue', dataIndex: 'majorIssue', width: 140, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '严重问题(元)', key: 'seriousIssue', dataIndex: 'seriousIssue', width: 140, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '一般问题(元)', key: 'minorIssue', dataIndex: 'minorIssue', width: 140, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '违约处理(元)', key: 'breachHandling', dataIndex: 'breachHandling', width: 140, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '总罚款金额(元)', key: 'totalPenalty', dataIndex: 'totalPenalty', width: 160, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '奖励金额(元)', key: 'rewardAmount', dataIndex: 'rewardAmount', width: 140, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '备注原因', key: 'remarkReason', dataIndex: 'remarkReason', width: 240, align: 'center' as const },
  { title: '总成绩', key: 'totalScore', dataIndex: 'totalScore', width: 100, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '月均发货体积(单位:m³)', key: 'avgMonthlyShipVolume', dataIndex: 'avgMonthlyShipVolume', width: 180, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '标准违约金(元)', key: 'standardBreachAmount', dataIndex: 'standardBreachAmount', width: 160, align: 'center' as const, customRender: ({ text }: { text: number | null }) => text !== null && text !== undefined ? String(text) : '-' },
  { title: '违约系数', key: 'breachCoefficient', dataIndex: 'breachCoefficient', width: 120, align: 'center' as const },
  { title: '考核结果是否奖励', key: 'hasReward', dataIndex: 'hasReward', width: 160, align: 'center' as const },
]);

const handleModalBodyClick = (event: Event) => {
  const target = event.target as HTMLElement;
  const isClickInsideDropdown =
    target.closest('.dropdown-group') ||
    target.closest('.dropdown-item') ||
    target.closest('.dropdown-content') ||
    target.closest('.search-input') ||
    target.closest('.dropdown-option') ||
    target.closest('.ant-picker') ||
    target.closest('.date-range-picker');
  if (!isClickInsideDropdown) {
    closeAllModalDropdowns();
  }
};

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', calculateTableScrollY);
  window.removeEventListener('resize', calculateModalTableScrollY);
  if (tableSectionRef.value && (tableSectionRef.value as any)._resizeObserver) {
    (tableSectionRef.value as any)._resizeObserver.disconnect();
  }
  if (modalTableSectionRef.value && (modalTableSectionRef.value as any)._resizeObserver) {
    (modalTableSectionRef.value as any)._resizeObserver.disconnect();
  }
});
</script>

<template>
  <div class="rank-container">
    <div class="header-bar">
      <h2 class="header-title">ToB物流商KPI排名</h2>
    </div>
    <!-- 控制面板 -->
    <div class="control-panel">
      <div class="filter-group">
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
              <div v-if="filteredLogisticProviderOptions.length === 1 && logisticProviderSearch" class="no-results">暂无搜索结果</div>
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
              <div v-if="filteredCdcWarehouseOptions.length === 1 && cdcWarehouseSearch" class="no-results">暂无搜索结果</div>
            </div>
          </div>
        </div>
      </div>
      <div class="action-buttons">
        <a-button type="primary" @click="showDetailModal" class="action-btn">查看详情</a-button>
        <a-button @click="handleExport" class="action-btn" :loading="exportLoading">导出</a-button>
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

    <!-- 详情弹窗 -->
    <Teleport to="body">
      <div v-if="modalVisible" class="custom-modal-overlay">
        <div class="custom-modal">
          <div class="modal-header">
            <div class="header-striped-bg"></div>
            <h3 class="modal-title">{{ modalTitle }}</h3>
            <button class="close-btn" @click="handleModalClose">×</button>
          </div>
          <div class="modal-body" @click="handleModalBodyClick">
            <div class="tabs-container">
              <div class="tab-item" :class="{ active: activeTab === 'score' }" @click="handleTabChange('score')">得分详情</div>
              <div class="tab-item" :class="{ active: activeTab === 'reward' }" @click="handleTabChange('reward')">奖惩详情</div>
            </div>
            <div class="search-section">
              <div class="search-row">
                <div class="search-item">
                  <div class="date-range-item" @click.stop>
                    <a-range-picker
                      v-model:value="modalDateRange"
                      picker="month"
                      format="YYYY-MM"
                      separator="至"
                      :placeholder="['开始月份', '结束月份']"
                      class="date-range-picker"
                      @click.stop
                    />
                  </div>
                </div>
                <div class="search-item">
                  <div class="dropdown-group">
                    <div class="dropdown-item" @click.stop="modalToggleLogisticProviderDropdown">
                      <span class="dropdown-text">{{ modalSelectedLogisticProviderText }}</span>
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                      <div class="dropdown-content" v-show="modalIsLogisticProviderOpen" @click.stop>
                        <div class="search-box">
                          <input v-model="modalLogisticProviderSearch" type="text" placeholder="搜索物流商..." class="search-input" @click.stop />
                        </div>
                        <div class="options-list">
                          <div
                            v-for="option in modalFilteredLogisticProviderOptions"
                            :key="option.code"
                            class="dropdown-option"
                            :class="{ 'selected': option.code !== '__reset__' && modalSelectedLogisticProvider.includes(option.code), 'reset-option': option.code === '__reset__' }"
                            @click.stop="modalSelectLogisticProvider(option.code)"
                          >
                            <span class="checkmark" v-if="option.code !== '__reset__' && modalSelectedLogisticProvider.includes(option.code)">✓</span>
                            {{ option.name }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="search-item">
                  <div class="dropdown-group">
                    <div class="dropdown-item" @click.stop="modalToggleCdcWarehouseDropdown">
                      <span class="dropdown-text">{{ modalSelectedCdcWarehouseText }}</span>
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                      <div class="dropdown-content" v-show="modalIsCdcWarehouseOpen" @click.stop>
                        <div class="search-box">
                          <input v-model="modalCdcWarehouseSearch" type="text" placeholder="搜索CDC仓库..." class="search-input" @click.stop />
                        </div>
                        <div class="options-list">
                          <div
                            v-for="option in modalFilteredCdcWarehouseOptions"
                            :key="option.code"
                            class="dropdown-option"
                            :class="{ 'selected': option.code !== '__reset__' && modalSelectedCdcWarehouse.includes(option.code), 'reset-option': option.code === '__reset__' }"
                            @click.stop="modalSelectCdcWarehouse(option.code)"
                          >
                            <span class="checkmark" v-if="option.code !== '__reset__' && modalSelectedCdcWarehouse.includes(option.code)">✓</span>
                            {{ option.name }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="search-buttons">
                  <a-button @click="handleModalReset" class="reset-btn">重置</a-button>
                  <a-button @click="fetchDetailData" class="searchinfo-btn">查询</a-button>
                  <a-button @click="handleModalExport" class="searchinfo-btn" :loading="exportLoading">导出</a-button>
                </div>
              </div>
            </div>
            <div class="modal-table-section" ref="modalTableSectionRef">
              <a-spin :spinning="modalLoading">
                <a-table
                  :columns="activeTab === 'score' ? scoreTableColumns : rewardTableColumns"
                  :data-source="detailTableData"
                  :pagination="false"
                  size="small"
                  class="custom-table"
                  :scroll="{ x: activeTab === 'score' ? 2000 : 2400, y: modalTableScrollY }"
                />
              </a-spin>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
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

.date-range-item { flex-shrink: 1; }

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
.search-input::placeholder { color: rgba(255, 255, 255, 0.4); }
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
.options-list::-webkit-scrollbar { width: 6px; }
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
.dropdown-option:hover { background: rgba(59, 130, 246, 0.3); }
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
:deep(.ant-table-container) {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  width: 100%;
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}
:deep(.ant-table-container)::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
:deep(.ant-table-container)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}
:deep(.ant-table-container)::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}
:deep(.ant-table-container)::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.5);
}
:deep(.ant-table-container)::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.1);
}
.custom-table :deep(.ant-table-body) {
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}
.custom-table :deep(.ant-table-body::-webkit-scrollbar) {
  width: 4px;
  height: 4px;
}
.custom-table :deep(.ant-table-body::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}
.custom-table :deep(.ant-table-body::-webkit-scrollbar-thumb) {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}
.custom-table :deep(.ant-table-body::-webkit-scrollbar-thumb:hover) {
  background: rgba(74, 158, 255, 0.5);
}
.custom-table :deep(.ant-table-body::-webkit-scrollbar-corner) {
  background: rgba(0, 0, 0, 0.1);
}

/* 弹窗样式 */
.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.custom-modal {
  width: 90vw;
  height: 85vh;
  background: #0a1929;
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
.modal-header {
  position: relative;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.header-striped-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('/dashboard/images/title-bg.png') center/100% 100% no-repeat;
  opacity: 0.5;
}
.modal-title {
  color: white;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  position: relative;
  z-index: 1;
}
.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.5rem;
  cursor: pointer;
  position: relative;
  z-index: 1;
  line-height: 1;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover { color: white; }

.modal-body {
  flex: 1;
  padding: 1rem 1.5rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tabs-container {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  flex-shrink: 0;
}
.tab-item {
  padding: 10px 20px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.3s;
  position: relative;
  top: 1px;
}
.tab-item:hover { color: rgba(255, 255, 255, 0.9); }
.tab-item.active {
  color: #4a9eff;
  border-bottom-color: #4a9eff;
  font-weight: 600;
}

.search-section {
  margin-bottom: 1.25rem;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 0.9375rem;
  flex-wrap: nowrap;
  justify-content: space-between;
}
.search-item {
  flex: 1;
  min-width: 6.25rem;
  max-width: 10rem;
}
.search-item .date-range-picker {
  width: 100%;
  height: 1.8rem;
  min-width: unset;
  max-width: unset;
}
.search-item .dropdown-group .dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  padding: 0.3rem 0.5rem;
  background: #081F40;
  border: 0.0625rem solid #2873CC;
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(0.625rem);
  width: 100%;
  height: 1.8rem;
  min-width: unset;
  max-width: unset;
}
.search-item .dropdown-group .dropdown-item:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}
.search-item .dropdown-group .dropdown-content {
  z-index: 2147483647;
}

.search-buttons {
  display: flex;
  gap: 0.625rem;
  margin-left: auto;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  font-size: 0.7rem;
}
.searchinfo-btn {
  height: 1.6rem;
  background: #2873CC;
  box-shadow: 1px 1px 1px 0px #1E6CC8, inset 0px 1px 1px 0px #C5DFFF;
  border-radius: 2px;
  border: none;
  color: white;
  font-weight: 500;
  transition: all 0.3s;
  font-size: 0.7rem;
  cursor: pointer;
}
.searchinfo-btn:hover { color: white; }
.reset-btn {
  height: 1.6rem;
  background: #2873CC;
  box-shadow: 1px 1px 1px 0px #1E6CC8, inset 0px 1px 1px 0px #C5DFFF;
  border-radius: 2px;
  border: none;
  color: white;
  font-weight: 500;
  transition: all 0.3s;
  font-size: 0.7rem;
  cursor: pointer;
}
.reset-btn:hover { color: white; }

.modal-table-section {
  flex: 1;
  overflow: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.3);
}
.modal-table-section::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.modal-table-section::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}
.modal-table-section::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
}
.modal-table-section::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(74, 158, 255, 0.8) 100%);
  border-color: rgba(59, 130, 246, 0.5);
}
.modal-table-section::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.3);
}
.modal-table-section :deep(.ant-spin-nested-loading) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.modal-table-section :deep(.ant-spin-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.modal-table-section :deep(.ant-table-wrapper) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.modal-table-section :deep(.ant-table-thead > tr > th) {
  background: rgba(74, 158, 255, 0.1);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  color: white;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap !important;
  word-wrap: normal;
  word-break: normal;
  line-height: 1.4;
  padding: 0.75rem 0.5rem;
}
.modal-table-section :deep(.ant-table-tbody > tr > td) {
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  color: white;
  font-size: 13px;
  white-space: nowrap !important;
}
.modal-table-section :deep(.ant-table table) {
  table-layout: fixed;
}
.modal-table-section :deep(.ant-table-body) {
  height: auto;
  overflow: visible;
}
.modal-table-section :deep(.ant-table-content) {
  overflow-x: auto;
  overflow-y: auto;
}
.modal-table-section :deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(74, 158, 255, 0.1);
}
.modal-table-section :deep(.ant-table-tbody > tr:nth-child(even) > td) {
  background: rgba(255, 255, 255, 0.02);
}
.modal-table-section :deep(.ant-table-container) {
  overflow-x: auto !important;
  overflow-y: auto !important;
  min-width: 0;
  min-height: 0;
  width: 100%;
  scrollbar-gutter: stable;
  padding-right: 2px;
  padding-bottom: 2px;
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.3);
}
.modal-table-section :deep(.ant-table-container)::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.modal-table-section :deep(.ant-table-container)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}
.modal-table-section :deep(.ant-table-container)::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
}
.modal-table-section :deep(.ant-table-container)::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(74, 158, 255, 0.8) 100%);
  border-color: rgba(59, 130, 246, 0.5);
}
.modal-table-section :deep(.ant-table-container)::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.3);
}
</style>
