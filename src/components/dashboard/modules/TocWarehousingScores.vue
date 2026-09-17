<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h, nextTick } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { message } from 'ant-design-vue';
import { queryToCKpiSummary, exportTocLogisticKpiScoreSummary, exportTocLogisticKpiScoreDetail } from '../../../services/transportApi';
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore';

// 使用公共 store
const selectOptionsStore = useSelectOptionsStore();

// 筛选表单数据
// 默认前2个月：当月-2 至 当月-1
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

// 下拉框选项
// 业务类型
const bizType = '6';

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
const exportSummaryLoading = ref(false);
const exportDetailLoading = ref(false);

// 表格容器引用和高度
const tableSectionRef = ref<HTMLElement | null>(null);
const tableScrollY = ref<number | undefined>(200); // 默认200，会动态计算

// 表格列定义（根据显示详情开关动态变化）
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
      key: 'logisticProvider',
      dataIndex: 'logisticProvider',
      width: 120,
      align: 'center' as const,
    },
  ];

  if (showDetails.value) {
    // 显示详情时的表头
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
      {
        title: '入库及时率',
        key: 'inventoryOnTimeRate',
        children: [
          {
            title: '及时收货上架的商品数量',
            key: 'onTimeReceivedItemsCount',
            dataIndex: 'onTimeReceivedItemsCount',
            width: 150,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderNumberCell(text, record.inventoryOnTimeRateColor);
            }
          },
          {
            title: '实际收货上架总商品数量',
            key: 'actualGoodsCountReceived',
            dataIndex: 'actualGoodsCountReceived',
            width: 150,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderNumberCell(text, record.inventoryOnTimeRateColor);
            }
          },
          {
            title: '入库及时率',
            key: 'inventoryOnTimeRate',
            dataIndex: 'inventoryOnTimeRate',
            width: 120,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderRateCell(text, record.inventoryOnTimeRateTrend, record.inventoryOnTimeRateColor, true);
            }
          },
          {
            title: '得分 (满分30分)',
            key: 'inventoryScore',
            dataIndex: 'inventoryScore',
            width: 150,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderNumberCell(text, record.inventoryOnTimeRateColor);
            }
          },
        ]
      },
      {
        title: '出库及时率',
        key: 'outboundOnTimeRate',
        children: [
          {
            title: '及时出库订单量',
            key: 'outboundOnTimeCount',
            dataIndex: 'outboundOnTimeCount',
            width: 150,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderNumberCell(text, record.outboundOnTimeRateColor);
            }
          },
          {
            title: '实际应出库总订单量',
            key: 'outboundOrderTotalCount',
            dataIndex: 'outboundOrderTotalCount',
            width: 150,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderNumberCell(text, record.outboundOnTimeRateColor);
            }
          },
          {
            title: '出库及时率',
            key: 'outboundOnTimeRate',
            dataIndex: 'outboundOnTimeRate',
            width: 120,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderRateCell(text, record.outboundOnTimeRateTrend, record.outboundOnTimeRateColor, true);
            }
          },
          {
            title: '得分 (满分50分)',
            key: 'deliveryScore',
            dataIndex: 'deliveryScore',
            width: 150,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderNumberCell(text, record.outboundOnTimeRateColor);
            }
          },
        ]
      },
      {
        title: '运作差错（次数）',
        key: 'operationErrorCount',
        children: [
          {
            title: '次数',
            key: 'operationErrorCount',
            dataIndex: 'operationErrorCount',
            width: 150,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderNumberCell(text, record.operationErrorCountColor);
            }
          },
          {
            title: '得分 (满分10分)',
            key: 'operationErrorScore',
            dataIndex: 'operationErrorScore',
            width: 150,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderNumberCell(text, record.operationErrorCountColor);
            }
          },
        ]
      },
      {
        title: '客户满意度',
        key: 'CustomerSatisfactionRate',
         children: [
          {
            title: '客户评分',
            key: 'CustomerSatisfactionRate',
            dataIndex: 'CustomerSatisfactionRate',
            width: 150,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderNumberCell(text, record.CustomerSatisfactionRateColor);
            }
          },
          {
            title: '得分 (满分10分)',
            key: 'CustomerSatisfactionScore',
            dataIndex: 'CustomerSatisfactionScore',
            width: 150,
            align: 'center' as const,
            customRender: ({ text, record }: { text: number; record: any }) => {
              return renderNumberCell(text, record.CustomerSatisfactionRateColor);
            }
          },
        ]
      },
      {
        title: '得分汇总',
        key: 'scoreSummary',
        dataIndex: 'scoreSummary',
        width: 120,
        align: 'center' as const,
      },
      {
        title: '扣分项',
        key: 'totalDeduction',
        dataIndex: 'totalDeduction',
        width: 120,
        align: 'center' as const,
      },
      {
        title: '扣分说明',
        key: 'deductionDesc',
        dataIndex: 'deductionDesc',
        width: 120,
        align: 'center' as const,
      },
      {
        title: '加分项',
        key: 'totalBonus',
        dataIndex: 'totalBonus',
        width: 120,
        align: 'center' as const,
      },
      {
        title: '加分说明',
        key: 'bonusDescription',
        dataIndex: 'bonusDescription',
        width: 120,
        align: 'center' as const,
      }
    ];
  } else {
    // 不显示详情时的简化表头
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
        title: '入库及时率',
        key: 'inventoryOnTimeRate',
        dataIndex: 'inventoryOnTimeRate',
        width: 150,
        align: 'center' as const,
        customRender: ({ text, record }: { text: number; record: any }) => {
          return renderRateCell(text, record.inventoryOnTimeRateTrend, record.inventoryOnTimeRateColor, false);
        }
      },
      {
        title: '出库及时率',
        key: 'outboundOnTimeRate',
        dataIndex: 'outboundOnTimeRate',
        width: 150,
        align: 'center' as const,
        customRender: ({ text, record }: { text: number; record: any }) => {
          return renderRateCell(text, record.outboundOnTimeRateTrend, record.outboundOnTimeRateColor, false);
        }
      },
      {
        title: '运作差错（次数）',
        key: 'operationErrorCount',
        dataIndex: 'operationErrorCount',
        width: 150,
        align: 'center' as const,
        customRender: ({ text, record }: { text: number; record: any }) => {
          return renderNumberCellWithTrend(text, record.operationErrorCountTrend, record.operationErrorCountColor);
        }
      },
      {
        title: '客户满意度',
        key: 'CustomerSatisfactionRate',
        dataIndex: 'CustomerSatisfactionRate',
        width: 200,
        align: 'center' as const,
        customRender: ({ text, record }: { text: number; record: any }) => {
          return renderNumberCellWithTrend(text, record.CustomerSatisfactionRateTrend, record.CustomerSatisfactionRateColor);
        }
      }
    ];
  }
});

// 渲染比率单元格（带颜色和箭头）
// 根据 color 值获取对应的颜色
const getColorByValue = (colorValue: 'red' | 'yellow' | 'green' | null): string => {
  if (colorValue === 'red') {
    return '#ff4d4f'; // 红色
  } else if (colorValue === 'yellow') {
    return '#faad14'; // 黄色
  } else if (colorValue === 'green') {
    return '#52c41a'; // 绿色
  }
  return 'rgba(255, 255, 255, 0.7)'; // 默认颜色
};

// 渲染数字单元格（带颜色和箭头）
const renderNumberCellWithTrend = (value: number | string, trend: 'up' | 'same' | 'down' | null, colorValue: 'red' | 'yellow' | 'green' | null, isDetailMode: boolean = false) => {
  const textColor = getColorByValue(colorValue);
  const displayValue = value !== null && value !== undefined ? String(value) : '-';
  
  // 详情状态下不显示箭头
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

// 渲染数字单元格（带颜色）
const renderNumberCell = (value: number | string, colorValue: 'red' | 'yellow' | 'green' | null) => {
  const textColor = getColorByValue(colorValue);
  const displayValue = value !== null && value !== undefined ? String(value) : '-';
  return h('span', { style: { color: textColor } }, displayValue);
};

const renderRateCell = (value: number, trend: 'up' | 'same' | 'down' | null, colorValue: 'red' | 'yellow' | 'green' | null, showDetails: boolean = false) => {
  // 后端传 0 时也要显示，仅 null/undefined 显示 '-'
  const percentage = (value !== null && value !== undefined) ? `${Number(value).toFixed(1)}%` : '-';
  const textColor = getColorByValue(colorValue);
  
  // 详情状态下不显示箭头
  if (showDetails) {
    return h('span', { style: { color: textColor } }, percentage);
  }
  
  // 非详情状态下，箭头在百分数前面，箭头没有颜色（使用默认颜色）
  let arrowIcon = '';
  if (trend === 'up') {
    arrowIcon = '↑'; // 上涨
  } else if (trend === 'same') {
    arrowIcon = '→'; // 持平
  } else if (trend === 'down') {
    arrowIcon = '↓'; // 下跌
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
  if (selectedCdcWarehouse.value.length === 0) return '仓库';
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
    logisticProviderSearch.value = ''; // 关闭时清空搜索
    fetchTableData(); // 关闭时触发请求
  } else {
    closeAllDropdowns();
    isLogisticProviderOpen.value = true;
    logisticProviderSearch.value = ''; // 打开时清空搜索
  }
};

const toggleCdcWarehouseDropdown = () => {
  if (isCdcWarehouseOpen.value) {
    isCdcWarehouseOpen.value = false;
    cdcWarehouseSearch.value = ''; // 关闭时清空搜索
    fetchTableData(); // 关闭时触发请求
  } else {
    closeAllDropdowns();
    isCdcWarehouseOpen.value = true;
    cdcWarehouseSearch.value = ''; // 打开时清空搜索
  }
};

const closeAllDropdowns = () => {
  isLogisticProviderOpen.value = false;
  isCdcWarehouseOpen.value = false;
  // 清空搜索关键词
  logisticProviderSearch.value = '';
  cdcWarehouseSearch.value = '';
};

// 选择选项（多选，不关闭下拉框）
const selectLogisticProvider = (code: string) => {
  // 如果是重置选项
  if (code === '__reset__') {
    selectedLogisticProvider.value = [];
    logisticProviderSearch.value = '';
    // 重置时不关闭下拉框，不触发请求，让用户继续选择
    return;
  }
  
  const index = selectedLogisticProvider.value.indexOf(code);
  if (index > -1) {
    selectedLogisticProvider.value.splice(index, 1);
  } else {
    selectedLogisticProvider.value.push(code);
  }
  // 多选时不关闭下拉框，不触发请求
};

const selectCdcWarehouse = (code: string) => {
  // 如果是重置选项
  if (code === '__reset__') {
    selectedCdcWarehouse.value = [];
    cdcWarehouseSearch.value = '';
    // 重置时不关闭下拉框，不触发请求，让用户继续选择
    return;
  }
  
  const index = selectedCdcWarehouse.value.indexOf(code);
  if (index > -1) {
    selectedCdcWarehouse.value.splice(index, 1);
  } else {
    selectedCdcWarehouse.value.push(code);
  }
  // 多选时不关闭下拉框，不触发请求
};


// 获取表格数据
const fetchTableData = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
    return;
  }

  try {
    loading.value = true;
    
    // 调用实际的API接口
    const params = {
      startDate: dateRange.value[0].format('YYYY-MM'),
      endDate: dateRange.value[1].format('YYYY-MM'),
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
      transType: [] as string[],
    };
    
    const result = await queryToCKpiSummary(params);
    
    if (result && result.code === 200 && result.data) {
      // 处理接口返回的数据结构
      if (Array.isArray(result.data) && result.data.length > 0) {
        // 将接口返回的数据转换为表格需要的格式
        tableData.value = result.data.map((item: any, index: number) => {
          // 基础字段映射
          const row: any = {
            key: String(index + 1),
            month:item.month || '',
            logisticProvider: item.logistic || '',
            cdcWarehouse: item.cdcWarehouse || '',
            totalScore: item.totalScore || 0,
            totalDeduction: item.totalDeduction || 0,
            deductionDesc: item.deductionDesc || '',
            totalBonus: item.totalBonus || 0,
            bonusDescription: item.bonusDescription || '',
          };

          // 从 kpi 数组中提取各个指标
          // 当前页面只使用 4 个 kpiType：
          // 28: ToC入库及时率  
          // 29: ToC出库及时率
          // 31: ToC运作差错（次数）
          // 33: ToC客户满意度
          if (Array.isArray(item.kpi)) {
            item.kpi.forEach((kpi: any) => {
              const kpiType = String(kpi.kpiType);
              
              switch (kpiType) {
                case '28': // 28.ToC入库及时率  
                  row.onTimeReceivedItemsCount = kpi.numerator;
                  row.actualGoodsCountReceived = kpi.denominator;
                  row.inventoryOnTimeRate = kpi.rate ? kpi.rate * 100 : 0; // 转换为百分比
                  row.inventoryOnTimeRateTrend = kpi.trend || null;
                  row.inventoryOnTimeRateColor = kpi.color || null;
                  row.inventoryScore = kpi.score || 0;
                  break;
                case '29': // 29:ToC出库及时率
                  row.outboundOnTimeCount = kpi.numerator;
                  row.outboundOrderTotalCount = kpi.denominator;
                  row.outboundOnTimeRate = kpi.rate ? kpi.rate * 100 : 0; // 转换为百分比
                  row.outboundOnTimeRateTrend = kpi.trend || null;
                  row.outboundOnTimeRateColor = kpi.color || null;
                  row.deliveryScore = kpi.score || 0;
                  break;
                case '31': // 31：ToC运作差错（次数）
                  row.inventoryStandardQuantity = kpi.numerator;
                  row.monthEndInventoryTotal = kpi.denominator;
                  row.operationErrorCount = kpi.rate ? kpi.rate : 0; // 转换为百分比
                  row.operationErrorCountTrend = kpi.trend || null;
                  row.operationErrorCountColor = kpi.color || null;
                  row.operationErrorScore = kpi.score || 0;
                  break;
                case '33': // 33：ToC客户满意度
                  row.CustomerSatisfactionRate = kpi.rate ? kpi.rate : 0; // 转换为百分比
                  row.CustomerSatisfactionRateTrend = kpi.trend || null;
                  row.CustomerSatisfactionRateColor = kpi.color || null;
                  row.CustomerSatisfactionScore = kpi.score || 0;
                  break;
                // 注意：其他 kpiType 不处理
              }
            });
          }

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

// 导出汇总
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
      bizType: '6',
    };
    
    const result = await exportTocLogisticKpiScoreSummary(params);
    
    // 处理导出结果
    if (result && result.code === 200) {
      // 如果返回的是文件流，创建下载链接
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1]! : `ToC物流商KPI评分汇总_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`;
        
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
    
    // 检查是否是409或504状态码
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

  try {
    exportDetailLoading.value = true;
    
    const params = {
      startDate: dateRange.value[0].format('YYYY-MM'),
      endDate: dateRange.value[1].format('YYYY-MM'),
      agg: ["LOGISTIC","CDC_WAREHOUSE","MONTH","CUSTOMER"],
      logisticName: selectedLogisticProvider.value || [],
      cdcWarehouse: selectedCdcWarehouse.value || [],
      customer: [] as string[],
      bizType: '6',
    };
    
    const result = await exportTocLogisticKpiScoreDetail(params);
    
    // 处理导出结果
    if (result && result.code === 200) {
      // 如果返回的是文件流，创建下载链接
      if (result.data) {
        const link = document.createElement('a');
        link.href = result.data;
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/);
        const downloadFilename = xlsxMatch ? xlsxMatch[1]! : `ToC物流商KPI评分明细_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`;
        
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
    
    // 检查是否是409或504状态码
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

// 监听日期范围变化
watch(dateRange, () => {
  fetchTableData();
}, { deep: true });

// 监听显示详情开关变化
watch(showDetails, () => {
  fetchTableData();
});

// 点击外部关闭下拉框
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.dropdown-item') && !target.closest('.dropdown-content')) {
    // 检查是否有下拉框打开，如果有则关闭并触发请求
    if (isLogisticProviderOpen.value || isCdcWarehouseOpen.value) {
      closeAllDropdowns();
      fetchTableData(); // 关闭时触发请求
    }
  }
};

// 计算表格滚动高度
const calculateTableScrollY = () => {
  nextTick(() => {
    if (tableSectionRef.value) {
      const containerHeight = tableSectionRef.value.clientHeight;
      // 减去一些边距和头部高度，确保有滚动条
      // 如果容器高度很大，使用一个合理的最大值，否则使用计算值
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 200;
      tableScrollY.value = calculatedHeight;
    }
  });
};

// 组件挂载
onMounted(async () => {
  // 获取物流商和CDC仓库列表（TOC传参为 '6'）
  await selectOptionsStore.fetchLogisticsByBizType('6');
  await selectOptionsStore.fetchWarehouseByBizType('6');
  await fetchTableData();
  document.addEventListener('click', handleClickOutside);
  
  // 计算表格滚动高度
  calculateTableScrollY();
  
  // 监听窗口大小变化
  window.addEventListener('resize', calculateTableScrollY);
  
  // 使用 ResizeObserver 监听容器大小变化
  if (tableSectionRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      calculateTableScrollY();
    });
    resizeObserver.observe(tableSectionRef.value);
    
    // 保存 observer 以便卸载时清理
    (tableSectionRef.value as any)._resizeObserver = resizeObserver;
  }
});

// 组件卸载
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', calculateTableScrollY);
  
  // 清理 ResizeObserver
  if (tableSectionRef.value && (tableSectionRef.value as any)._resizeObserver) {
    (tableSectionRef.value as any)._resizeObserver.disconnect();
  }
});
</script>

<template>
  <div class="toc-score-container">
    <div class="header-bar">
      <h2 class="header-title">ToC物流商KPI评分</h2>
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
            :separator="'~'"
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

        <!-- 显示详情开关 -->
        <div class="switch-item">
          <span class="switch-label">显示详情</span>
          <a-switch v-model:checked="showDetails" />
        </div>
      </div>

      <!-- 导出按钮组 -->
      <div class="action-buttons">
        <a-button 
          :loading="exportSummaryLoading"
          @click="handleExportSummary"
          class="action-btn"
        >
          导出汇总
        </a-button>
        <a-button 
          :loading="exportDetailLoading"
          @click="handleExportDetail"
          class="action-btn"
        >
          导出明细
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
.toc-score-container {
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

/* 操作按钮组 */
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

/* 表格区域 */
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
/* 表头第一行（父级表头） */
.custom-table :deep(.ant-table-thead > tr:first-child > th) {
  white-space: normal;
  word-wrap: break-word;
  word-break: break-all;
}
/* 表头子行（子级表头） */
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
