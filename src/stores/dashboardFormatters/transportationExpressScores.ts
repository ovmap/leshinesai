/**
 * 运输快递KPI评分格式化
 * data: [{ month, logistic, totalScore, totalDeduction, deductionDesc, totalBonus, bonusDescription, kpi: [...] }]
 * kpiType: 23=正向订单准时交货率, 24=正向发货及时率, 25=破损率, 26=遗失率, 27=客户满意度
 */
export function formatTransportationExpressScores(data: any, scope: string): string {
  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return '## 运输快递KPI评分\n\n暂无数据'

  let md = `## 运输快递KPI评分\n\n`
  md += `| 年月 | 物流商 | 得分合计 | 正向订单准时交货率 | 正向发货及时率 | 破损率 | 遗失率 | 客户满意度 |\n`
  md += `|------|--------|----------|-----------------|--------------|--------|--------|----------|\n`

  list.forEach((row: any) => {
    const k = buildKpiMap(row.kpi)
    md += `| ${row.month || '-'} | ${row.logistic || '-'} | ${row.totalScore ?? '-'} | ${fmtRate(k[23])} | ${fmtRate(k[24])} | ${fmtRate3(k[25])} | ${fmtRate(k[26])} | ${fmtSatisfact(k[27])} |\n`
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
  return `${(rate * 100).toFixed(1)}%`
}

function fmtRate3(kpi: any): string {
  if (!kpi) return '-'
  const rate = kpi.rate
  if (rate === null || rate === undefined) return '-'
  return `${(rate * 100).toFixed(3)}%`
}

function fmtSatisfact(kpi: any): string {
  if (!kpi) return '-'
  const rate = kpi.rate
  if (rate === null || rate === undefined) return '-'
  return typeof rate === 'number' && rate <= 10 ? rate.toFixed(1) : String(rate)
}
