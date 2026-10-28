<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, Teleport } from 'vue';
import { useI18n } from 'vue-i18n';
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore';
import { useDashboardDataStore } from '../../../stores/dashboardDataStore';
import { queryTransKpiRank, queryTransKpiRankDetail, queryTransTypeList, queryTransLogisticPunishInfo, exportTransLogisticKpiRank, exportTransLogisticKpiRankScoreDetail, exportTransLogisticKpiRankPunishDetail } from '../../../services/transportApi';

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>();

const selectOptionsStore = useSelectOptionsStore();
const dataStore = useDashboardDataStore();
const { t } = useI18n();

const formatMonthLabel = (month: string): string => {
  if (month === '0000-00' || !month || month.startsWith('0000')) {
    return t('dashboard.transportationLogisticsRank.monthFormat00');
  }
  const d = dayjs(month);
  return d.format(t('dashboard.transportationLogisticsRank.monthFormat'));
};

const renderYesNo = (text: boolean | null): string => {
  if (text === true) return t('dashboard.transportationLogisticsRank.yes');
  if (text === false) return t('dashboard.transportationLogisticsRank.no');
  return '-';
};

const renderYesNoText = (val: any): string => {
  if (val === undefined || val === null) return '-';
  return val ? t('dashboard.transportationLogisticsRank.yes') : t('dashboard.transportationLogisticsRank.no');
};

const getInitialDateRange = (): [Dayjs, Dayjs] => {
  const now = dayjs();
  const startDate = now.subtract(3, 'month').startOf('month');
  const endDate = now.subtract(1, 'month').endOf('month');
  return [startDate, endDate];
};

const dateRange = ref<[Dayjs, Dayjs]>(getInitialDateRange());
const selectedTransType = ref<string[]>([]);
const selectedLogisticProvider = ref<string[]>([]);
const selectedCdcWarehouse = ref<string[]>([]);

const bizType = '2';

const logisticProviderOptions = computed(() => selectOptionsStore.getLogisticsByBizType(bizType));
const cdcWarehouseOptions = computed(() => selectOptionsStore.getWarehouseByBizType(bizType));
const transTypeOptions = ref<{ code: string; name: string }[]>([]);

const transTypeSearch = ref('');
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
  return [{ code: '__reset__', name: t('dashboard.transportationLogisticsRank.reset') }, ...filtered];
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
  return [{ code: '__reset__', name: t('dashboard.transportationLogisticsRank.reset') }, ...filtered];
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
  return [{ code: '__reset__', name: t('dashboard.transportationLogisticsRank.reset') }, ...filtered];
});

const isTransTypeOpen = ref(false);
const isLogisticProviderOpen = ref(false);
const isCdcWarehouseOpen = ref(false);

const tableData = ref<any[]>([]);
const loading = ref(false);
const exportLoading = ref(false);

const modalVisible = ref(false);
const activeTab = ref<'score' | 'reward'>('score');
const modalLoading = ref(false);

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
  if (selectedLogisticProvider.value.length === 0) return t('dashboard.transportationLogisticsRank.logisticProvider');
  const names = selectedLogisticProvider.value.map(code => {
    const option = logisticProviderOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const selectedCdcWarehouseText = computed(() => {
  if (selectedCdcWarehouse.value.length === 0) return t('dashboard.transportationLogisticsRank.cdcWarehouse');
  const names = selectedCdcWarehouse.value.map(code => {
    const option = cdcWarehouseOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const selectedTransTypeText = computed(() => {
  if (selectedTransType.value.length === 0) return t('dashboard.transportationLogisticsRank.transType');
  const names = selectedTransType.value.map(code => {
    const option = transTypeOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const toggleTransTypeDropdown = () => {
  if (isTransTypeOpen.value) {
    isTransTypeOpen.value = false;
    transTypeSearch.value = '';
    fetchRankData();
  } else {
    closeAllDropdowns();
    isTransTypeOpen.value = true;
    transTypeSearch.value = '';
  }
};

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
  isTransTypeOpen.value = false;
  isLogisticProviderOpen.value = false;
  isCdcWarehouseOpen.value = false;
  transTypeSearch.value = '';
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

const monthList = ref<string[]>([]);

const tableColumns = computed(() => {
  const baseColumns = [
    {
      title: t('dashboard.transportationLogisticsRank.transType'),
      key: 'transType',
      dataIndex: 'transType',
      width: 120,
      align: 'center' as const,
    },
    {
      title: t('dashboard.transportationLogisticsRank.logisticProvider'),
      key: 'logistic',
      dataIndex: 'logistic',
      width: 120,
      align: 'center' as const,
    },
    {
      title: t('dashboard.transportationLogisticsRank.warehouse'),
      key: 'warehouse',
      dataIndex: 'warehouse',
      width: 120,
      align: 'center' as const,
    },
  ];

  const monthColumns: any[] = [];
  const sortedMonths = [...monthList.value].sort((a, b) => {
    return dayjs(b).valueOf() - dayjs(a).valueOf();
  });

  sortedMonths.forEach((month) => {
    const monthLabel = formatMonthLabel(month);

    monthColumns.push({
      title: monthLabel,
      key: `month_${month}_performance`,
      align: 'center' as const,
      children: [
        {
          title: t('dashboard.transportationLogisticsRank.rank'),
          key: `${month}_rank`,
          dataIndex: `${month}_rank`,
          width: 80,
          align: 'center' as const,
        },
        {
          title: t('dashboard.transportationLogisticsRank.totalScore'),
          key: `${month}_totalScore`,
          dataIndex: `${month}_totalScore`,
          width: 100,
          align: 'center' as const,
        },
      ],
    });
  });

  sortedMonths.forEach((month) => {
    const monthLabel = month === '0000-00' || !month || month.startsWith('0000') ? '-' : formatMonthLabel(month);

    monthColumns.push({
      title: monthLabel,
      key: `month_${month}_reward`,
      align: 'center' as const,
      children: [
        {
          title: t('dashboard.transportationLogisticsRank.hasReward'),
          key: `${month}_hasReward`,
          dataIndex: `${month}_hasReward`,
          width: 120,
          align: 'center' as const,
          customRender: ({ text }: { text: boolean | null }) => renderYesNo(text),
        },
        {
          title: t('dashboard.transportationLogisticsRank.redLineMajorSerious'),
          key: `${month}_hasPunish`,
          dataIndex: `${month}_hasPunish`,
          width: 150,
          align: 'center' as const,
          customRender: ({ text }: { text: boolean | null }) => renderYesNo(text),
        },
      ],
    });
  });

  return [...baseColumns, ...monthColumns];
});

const fetchRankData = async () => {
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
      transType: selectedTransType.value || [],
    };

    const result = await queryTransKpiRank(params);

    if (result && result.code === 200 && result.data) {
      dataStore.updateModuleData('transportationLogisticsRank', result.data)
      if (Array.isArray(result.data)) {
        const monthSet = new Set<string>();

        result.data.forEach((item: any) => {
          if (item.rankList && Array.isArray(item.rankList)) {
            item.rankList.forEach((rankItem: any) => {
              if (rankItem.month) {
                monthSet.add(rankItem.month);
              }
            });
          }
        });

        monthList.value = Array.from(monthSet).sort((a, b) => {
          return dayjs(b).valueOf() - dayjs(a).valueOf();
        });

        const dataMap = new Map<string, any>();

        result.data.forEach((item: any) => {
          const key = `${item.transType || ''}_${item.logistic || ''}_${item.cdcWarehouse || ''}`;

          if (!dataMap.has(key)) {
            dataMap.set(key, {
              key,
              transType: item.transType || '',
              logistic: item.logistic || '',
              warehouse: item.cdcWarehouse || '',
            });
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
      message.error(result?.msg || t('dashboard.transportationLogisticsRank.fetchDataFailed'));
      tableData.value = [];
      monthList.value = [];
    }
  } catch (error) {
    console.error('fetchRankData:', error);
    message.error(t('dashboard.transportationLogisticsRank.fetchDataFailed'));
    tableData.value = [];
  } finally {
    loading.value = false;
  }
};

watch(dateRange, () => {
  fetchRankData();
}, { deep: true });

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
  if (target.closest('.custom-modal')) {
    return;
  }
  if (!target.closest('.dropdown-item') && !target.closest('.dropdown-content')) {
    if (isTransTypeOpen.value || isLogisticProviderOpen.value || isCdcWarehouseOpen.value) {
      closeAllDropdowns();
      fetchRankData();
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
    console.error('fetchTransTypeList:', error);
    message.error(t('dashboard.transportationLogisticsRank.fetchTransTypeListFailed'));
  }
};

onMounted(async () => {
  await selectOptionsStore.fetchLogisticsByBizType('2');
  await selectOptionsStore.fetchWarehouseByBizType('2');
  await fetchTransTypeList();
  await fetchRankData();
  document.addEventListener('click', handleClickOutside);

  calculateTableScrollY();

  window.addEventListener('resize', calculateTableScrollY);
  window.addEventListener('resize', calculateModalTableScrollY);

  if (tableSectionRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      calculateTableScrollY();
    });
    resizeObserver.observe(tableSectionRef.value);
    (tableSectionRef.value as any)._resizeObserver = resizeObserver;
  }

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
});

const fetchDetailData = async () => {
  if (!modalDateRange.value || !modalDateRange.value[0] || !modalDateRange.value[1]) {
    return;
  }

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
      const params = {
        ...baseParams,
        customer: [] as string[],
        transType: [] as string[],
      };

      const result = await queryTransKpiRankDetail(params);
      if (isStale()) return;

      if (result && result.code === 200 && result.data) {
        if (Array.isArray(result.data)) {
          const scoreData: any[] = [];

          const kpiTypeMap: { [key: number]: string } = {
            6: 'trunkLineOnTimeScore',
            7: 'pickupTimelinessScore',
            8: 'trunkLineDamageScore',
            9: 'abnormalOrderProcessingScore',
            10: 'infoFeedbackTimelinessScore',
            11: 'returnOrderTimelinessScore',
            5: 'operationAccuracyScore',
          };

          result.data.forEach((item: any) => {
            const key = `${item.transType || ''}_${item.logistic || ''}_${item.cdcWarehouse || ''}_${item.month || ''}`;

            const scoreRow: any = {
              key,
              yearMonth: item.month || '',
              transType: item.transType || '',
              logistic: item.logistic || '',
              warehouse: item.cdcWarehouse || '',
              totalScore: item.totalScore !== undefined ? item.totalScore : null,
              trunkLineOnTimeScore: null,
              pickupTimelinessScore: null,
              trunkLineDamageScore: null,
              abnormalOrderProcessingScore: null,
              infoFeedbackTimelinessScore: null,
              returnOrderTimelinessScore: null,
              operationAccuracyScore: null,
              kpiScore: item.kpiScore !== undefined ? item.kpiScore : null,
              redLineIssue: item.redLineIssue !== undefined ? item.redLineIssue : null,
              majorIssue: item.majorIssue !== undefined ? item.majorIssue : null,
              seriousIssue: item.seriousIssue !== undefined ? item.seriousIssue : null,
              minorIssue: item.minorIssue !== undefined ? item.minorIssue : null,
              issueDescription: item.deductionDesc || '-',
              bonusDeductionTotal: null,
            };

            const redLine = scoreRow.redLineIssue !== null && scoreRow.redLineIssue !== undefined ? scoreRow.redLineIssue : 0;
            const major = scoreRow.majorIssue !== null && scoreRow.majorIssue !== undefined ? scoreRow.majorIssue : 0;
            const serious = scoreRow.seriousIssue !== null && scoreRow.seriousIssue !== undefined ? scoreRow.seriousIssue : 0;
            const minor = scoreRow.minorIssue !== null && scoreRow.minorIssue !== undefined ? scoreRow.minorIssue : 0;
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
        message.error(result?.msg || t('dashboard.transportationLogisticsRank.fetchScoreDetailFailed'));
        scoreTableData.value = [];
        detailTableData.value = [];
      }
    } else {
      const params = {
        ...baseParams,
        customer: [] as string[],
        transType: [] as string[],
      };

      const result = await queryTransLogisticPunishInfo(params);
      if (isStale()) return;

      if (result && result.code === 200 && result.data) {
        if (Array.isArray(result.data)) {
          const rewardData: any[] = [];

          result.data.forEach((item: any) => {
            const key = `${item.transType || ''}_${item.logistic || ''}_${item.warehouse || ''}_${item.month || ''}`;

            rewardData.push({
              key,
              yearMonth: item.month || '',
              transType: item.transType || '',
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
              hasReward: item.hasReward !== undefined ? renderYesNoText(item.hasReward) : '-',
            });
          });

          rewardTableData.value = rewardData;
          detailTableData.value = rewardData;
        } else {
          rewardTableData.value = [];
          detailTableData.value = [];
        }
      } else {
        message.error(result?.msg || t('dashboard.transportationLogisticsRank.fetchRewardDetailFailed'));
        rewardTableData.value = [];
        detailTableData.value = [];
      }
    }
  } catch (error) {
    if (isStale()) return;
    console.error('fetchDetailData:', error);
    message.error(t('dashboard.transportationLogisticsRank.fetchDetailFailed'));
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
  return [{ code: '__reset__', name: t('dashboard.transportationLogisticsRank.reset') }, ...filtered];
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
  return [{ code: '__reset__', name: t('dashboard.transportationLogisticsRank.reset') }, ...filtered];
});

const modalSelectedLogisticProviderText = computed(() => {
  if (modalSelectedLogisticProvider.value.length === 0) return t('dashboard.transportationLogisticsRank.logisticProvider');
  const names = modalSelectedLogisticProvider.value.map(code => {
    const option = logisticProviderOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const modalSelectedCdcWarehouseText = computed(() => {
  if (modalSelectedCdcWarehouse.value.length === 0) return t('dashboard.transportationLogisticsRank.cdcWarehouse');
  const names = modalSelectedCdcWarehouse.value.map(code => {
    const option = cdcWarehouseOptions.value.find(item => item.code === code);
    return option ? option.name : code;
  });
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
});

const modalToggleLogisticProviderDropdown = () => {
  modalIsCdcWarehouseOpen.value = false;
  modalIsLogisticProviderOpen.value = !modalIsLogisticProviderOpen.value;
  if (modalIsLogisticProviderOpen.value) {
    modalLogisticProviderSearch.value = '';
  }
};

const modalToggleCdcWarehouseDropdown = () => {
  modalIsLogisticProviderOpen.value = false;
  modalIsCdcWarehouseOpen.value = !modalIsCdcWarehouseOpen.value;
  if (modalIsCdcWarehouseOpen.value) {
    modalCdcWarehouseSearch.value = '';
  }
};

const modalSelectLogisticProvider = (code: string) => {
  if (code === '__reset__') {
    modalSelectedLogisticProvider.value = [];
    modalLogisticProviderSearch.value = '';
    return;
  }
  const index = modalSelectedLogisticProvider.value.indexOf(code);
  if (index > -1) {
    modalSelectedLogisticProvider.value.splice(index, 1);
  } else {
    modalSelectedLogisticProvider.value.push(code);
  }
};

const modalSelectCdcWarehouse = (code: string) => {
  if (code === '__reset__') {
    modalSelectedCdcWarehouse.value = [];
    modalCdcWarehouseSearch.value = '';
    return;
  }
  const index = modalSelectedCdcWarehouse.value.indexOf(code);
  if (index > -1) {
    modalSelectedCdcWarehouse.value.splice(index, 1);
  } else {
    modalSelectedCdcWarehouse.value.push(code);
  }
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

  nextTick(() => {
    calculateModalTableScrollY();
  });

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
  try {
    exportLoading.value = true;

    if (modalVisible.value) {
      if (!modalDateRange.value || !modalDateRange.value[0] || !modalDateRange.value[1]) {
        message.warning(t('dashboard.transportationLogisticsRank.selectDateRangeFirst'));
        return;
      }

      const baseParams = {
        startDate: modalDateRange.value[0].format('YYYY-MM'),
        endDate: modalDateRange.value[1].format('YYYY-MM'),
        logisticName: modalSelectedLogisticProvider.value.length > 0 ? modalSelectedLogisticProvider.value : selectedLogisticProvider.value || [],
        cdcWarehouse: modalSelectedCdcWarehouse.value.length > 0 ? modalSelectedCdcWarehouse.value : selectedCdcWarehouse.value || [],
        customer: [] as string[],
        transType: [] as string[],
      };

      let result;
      if (activeTab.value === 'score') {
        result = await exportTransLogisticKpiRankScoreDetail(baseParams);
      } else {
        result = await exportTransLogisticKpiRankPunishDetail(baseParams);
      }

      if (result && result.code === 200 && result.data) {
        const url = result.data;
        const link = document.createElement('a');
        link.href = url;
        link.download = '';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(t('dashboard.transportationLogisticsRank.exportSuccess'));
      } else {
        message.error(result?.msg || t('dashboard.transportationLogisticsRank.exportFailed'));
      }
    } else {
      if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
        message.warning(t('dashboard.transportationLogisticsRank.selectDateRangeFirst'));
        return;
      }

      const params = {
        startDate: dateRange.value[0].format('YYYY-MM'),
        endDate: dateRange.value[1].format('YYYY-MM'),
        logisticName: selectedLogisticProvider.value || [],
        cdcWarehouse: selectedCdcWarehouse.value || [],
        customer: [] as string[],
        transType: selectedTransType.value || [],
      };

      const result = await exportTransLogisticKpiRank(params);

      if (result && result.code === 200 && result.data) {
        const url = result.data;
        const link = document.createElement('a');
        link.href = url;
        link.download = '';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(t('dashboard.transportationLogisticsRank.exportSuccess'));
      } else {
        message.error(result?.msg || t('dashboard.transportationLogisticsRank.exportFailed'));
      }
    }
  } catch (error: any) {
    console.error('handleExport:', error);
    message.error(error?.msg || t('dashboard.transportationLogisticsRank.exportFailed'));
  } finally {
    exportLoading.value = false;
  }
};

const scoreTableColumns = computed(() => [
  {
    title: t('dashboard.transportationLogisticsRank.yearMonth'),
    key: 'yearMonth',
    dataIndex: 'yearMonth',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: string }) => {
      if (!text) return '-';
      if (text === '汇总') return t('dashboard.transportationLogisticsRank.summary');
      return formatMonthLabel(text);
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.transType'),
    key: 'transType',
    dataIndex: 'transType',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('dashboard.transportationLogisticsRank.logisticProvider'),
    key: 'logistic',
    dataIndex: 'logistic',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('dashboard.transportationLogisticsRank.warehouse'),
    key: 'warehouse',
    dataIndex: 'warehouse',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('dashboard.transportationLogisticsRank.totalScore'),
    key: 'totalScore',
    dataIndex: 'totalScore',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.trunkLineOnTimeScore'),
    key: 'trunkLineOnTimeScore',
    dataIndex: 'trunkLineOnTimeScore',
    width: 220,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.pickupTimelinessScore'),
    key: 'pickupTimelinessScore',
    dataIndex: 'pickupTimelinessScore',
    width: 160,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.trunkLineDamageScore'),
    key: 'trunkLineDamageScore',
    dataIndex: 'trunkLineDamageScore',
    width: 180,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.abnormalOrderProcessingScore'),
    key: 'abnormalOrderProcessingScore',
    dataIndex: 'abnormalOrderProcessingScore',
    width: 300,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.infoFeedbackTimelinessScore'),
    key: 'infoFeedbackTimelinessScore',
    dataIndex: 'infoFeedbackTimelinessScore',
    width: 200,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.returnOrderTimelinessScore'),
    key: 'returnOrderTimelinessScore',
    dataIndex: 'returnOrderTimelinessScore',
    width: 180,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.operationAccuracyScore'),
    key: 'operationAccuracyScore',
    dataIndex: 'operationAccuracyScore',
    width: 180,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.scoreSummary'),
    key: 'kpiScore',
    dataIndex: 'kpiScore',
    width: 120,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.redLineIssue'),
    key: 'redLineIssue',
    dataIndex: 'redLineIssue',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.majorIssue'),
    key: 'majorIssue',
    dataIndex: 'majorIssue',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.seriousIssue'),
    key: 'seriousIssue',
    dataIndex: 'seriousIssue',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.minorIssue'),
    key: 'minorIssue',
    dataIndex: 'minorIssue',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.issueDescription'),
    key: 'issueDescription',
    dataIndex: 'issueDescription',
    width: 200,
    align: 'center' as const,
  },
  {
    title: t('dashboard.transportationLogisticsRank.bonusDeductionTotal'),
    key: 'bonusDeductionTotal',
    dataIndex: 'bonusDeductionTotal',
    width: 120,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
]);

const rewardTableColumns = computed(() => [
  {
    title: t('dashboard.transportationLogisticsRank.yearMonth'),
    key: 'yearMonth',
    dataIndex: 'yearMonth',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: string }) => {
      if (!text) return '-';
      if (text === '汇总') return t('dashboard.transportationLogisticsRank.summary');
      return formatMonthLabel(text);
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.transType'),
    key: 'transType',
    dataIndex: 'transType',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('dashboard.transportationLogisticsRank.logisticProvider'),
    key: 'logistic',
    dataIndex: 'logistic',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('dashboard.transportationLogisticsRank.warehouse'),
    key: 'warehouse',
    dataIndex: 'warehouse',
    width: 120,
    align: 'center' as const,
  },
  {
    title: t('dashboard.transportationLogisticsRank.redLineIssueYuan'),
    key: 'redLineIssue',
    dataIndex: 'redLineIssue',
    width: 120,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.majorIssueYuan'),
    key: 'majorIssue',
    dataIndex: 'majorIssue',
    width: 120,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.seriousIssueYuan'),
    key: 'seriousIssue',
    dataIndex: 'seriousIssue',
    width: 120,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.minorIssueYuan'),
    key: 'minorIssue',
    dataIndex: 'minorIssue',
    width: 120,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.breachHandling'),
    key: 'breachHandling',
    dataIndex: 'breachHandling',
    width: 120,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.totalPenalty'),
    key: 'totalPenalty',
    dataIndex: 'totalPenalty',
    width: 140,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.rewardAmount'),
    key: 'rewardAmount',
    dataIndex: 'rewardAmount',
    width: 120,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.remarkReason'),
    key: 'remarkReason',
    dataIndex: 'remarkReason',
    width: 200,
    align: 'center' as const,
  },
  {
    title: t('dashboard.transportationLogisticsRank.totalScore'),
    key: 'totalScore',
    dataIndex: 'totalScore',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.avgMonthlyShipVolume'),
    key: 'avgMonthlyShipVolume',
    dataIndex: 'avgMonthlyShipVolume',
    width: 140,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.standardBreachAmount'),
    key: 'standardBreachAmount',
    dataIndex: 'standardBreachAmount',
    width: 140,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: t('dashboard.transportationLogisticsRank.breachCoefficient'),
    key: 'breachCoefficient',
    dataIndex: 'breachCoefficient',
    width: 100,
    align: 'center' as const,
  },
  {
    title: t('dashboard.transportationLogisticsRank.isReward'),
    key: 'hasReward',
    dataIndex: 'hasReward',
    width: 100,
    align: 'center' as const,
  },
]);

const currentModalTableColumns = computed(() => {
  return activeTab.value === 'score' ? scoreTableColumns.value : rewardTableColumns.value;
});

const currentModalTableData = computed(() => {
  return activeTab.value === 'score' ? scoreTableData.value : rewardTableData.value;
});

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
      <h2 class="header-title">{{ t('dashboard.transportationLogisticsRank.title') }}</h2>
    </div>
    <div class="control-panel">
      <div class="filter-group">
        <div class="date-range-item">
          <a-range-picker
            v-model:value="dateRange"
            picker="month"
            format="YYYY-MM"
            :separator="t('dashboard.transportationLogisticsRank.separator')"
            :placeholder="[t('dashboard.transportationLogisticsRank.startMonth'), t('dashboard.transportationLogisticsRank.endMonth')]"
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
                :placeholder="t('dashboard.transportationLogisticsRank.searchLogisticProvider')" 
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
                {{ t('dashboard.transportationLogisticsRank.noSearchResults') }}
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
                :placeholder="t('dashboard.transportationLogisticsRank.searchCdcWarehouse')" 
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
                {{ t('dashboard.transportationLogisticsRank.noSearchResults') }}
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
                :placeholder="t('dashboard.transportationLogisticsRank.searchTransType')" 
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
                {{ t('dashboard.transportationLogisticsRank.noSearchResults') }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="action-buttons">
        <a-button @click="showDetailModal" class="action-btn">
          {{ t('dashboard.transportationLogisticsRank.viewDetails') }}
        </a-button>
        <a-button @click="handleExport" class="action-btn" :loading="exportLoading">
          {{ t('dashboard.transportationLogisticsRank.export') }}
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

    <Teleport to="body">
      <div v-if="modalVisible" class="custom-modal-overlay" @click="handleModalClose">
        <div class="custom-modal" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">{{ t('dashboard.transportationLogisticsRank.modalTitle') }}</h3>
            <button class="modal-close" @click="handleModalClose">×</button>
          </div>
          
          <div class="modal-control-panel">
            <div class="modal-filter-group">
              <div class="date-range-item">
                <a-range-picker
                  v-model:value="modalDateRange"
                  picker="month"
                  format="YYYY-MM"
                  :separator="t('dashboard.transportationLogisticsRank.separator')"
                  :placeholder="[t('dashboard.transportationLogisticsRank.startMonth'), t('dashboard.transportationLogisticsRank.endMonth')]"
                  class="date-range-picker"
                />
              </div>
              
              <div class="dropdown-item" @click.stop="modalToggleLogisticProviderDropdown">
                <span class="dropdown-text">{{ modalSelectedLogisticProviderText }}</span>
                <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
                <div class="dropdown-content" v-show="modalIsLogisticProviderOpen" @click.stop>
                  <div class="search-box">
                    <input 
                      v-model="modalLogisticProviderSearch" 
                      type="text" 
                      :placeholder="t('dashboard.transportationLogisticsRank.searchLogisticProvider')" 
                      class="search-input"
                      @click.stop 
                    />
                  </div>
                  <div class="options-list">
                    <div 
                      v-for="option in modalFilteredLogisticProviderOptions" 
                      :key="option.code" 
                      class="dropdown-option"
                      :class="{ 
                        'selected': option.code !== '__reset__' && modalSelectedLogisticProvider.includes(option.code),
                        'reset-option': option.code === '__reset__'
                      }" 
                      @click.stop="modalSelectLogisticProvider(option.code)"
                    >
                      <span class="checkmark" v-if="option.code !== '__reset__' && modalSelectedLogisticProvider.includes(option.code)">✓</span>
                      {{ option.name }}
                    </div>
                    <div v-if="modalFilteredLogisticProviderOptions.length === 1 && modalLogisticProviderSearch" class="no-results">
                      {{ t('dashboard.transportationLogisticsRank.noSearchResults') }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="dropdown-item" @click.stop="modalToggleCdcWarehouseDropdown">
                <span class="dropdown-text">{{ modalSelectedCdcWarehouseText }}</span>
                <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
                <div class="dropdown-content" v-show="modalIsCdcWarehouseOpen" @click.stop>
                  <div class="search-box">
                    <input 
                      v-model="modalCdcWarehouseSearch" 
                      type="text" 
                      :placeholder="t('dashboard.transportationLogisticsRank.searchCdcWarehouse')" 
                      class="search-input"
                      @click.stop 
                    />
                  </div>
                  <div class="options-list">
                    <div 
                      v-for="option in modalFilteredCdcWarehouseOptions" 
                      :key="option.code" 
                      class="dropdown-option"
                      :class="{ 
                        'selected': option.code !== '__reset__' && modalSelectedCdcWarehouse.includes(option.code),
                        'reset-option': option.code === '__reset__'
                      }" 
                      @click.stop="modalSelectCdcWarehouse(option.code)"
                    >
                      <span class="checkmark" v-if="option.code !== '__reset__' && modalSelectedCdcWarehouse.includes(option.code)">✓</span>
                      {{ option.name }}
                    </div>
                    <div v-if="modalFilteredCdcWarehouseOptions.length === 1 && modalCdcWarehouseSearch" class="no-results">
                      {{ t('dashboard.transportationLogisticsRank.noSearchResults') }}
                    </div>
                  </div>
                </div>
              </div>

              <a-button @click="handleModalReset" class="reset-btn">
                {{ t('dashboard.transportationLogisticsRank.reset') }}
              </a-button>
            </div>
          </div>

          <div class="modal-tabs">
            <div 
              class="tab-item" 
              :class="{ active: activeTab === 'score' }"
              @click="handleTabChange('score')"
            >
              {{ t('dashboard.transportationLogisticsRank.scoreDetail') }}
            </div>
            <div 
              class="tab-item" 
              :class="{ active: activeTab === 'reward' }"
              @click="handleTabChange('reward')"
            >
              {{ t('dashboard.transportationLogisticsRank.rewardDetail') }}
            </div>
          </div>

          <div class="modal-table-section" ref="modalTableSectionRef">
            <a-spin :spinning="modalLoading">
              <a-table 
                :columns="currentModalTableColumns" 
                :data-source="currentModalTableData" 
                :pagination="false"
                size="small" 
                class="custom-table"
                :scroll="{ x: 'max-content', y: modalTableScrollY }"
              />
            </a-spin>
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

.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.custom-modal {
  background: #0a1929;
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 4px;
  width: 90vw;
  height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
}

.modal-title {
  color: white;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: #ff4d4f;
}

.modal-control-panel {
  padding: 1rem;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
}

.modal-filter-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.modal-filter-group .date-range-item {
  flex-shrink: 0;
}

.modal-filter-group .date-range-item .date-range-picker {
  width: 12rem;
}

.modal-filter-group .dropdown-item {
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
  min-width: 8rem;
  padding: 0.3rem 0.5rem;
}

.modal-filter-group .dropdown-item:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.modal-filter-group .dropdown-item .dropdown-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modal-filter-group .dropdown-item .dropdown-icon {
  width: 0.8rem;
  height: 0.8rem;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
}

.modal-filter-group .dropdown-item .dropdown-content {
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
  display: flex;
  flex-direction: column;
}

.modal-filter-group .dropdown-item .dropdown-content .search-box {
  padding: 0.2rem;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
}

.modal-filter-group .dropdown-item .dropdown-content .search-box .search-input {
  width: 100%;
  padding: 0.15rem 0.3rem;
  background: rgba(0, 0, 0, 0.3);
  border: 0.0625rem solid rgba(59, 130, 246, 0.4);
  border-radius: 0.125rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  outline: none;
}

.modal-filter-group .dropdown-item .dropdown-content .options-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.2rem;
}

.modal-filter-group .dropdown-item .dropdown-content .options-list .dropdown-option {
  padding: 0.2rem 0.4rem;
  color: white;
  font-size: 0.7rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.modal-filter-group .dropdown-item .dropdown-content .options-list .dropdown-option:hover {
  background: rgba(59, 130, 246, 0.3);
}

.modal-filter-group .dropdown-item .dropdown-content .options-list .dropdown-option.selected {
  background: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}

.modal-filter-group .dropdown-item .dropdown-content .options-list .dropdown-option .checkmark {
  color: #00ff88;
  font-weight: bold;
}

.modal-filter-group .reset-btn {
  height: 1.8rem;
  background: #2873cc;
  border: none;
  border-radius: 2px;
  color: white;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0 0.75rem;
}

.modal-filter-group .reset-btn:hover {
  background: #1e6cc8;
}

.modal-tabs {
  display: flex;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
}

.modal-tabs .tab-item {
  padding: 0.75rem 1.5rem;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.3s;
}

.modal-tabs .tab-item:hover {
  color: white;
}

.modal-tabs .tab-item.active {
  color: #4a9eff;
  border-bottom-color: #4a9eff;
}

.modal-table-section {
  flex: 1;
  overflow: hidden;
  padding: 1rem;
}

.modal-table-section :deep(.ant-spin-container) {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-table-section :deep(.ant-table-wrapper) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-table-section .custom-table :deep(.ant-table) {
  background: transparent;
}

.modal-table-section .custom-table :deep(.ant-table-thead > tr > th) {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  font-size: 0.75rem;
}

.modal-table-section .custom-table :deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  color: white;
  font-size: 0.7rem;
  text-align: center;
}

.modal-table-section .custom-table :deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(74, 158, 255, 0.1);
}

.modal-table-section .custom-table :deep(.ant-table-container) {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  width: 100%;
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}

.modal-table-section .custom-table :deep(.ant-table-container)::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.modal-table-section .custom-table :deep(.ant-table-container)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.modal-table-section .custom-table :deep(.ant-table-container)::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.modal-table-section .custom-table :deep(.ant-table-container)::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.5);
}

.modal-table-section .custom-table :deep(.ant-table-container)::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.1);
}

.modal-table-section .custom-table :deep(.ant-table-body) {
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}

.modal-table-section .custom-table :deep(.ant-table-body::-webkit-scrollbar) {
  width: 4px;
  height: 4px;
}

.modal-table-section .custom-table :deep(.ant-table-body::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.modal-table-section .custom-table :deep(.ant-table-body::-webkit-scrollbar-thumb) {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.modal-table-section .custom-table :deep(.ant-table-body::-webkit-scrollbar-thumb:hover) {
  background: rgba(74, 158, 255, 0.5);
}

.modal-table-section .custom-table :deep(.ant-table-body::-webkit-scrollbar-corner) {
  background: rgba(0, 0, 0, 0.1);
}
</style>
