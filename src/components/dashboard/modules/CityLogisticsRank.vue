<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, Teleport } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore';
import { queryDeliveryKpiRank, queryDeliveryKpiRankDetail, queryDeliveryLogisticPunishInfo, exportDeliveryLogisticKpiRank, exportDeliveryLogisticKpiRankScoreDetail, exportDeliveryLogisticKpiRankPunishDetail } from '../../../services/transportApi';

// 定义zoom属性
const props = defineProps({
  zoom: {
    type: [Number, String],
    default: 1,
  },
});

// 使用公共 store
const selectOptionsStore = useSelectOptionsStore();

// 筛选表单数据
// 初始化默认日期范围（最近三个月，不包括本月）
const getInitialDateRange = (): [Dayjs, Dayjs] => {
  const now = dayjs();
  const startDate = now.subtract(3, 'month').startOf('month'); // 3个月前（不包括本月，所以减去3个月）
  const endDate = now.subtract(1, 'month').endOf('month'); // 上个月的最后一天
  return [startDate, endDate];
};

const dateRange = ref<[Dayjs, Dayjs]>(getInitialDateRange());
const selectedLogisticProvider = ref<string[]>([]);
const selectedCdcWarehouse = ref<string[]>([]);

// 下拉框选项（使用 store 中的选项）
// 业务类型
const bizType = '3';

const logisticProviderOptions = computed(() => selectOptionsStore.getLogisticsByBizType(bizType));
const cdcWarehouseOptions = computed(() => selectOptionsStore.getWarehouseByBizType(bizType));

// 搜索关键词
const logisticProviderSearch = ref('');
const cdcWarehouseSearch = ref('');

// 过滤后的物流商选项（包含重置选项）
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
  
  // 在列表开头添加重置选项
  return [{ code: '__reset__', name: '重置' }, ...filtered];
});

// 过滤后的CDC仓库选项（包含重置选项）
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
  
  // 在列表开头添加重置选项
  return [{ code: '__reset__', name: '重置' }, ...filtered];
});

// 下拉框开关状态
const isLogisticProviderOpen = ref(false);
const isCdcWarehouseOpen = ref(false);

// 表格数据
const tableData = ref<any[]>([]);
const loading = ref(false);

// 弹窗相关状态
const modalVisible = ref(false);
const modalTitle = ref('城配物流商KPI排名详情');
const activeTab = ref<'score' | 'reward'>('score');
const modalLoading = ref(false);
const exportLoading = ref(false);

// 详情表格数据
const detailTableData = ref<any[]>([]);
const scoreTableData = ref<any[]>([]);
const rewardTableData = ref<any[]>([]);

/** 弹窗详情请求序号：仅最新一次请求可写表格，避免并发/乱序覆盖 */
let detailFetchRequestId = 0;

// 弹窗内独立的下拉框状态（与主页面分离）
const modalIsLogisticProviderOpen = ref(false);
const modalIsCdcWarehouseOpen = ref(false);
const modalLogisticProviderSearch = ref('');
const modalCdcWarehouseSearch = ref('');
const modalSelectedLogisticProvider = ref<string[]>([]);
const modalSelectedCdcWarehouse = ref<string[]>([]);
const modalDateRange = ref<[Dayjs, Dayjs]>(getInitialDateRange());

// 表格容器引用和高度
const tableSectionRef = ref<HTMLElement | null>(null);
const tableScrollY = ref<number | undefined>(200);

// 弹窗表格容器引用和高度
const modalTableSectionRef = ref<HTMLElement | null>(null);
const modalTableScrollY = ref<number | undefined>(200);

// 显示文本（多选）
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

// 下拉框切换
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

// 选择选项（多选，不关闭下拉框）
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

// 从接口返回的数据中提取月份列表
const monthList = ref<string[]>([]);

// 表格列定义
const tableColumns = computed(() => {
  // 基础列：物流商、仓库（这两个列会跨两行）
  const baseColumns = [
    {
      title: '物流商',
      key: 'logistic',
      dataIndex: 'logistic',
      width: 120,
      align: 'center' as const,
    },
    {
      title: '仓库',
      key: 'warehouse',
      dataIndex: 'warehouse',
      width: 120,
      align: 'center' as const,
    },
  ];

  const monthColumns: any[] = [];
  
  // 对月份进行排序（从新到旧）
  const sortedMonths = [...monthList.value].sort((a, b) => {
    return dayjs(b).valueOf() - dayjs(a).valueOf();
  });
  
  // 第一组：所有月份的排名和总成绩（按月份顺序）
  sortedMonths.forEach((month) => {
    // 处理无效日期 "0000-00"
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
        {
          title: '排名',
          key: `${month}_rank`,
          dataIndex: `${month}_rank`,
          width: 80,
          align: 'center' as const,
        },
        {
          title: '总成绩',
          key: `${month}_totalScore`,
          dataIndex: `${month}_totalScore`,
          width: 100,
          align: 'center' as const,
        },
      ],
    });
  });
  
  // 第二组：所有月份的是否进行奖励和红线/重大/严重（按月份顺序）
  sortedMonths.forEach((month) => {
    // 处理无效日期 "0000-00"
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

// 获取排名数据
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
    };
    
    const result = await queryDeliveryKpiRank(params);
    
    if (result && result.code === 200 && result.data) {
      if (Array.isArray(result.data)) {
        // 首先收集所有唯一的月份
        const monthSet = new Set<string>();
        
        // 遍历返回的数据，收集所有月份
        result.data.forEach((item: any) => {
          if (item.rankList && Array.isArray(item.rankList)) {
            item.rankList.forEach((rankItem: any) => {
              if (rankItem.month) {
                monthSet.add(rankItem.month);
              }
            });
          }
        });
        
        // 更新月份列表（从新到旧排序）
        monthList.value = Array.from(monthSet).sort((a, b) => {
          return dayjs(b).valueOf() - dayjs(a).valueOf();
        });
        
        // 使用 Map 来组织数据，key 为 logistic_warehouse（配送KPI不需要运输方式）
        const dataMap = new Map<string, any>();
        
        // 遍历返回的数据
        result.data.forEach((item: any) => {
          const key = `${item.logistic || ''}_${item.cdcWarehouse || ''}`;
          
          // 如果该物流商+仓库组合还没有在 Map 中，创建新行
          if (!dataMap.has(key)) {
            dataMap.set(key, {
              key,
              logistic: item.logistic || '',
              warehouse: item.cdcWarehouse || '',
            });
          }
          
          // 处理 rankList 中的数据
          if (item.rankList && Array.isArray(item.rankList)) {
            item.rankList.forEach((rankItem: any) => {
              const month = rankItem.month;
              if (month) {
                const row = dataMap.get(key);
                if (row) {
                  // 设置该月份的排名
                  row[`${month}_rank`] = rankItem.rank !== undefined ? rankItem.rank : null;
                  // 设置该月份的总成绩
                  row[`${month}_totalScore`] = rankItem.totalScore !== undefined ? rankItem.totalScore : null;
                  // 设置该月份是否进行奖励
                  row[`${month}_hasReward`] = rankItem.hasReward !== undefined ? rankItem.hasReward : null;
                  // 设置该月份是否存在红线/重大/严重问题
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

// 监听日期范围变化
watch(dateRange, () => {
  fetchRankData();
}, { deep: true });

// 计算表格滚动高度
const calculateTableScrollY = () => {
  nextTick(() => {
    if (tableSectionRef.value) {
      const containerHeight = tableSectionRef.value.clientHeight;
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 200;
      tableScrollY.value = calculatedHeight;
    }
  });
};

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

// 点击外部关闭下拉框
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  // 如果点击在弹窗内，不处理（由弹窗内部处理）
  if (target.closest('.custom-modal')) {
    return;
  }
  if (!target.closest('.dropdown-item') && !target.closest('.dropdown-content')) {
    if (isLogisticProviderOpen.value || isCdcWarehouseOpen.value) {
      closeAllDropdowns();
      fetchRankData();
    }
  }
};

// 组件挂载
onMounted(async () => {
  // 获取物流商和CDC仓库列表（传参为 '3'）
  await selectOptionsStore.fetchLogisticsByBizType('3');
  await selectOptionsStore.fetchWarehouseByBizType('3');
  await fetchRankData();
  document.addEventListener('click', handleClickOutside);
  
  // 计算表格滚动高度
  calculateTableScrollY();
  
  // 监听窗口大小变化
  window.addEventListener('resize', calculateTableScrollY);
  window.addEventListener('resize', calculateModalTableScrollY);
  
  // 使用 ResizeObserver 监听容器大小变化
  if (tableSectionRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      calculateTableScrollY();
    });
    resizeObserver.observe(tableSectionRef.value);
    
    // 保存 observer 以便卸载时清理
    (tableSectionRef.value as any)._resizeObserver = resizeObserver;
  }
  
  // 监听弹窗显示状态变化
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

// 获取详情数据
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
    // 使用弹窗内的筛选条件
    const baseParams = {
      startDate: modalDateRange.value[0].format('YYYY-MM'),
      endDate: modalDateRange.value[1].format('YYYY-MM'),
      logisticName: modalSelectedLogisticProvider.value.length > 0 ? modalSelectedLogisticProvider.value : selectedLogisticProvider.value || [],
      cdcWarehouse: modalSelectedCdcWarehouse.value.length > 0 ? modalSelectedCdcWarehouse.value : selectedCdcWarehouse.value || [],
    };
    
    // 根据当前标签页调用不同的接口
    if (activeTab.value === 'score') {
      // 得分详情：使用 queryDeliveryKpiRankDetail
      const params = {
        ...baseParams,
        customer: [] as string[],
      };
      
      const result = await queryDeliveryKpiRankDetail(params);
      if (isStale()) return;
      
      if (result && result.code === 200 && result.data) {
        if (Array.isArray(result.data)) {
          const scoreData: any[] = [];
          
          // 配送KPI类型映射
          const kpiTypeMap: { [key: number]: string } = {
            12: 'secInboundCycleScore', // SEC入库周期达标率(满分:15)
            1: 'deliveryOnTimeScore', // 发货及时率(满分:5)
            4: 'inventoryAccuracyScore', // 库存准确率(满分:5)
            13: 'onTimeDeliveryScore', // 准时交货率(满分:30)
            14: 'cargoDamageScore', // 货损率(满分:5)
            15: 'abnormalResolutionScore', // 异常解决及时率(满分:5)
            16: 'tmsSecAppScore', // TMS&SEC APP签收率(满分:5)
            17: 'tmsInfoSignScore', // TMS信息签收及时性(满分:10)
            11: 'returnOrderScore', // 返单及时率得分(满分:10)
            5: 'operationAccuracyScore', // 运作准确率得分(满分:5)
            18: 'customerSatisfactionScore', // 客户满意度得分(满分:5)
          };
          
          result.data.forEach((item: any) => {
            const key = `${item.logistic || ''}_${item.cdcWarehouse || ''}_${item.month || ''}`;
            
            // 处理得分详情
            const scoreRow: any = {
              key,
              yearMonth: item.month || '',
              logistic: item.logistic || '',
              warehouse: item.cdcWarehouse || '',
              totalScore: item.totalScore !== undefined ? item.totalScore : null,
              // 初始化所有KPI得分为null
              secInboundCycleScore: null,
              deliveryOnTimeScore: null,
              inventoryAccuracyScore: null,
              onTimeDeliveryScore: null,
              cargoDamageScore: null,
              abnormalResolutionScore: null,
              tmsSecAppScore: null,
              tmsInfoSignScore: null,
              returnOrderScore: null,
              operationAccuracyScore: null,
              customerSatisfactionScore: null,
              // KPI总分
              kpiScore: item.kpiScore !== undefined ? item.kpiScore : null,
              // 问题相关字段（数值）
              redLineIssue: item.redLineIssue !== undefined ? item.redLineIssue : null, // 红线问题扣分
              majorIssue: item.majorIssue !== undefined ? item.majorIssue : null, // 重大问题扣分
              seriousIssue: item.seriousIssue !== undefined ? item.seriousIssue : null, // 严重问题扣分
              minorIssue: item.minorIssue !== undefined ? item.minorIssue : null, // 一般问题加分
              issueDescription: item.deductionDesc || '-', // 问题描述
              // 加分/扣分合计
              bonusDeductionTotal: null,
            };
            
            // 计算加分/扣分合计 = 红线问题 + 重大问题 + 严重问题 + 一般问题
            const redLine = scoreRow.redLineIssue !== null && scoreRow.redLineIssue !== undefined ? scoreRow.redLineIssue : 0;
            const major = scoreRow.majorIssue !== null && scoreRow.majorIssue !== undefined ? scoreRow.majorIssue : 0;
            const serious = scoreRow.seriousIssue !== null && scoreRow.seriousIssue !== undefined ? scoreRow.seriousIssue : 0;
            const minor = scoreRow.minorIssue !== null && scoreRow.minorIssue !== undefined ? scoreRow.minorIssue : 0;
            scoreRow.bonusDeductionTotal = redLine + major + serious + minor;
            
            // 从kpi数组中提取各KPI类型的得分
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
      // 奖惩详情：使用 queryDeliveryLogisticPunishInfo
      const params = {
        ...baseParams,
        customer: [] as string[],
      };
      
      const result = await queryDeliveryLogisticPunishInfo(params);
      if (isStale()) return;
      
      if (result && result.code === 200 && result.data) {
        if (Array.isArray(result.data)) {
          const rewardData: any[] = [];
          
          result.data.forEach((item: any) => {
            const key = `${item.logistic || ''}_${item.warehouse || ''}_${item.month || ''}`;
            
            // 处理奖惩详情，根据接口返回的字段结构
            rewardData.push({
              key,
              yearMonth: item.month || '',
              logistic: item.logistic || '',
              warehouse: item.warehouse || '',
              // 问题相关（单位：元）
              redLineIssue: item.redLineIssue !== undefined ? item.redLineIssue : null, // 红线问题扣分
              majorIssue: item.majorIssue !== undefined ? item.majorIssue : null, // 重大问题扣分
              seriousIssue: item.seriousIssue !== undefined ? item.seriousIssue : null, // 严重问题扣分
              minorIssue: item.minorIssue !== undefined ? item.minorIssue : null, // 一般问题加分
              breachHandling: item.breachAmount !== undefined ? item.breachAmount : null, // 违约处理(元)
              totalPenalty: item.deductionAmount !== undefined ? item.deductionAmount : null, // 总罚款金额(元)
              // 奖励相关
              rewardAmount: item.rewardAmount !== undefined ? item.rewardAmount : null, // 奖励金额(元)
              remarkReason: item.remarkReason || '-', // 备注原因
              totalScore: item.totalScore !== undefined ? item.totalScore : null, // 总成绩
              avgMonthlyShipVolume: item.avgMonthlyShipVolume !== undefined ? item.avgMonthlyShipVolume : null, // 月均发货体积(单位:m³)
              // 违约相关
              standardBreachAmount: item.standardBreachAmount !== undefined ? item.standardBreachAmount : null, // 标准违约金(元)
              breachCoefficient: item.breachCoefficient || '-', // 违约系数
              hasReward: item.hasReward !== undefined ? (item.hasReward ? '是' : '否') : '-', // 考核结果是否奖励
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

// 弹窗内过滤后的物流商选项
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

// 弹窗内过滤后的CDC仓库选项
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

// 弹窗内显示文本
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

// 弹窗内下拉框切换
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

// 弹窗内选择选项
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

// 关闭所有弹窗内下拉框
const closeAllModalDropdowns = () => {
  modalIsLogisticProviderOpen.value = false;
  modalIsCdcWarehouseOpen.value = false;
  modalLogisticProviderSearch.value = '';
  modalCdcWarehouseSearch.value = '';
};

// 打开详情弹窗
const showDetailModal = () => {
  modalVisible.value = true;
  activeTab.value = 'score';
  
  // 将主页面的值复制到弹窗内（深拷贝，避免引用）
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

// 关闭弹窗
const handleModalClose = () => {
  detailFetchRequestId += 1;
  modalVisible.value = false;
  modalLoading.value = false;
  scoreTableData.value = [];
  rewardTableData.value = [];
  detailTableData.value = [];
};

// 弹窗内重置按钮点击事件
const handleModalReset = () => {
  // 重置所有下拉框选择
  modalSelectedLogisticProvider.value = [];
  modalSelectedCdcWarehouse.value = [];
  
  // 清空搜索关键词
  modalLogisticProviderSearch.value = '';
  modalCdcWarehouseSearch.value = '';
  
  // 关闭所有下拉框
  closeAllModalDropdowns();
  
  // 重置日期范围到默认值（当月）
  modalDateRange.value = getInitialDateRange();
  
  // 重置后调用请求
  fetchDetailData();
};

// 切换标签页
const handleTabChange = (key: string) => {
  activeTab.value = key as 'score' | 'reward';
  
  // 重置搜索条件
  modalSelectedLogisticProvider.value = [];
  modalSelectedCdcWarehouse.value = [];
  modalLogisticProviderSearch.value = '';
  modalCdcWarehouseSearch.value = '';
  closeAllModalDropdowns();
  // 重置日期范围到默认值（当月）
  modalDateRange.value = getInitialDateRange();
  
  // 切换标签页时重新获取数据
  fetchDetailData();
};

// 导出数据
const handleExport = async () => {
  try {
    exportLoading.value = true;
    
    // 判断是在弹窗内还是主页面
    if (modalVisible.value) {
      // 弹窗内导出：根据当前标签页调用不同的导出接口
      if (!modalDateRange.value || !modalDateRange.value[0] || !modalDateRange.value[1]) {
        message.warning('请先选择日期范围');
        return;
      }
      
      const baseParams = {
        startDate: modalDateRange.value[0].format('YYYY-MM'),
        endDate: modalDateRange.value[1].format('YYYY-MM'),
        logisticName: modalSelectedLogisticProvider.value.length > 0 ? modalSelectedLogisticProvider.value : selectedLogisticProvider.value || [],
        cdcWarehouse: modalSelectedCdcWarehouse.value.length > 0 ? modalSelectedCdcWarehouse.value : selectedCdcWarehouse.value || [],
      };
      
      let result;
      if (activeTab.value === 'score') {
        // 得分详情导出
        const params = {
          ...baseParams,
          customer: [] as string[],
        };
        result = await exportDeliveryLogisticKpiRankScoreDetail(params);
      } else {
        // 奖惩详情导出
        const params = {
          ...baseParams,
          customer: [] as string[],
        };
        result = await exportDeliveryLogisticKpiRankPunishDetail(params);
      }
      
      // 处理导出结果
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
    } else {
      // 主页面导出：导出排名数据
      if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
        message.warning('请先选择日期范围');
        return;
      }
      
      const params = {
        startDate: dateRange.value[0].format('YYYY-MM'),
        endDate: dateRange.value[1].format('YYYY-MM'),
        logisticName: selectedLogisticProvider.value || [],
        cdcWarehouse: selectedCdcWarehouse.value || [],
        customer: [] as string[],
      };
      
      const result = await exportDeliveryLogisticKpiRank(params);
      
      // 处理导出结果
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
    }
  } catch (error: any) {
    console.error('导出失败:', error);
    message.error(error?.msg || '导出失败');
  } finally {
    exportLoading.value = false;
  }
};

// 得分详情表格列
const scoreTableColumns = computed(() => [
  {
    title: '年月',
    key: 'yearMonth',
    dataIndex: 'yearMonth',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: string }) => {
      if (!text) return '-';
      if (text === '汇总') return '汇总';
      // 处理无效日期 "0000-00"
      if (text === '0000-00' || text.startsWith('0000')) {
        return '0000年00月';
      }
      // 格式化年月：2025-11 -> 2025年11月
      const parts = text.split('-');
      if (parts.length === 2 && parts[0] && parts[1]) {
        return `${parts[0]}年${parseInt(parts[1])}月`;
      }
      return text;
    },
  },
  {
    title: '物流商',
    key: 'logistic',
    dataIndex: 'logistic',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '仓库',
    key: 'warehouse',
    dataIndex: 'warehouse',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '总成绩',
    key: 'totalScore',
    dataIndex: 'totalScore',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: 'SEC入库周期达标率(满分: 15)',
    key: 'secInboundCycleScore',
    dataIndex: 'secInboundCycleScore',
    width: 220,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '发货及时率(满分: 5)',
    key: 'deliveryOnTimeScore',
    dataIndex: 'deliveryOnTimeScore',
    width: 160,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '库存准确率(满分: 5)',
    key: 'inventoryAccuracyScore',
    dataIndex: 'inventoryAccuracyScore',
    width: 160,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '准时交货率(满分: 30)',
    key: 'onTimeDeliveryScore',
    dataIndex: 'onTimeDeliveryScore',
    width: 170,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '货损率(满分: 5)',
    key: 'cargoDamageScore',
    dataIndex: 'cargoDamageScore',
    width: 140,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '异常解决及时率(满分: 5)',
    key: 'abnormalResolutionScore',
    dataIndex: 'abnormalResolutionScore',
    width: 200,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: 'TMS&SEC APP签收率(满分: 5)',
    key: 'tmsSecAppScore',
    dataIndex: 'tmsSecAppScore',
    width: 210,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: 'TMS信息签收及时性(满分: 10)',
    key: 'tmsInfoSignScore',
    dataIndex: 'tmsInfoSignScore',
    width: 230,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '返单及时率得分(满分: 10)',
    key: 'returnOrderScore',
    dataIndex: 'returnOrderScore',
    width: 180,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '运作准确率得分(满分: 5)',
    key: 'operationAccuracyScore',
    dataIndex: 'operationAccuracyScore',
    width: 190,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '客户满意度得分(满分: 5)',
    key: 'customerSatisfactionScore',
    dataIndex: 'customerSatisfactionScore',
    width: 190,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '得分汇总',
    key: 'kpiScore',
    dataIndex: 'kpiScore',
    width: 120,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '红线问题',
    key: 'redLineIssue',
    dataIndex: 'redLineIssue',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '重大问题',
    key: 'majorIssue',
    dataIndex: 'majorIssue',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '严重问题',
    key: 'seriousIssue',
    dataIndex: 'seriousIssue',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '一般问题',
    key: 'minorIssue',
    dataIndex: 'minorIssue',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '问题描述',
    key: 'issueDescription',
    dataIndex: 'issueDescription',
    width: 240,
    align: 'center' as const,
    customCell: () => ({ class: 'table-cell-wrap' }),
    customHeaderCell: () => ({ class: 'table-cell-wrap' }),
  },
  {
    title: '加分/扣分合计',
    key: 'bonusDeductionTotal',
    dataIndex: 'bonusDeductionTotal',
    width: 140,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      if (text === null || text === undefined) return '-';
      // 如果是正数显示为加分，负数显示为扣分
      return text > 0 ? `+${text}` : String(text);
    },
  },
]);

// 奖惩详情表格列
const rewardTableColumns = computed(() => [
  {
    title: '年月',
    key: 'yearMonth',
    dataIndex: 'yearMonth',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: string }) => {
      if (!text) return '-';
      if (text === '汇总') return '汇总';
      // 处理无效日期 "0000-00"
      if (text === '0000-00' || text.startsWith('0000')) {
        return '0000年00月';
      }
      // 格式化年月：2025-11 -> 2025年11月
      const parts = text.split('-');
      if (parts.length === 2 && parts[0] && parts[1]) {
        return `${parts[0]}年${parseInt(parts[1])}月`;
      }
      return text;
    },
  },
  {
    title: '物流商',
    key: 'logistic',
    dataIndex: 'logistic',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '仓库',
    key: 'warehouse',
    dataIndex: 'warehouse',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '红线问题(元)',
    key: 'redLineIssue',
    dataIndex: 'redLineIssue',
    width: 140,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '重大问题(元)',
    key: 'majorIssue',
    dataIndex: 'majorIssue',
    width: 140,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '严重问题(元)',
    key: 'seriousIssue',
    dataIndex: 'seriousIssue',
    width: 140,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '一般问题(元)',
    key: 'minorIssue',
    dataIndex: 'minorIssue',
    width: 140,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '违约处理(元)',
    key: 'breachHandling',
    dataIndex: 'breachHandling',
    width: 140,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '总罚款金额(元)',
    key: 'totalPenalty',
    dataIndex: 'totalPenalty',
    width: 160,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '奖励金额(元)',
    key: 'rewardAmount',
    dataIndex: 'rewardAmount',
    width: 140,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '备注原因',
    key: 'remarkReason',
    dataIndex: 'remarkReason',
    width: 240,
    align: 'center' as const,
    customCell: () => ({ class: 'table-cell-wrap' }),
    customHeaderCell: () => ({ class: 'table-cell-wrap' }),
  },
  {
    title: '总成绩',
    key: 'totalScore',
    dataIndex: 'totalScore',
    width: 100,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '月均发货体积(单位:m³)',
    key: 'avgMonthlyShipVolume',
    dataIndex: 'avgMonthlyShipVolume',
    width: 180,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '标准违约金(元)',
    key: 'standardBreachAmount',
    dataIndex: 'standardBreachAmount',
    width: 160,
    align: 'center' as const,
    customRender: ({ text }: { text: number | null }) => {
      return text !== null && text !== undefined ? String(text) : '-';
    },
  },
  {
    title: '违约系数',
    key: 'breachCoefficient',
    dataIndex: 'breachCoefficient',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '考核结果是否奖励',
    key: 'hasReward',
    dataIndex: 'hasReward',
    width: 160,
    align: 'center' as const,
  },
]);

// 处理弹窗内容区域点击
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

// 组件卸载
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', calculateTableScrollY);
  window.removeEventListener('resize', calculateModalTableScrollY);
  
  // 清理 ResizeObserver
  if (tableSectionRef.value && (tableSectionRef.value as any)._resizeObserver) {
    (tableSectionRef.value as any)._resizeObserver.disconnect();
  }
  
  // 清理弹窗 ResizeObserver
  if (modalTableSectionRef.value && (modalTableSectionRef.value as any)._resizeObserver) {
    (modalTableSectionRef.value as any)._resizeObserver.disconnect();
  }
});
</script>

<template>
  <div class="rank-container">
    <div class="header-bar">
      <h2 class="header-title">城配物流商KPI排名</h2>
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

        <!-- CDC仓库下拉框 -->
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
                placeholder="搜索CDC仓库..." 
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

      </div>
      
      <!-- 操作按钮组 -->
      <div class="action-buttons">
        <a-button type="primary" @click="showDetailModal" class="action-btn">
          查看详情
        </a-button>
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

    <!-- 详情弹窗 -->
    <Teleport to="body">
      <div v-if="modalVisible" class="custom-modal-overlay">
        <div class="custom-modal">
          <!-- 弹窗头部 -->
          <div class="modal-header">
            <div class="header-striped-bg"></div>
            <h3 class="modal-title">{{ modalTitle }}</h3>
            <button class="close-btn" @click="handleModalClose">×</button>
          </div>

          <!-- 弹窗内容 -->
          <div class="modal-body" @click="handleModalBodyClick">
            <!-- 标签页 -->
            <div class="tabs-container">
              <div 
                class="tab-item" 
                :class="{ active: activeTab === 'score' }"
                @click="handleTabChange('score')"
              >
                得分详情
              </div>
              <div 
                class="tab-item" 
                :class="{ active: activeTab === 'reward' }"
                @click="handleTabChange('reward')"
              >
                奖惩详情
              </div>
            </div>

            <!-- 搜索筛选区域 -->
            <div class="search-section">
              <div class="search-row">
                <!-- 月份范围选择器 -->
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
                
                <!-- 物流商下拉框 -->
                <div class="search-item">
                  <div class="dropdown-group">
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
                            placeholder="搜索物流商..." 
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
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- CDC仓库下拉框 -->
                <div class="search-item">
                  <div class="dropdown-group">
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
                            placeholder="搜索CDC仓库..." 
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
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="search-buttons">
                  <a-button @click="handleModalReset" class="reset-btn">重置</a-button>
                  <a-button @click="fetchDetailData" class="searchinfo-btn">查询</a-button>
                  <a-button @click="handleExport" class="searchinfo-btn" :loading="exportLoading">导出</a-button>
                </div>
              </div>
            </div>

            <!-- 表格区域 -->
            <div class="table-section" ref="modalTableSectionRef" :class="{ 'score-tab': activeTab === 'score', 'reward-tab': activeTab === 'reward' }">
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

/* 控制面板 */
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

/* 表格区域 */
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

/* 操作按钮组 */
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

/* 弹窗样式 */
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
  z-index: 1000;
  overflow: visible;
}

.custom-modal {
  background: #0a1f3d;
  border-radius: 8px;
  width: 90%;
  max-width: 1400px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.modal-header {
  position: relative;
  padding: 1rem;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
}

.header-striped-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #4a9eff 0%, #00d4ff 50%, #4a9eff 100%);
}

.modal-title {
  margin: 0;
  color: white;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1.5rem;
  cursor: pointer;
  transition: color 0.3s;
}

.close-btn:hover {
  color: white;
}

.modal-body {
  flex: 1;
  padding: 1.5rem;
  overflow: auto;
}

/* 标签页 */
.tabs-container {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
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

.tab-item:hover {
  color: rgba(255, 255, 255, 0.9);
}

.tab-item.active {
  color: #4a9eff;
  border-bottom-color: #4a9eff;
  font-weight: 600;
}

/* 搜索区域 */
.search-section {
  margin-bottom: 1.25rem;
  position: relative;
  z-index: 10;
}

.search-section .search-row {
  display: flex;
  align-items: center;
  gap: 0.9375rem;
  flex-wrap: nowrap;
  justify-content: space-between;
}

.search-section .search-item {
  flex: 1;
  min-width: 6.25rem;
  max-width: 10rem;
}

.search-section .search-item .date-range-item .date-range-picker {
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
  width: 100%;
  height: 1.8rem;
  padding: 0.3rem 0.5rem;
}

.search-section .search-item .date-range-item .date-range-picker:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.search-section .search-item .dropdown-group .dropdown-item {
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
}

.search-section .search-item .dropdown-group .dropdown-item:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-icon {
  width: 0.8rem;
  height: 0.8rem;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease;
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content {
  position: absolute;
  top: calc(100% + 0.2rem);
  left: 0;
  right: 0;
  background: #081F40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.1875rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
  z-index: 2147483647;
  max-height: 12rem;
  overflow: hidden;
  backdrop-filter: blur(0.625rem);
  display: flex;
  flex-direction: column;
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .search-box {
  padding: 0.2rem;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
  flex-shrink: 0;
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .search-box .search-input {
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

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .search-box .search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .search-box .search-input:focus {
  border-color: rgba(59, 130, 246, 0.8);
  background: rgba(0, 0, 0, 0.5);
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .options-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 7.6rem;
  padding: 0.2rem;
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar {
  width: 6px;
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option {
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

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
  margin-bottom: 0.1rem;
  padding-bottom: 0.3rem;
  position: relative;
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0.0625rem;
  background: rgba(59, 130, 246, 0.3);
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option:hover {
  background: rgba(59, 130, 246, 0.3);
  color: rgba(255, 255, 255, 1);
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option:hover {
  background: rgba(59, 130, 246, 0.3);
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option.selected {
  background: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}

.search-section .search-item .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option .checkmark {
  color: #00ff88;
  font-weight: bold;
  font-size: 0.8rem;
}

.search-section .search-buttons {
  display: flex;
  gap: 0.5rem;
}

.search-section .search-buttons .reset-btn {
  height: 1.8rem;
  background: transparent;
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 2px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s;
  padding: 0 0.75rem;
}

.search-section .search-buttons .reset-btn:hover {
  border-color: #4a9eff;
  color: white;
}

.search-section .search-buttons .searchinfo-btn {
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

.search-section .search-buttons .searchinfo-btn:hover:not(:disabled) {
  background: #1e6cc8;
  box-shadow: 1px 1px 1px 0px #1c5fb8, inset 0px 1px 1px 0px #b8d5ff;
}

.search-section .search-buttons .searchinfo-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.table-cell-wrap {
  white-space: normal;
  word-wrap: break-word;
  word-break: break-all;
}
</style>
