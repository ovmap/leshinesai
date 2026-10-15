/**
 * 运输物流商KPI评分格式化
 * data: [{ month, transType, logistic, cdcWarehouse, totalScore, kpi: [...] }]
 * kpiType: 6=干线准时交货率, 7=提货及时率, 8=干线破损率, 9=7天异常订单处理及时率, 10=信息反馈及时率, 11=返单及时率, 5=运作准确率
 */
export function formatTransportationLogisticsScores(data: any, scope: string): string {
  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return '## 运输物流商KPI评分\n\n暂无数据'

  let md = `## 运输物流商KPI评分\n\n`
  md += `| 年月 | 运输方式 | 物流商 | CDC仓库 | 得分合计 | 干线准时交货率 | 提货及时率 | 干线破损率 | 7天异常处理及时率 | 信息反馈及时率 | 返单及时率 | 运作准确率 |\n`
  md += `|------|----------|--------|---------|----------|--------------|-----------|-----------|----------------|--------------|-----------|----------|\n`

  list.forEach((row: any) => {
    const k = buildKpiMap(row.kpi)
    md += `| ${row.month || '-'} | ${row.transType || '-'} | ${row.logistic || '-'} | ${row.cdcWarehouse || '-'} | ${row.totalScore ?? '-'} | ${fmtRate(k[6])} | ${fmtRate(k[7])} | ${fmtRate(k[8])} | ${fmtRate(k[9])} | ${fmtRate(k[10])} | ${fmtRate(k[11])} | ${fmtRate(k[5])} |\n`
  })

  return md
}

function buildKpiMap(kpiList: any[]): Record<number, any> {
  const map: Record<number, any> = {}
  if (Array.isArray(kpiList)) {
    kpiList.forEach((k: any) => { if (k.kpiType) map[k.kpiType] = k })
  }
  return map
}

function fmtRate(kpi: any): string {
  if (!kpi) return '-'
  const rate = kpi.rate
  if (rate === null || rate === undefined) return '-'
  const rateStr = `${(rate * 100).toFixed(1)}%`
  // 添加趋势箭头
  const trend = kpi.trend
  if (trend === 'up') return `${rateStr} ↑`
  if (trend === 'down') return `${rateStr} ↓`
  if (trend === 'same') return `${rateStr} →`
  return rateStr
}
