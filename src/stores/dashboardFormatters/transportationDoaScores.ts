/**
 * 运输DOA KPI评分格式化
 * data: [{ month, logistic, totalScore, totalDeduction, deductionDesc, totalBonus, bonusDescription, kpi: [...] }]
 * kpiType: 19=DOA准时交货率, 20=DOA提货准时率, 21=DOA货损DPPM, 22=DOA客户满意度
 */
export function formatTransportationDoaScores(data: any, scope: string): string {
  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return '## 运输DOA KPI评分\n\n暂无数据'

  let md = `## 运输DOA KPI评分\n\n`
  md += `| 年月 | 物流商 | 总成绩 | DOA准时交货率 | DOA提货准时率 | DOA货损DPPM | DOA客户满意度 |\n`
  md += `|------|--------|--------|-------------|-------------|------------|-------------|\n`

  list.forEach((row: any) => {
    const k = buildKpiMap(row.kpi)
    md += `| ${row.month || '-'} | ${row.logistic || '-'} | ${row.totalScore ?? '-'} | ${fmtRate(k[19])} | ${fmtRate(k[20])} | ${fmtDppm(k[21])} | ${fmtSatisfact(k[22])} |\n`
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

function fmtDppm(kpi: any): string {
  if (!kpi) return '-'
  return kpi.rate ?? kpi.score ?? '-'
}

function fmtSatisfact(kpi: any): string {
  if (!kpi) return '-'
  const rate = kpi.rate
  if (rate === null || rate === undefined) return '-'
  return typeof rate === 'number' && rate <= 10 ? rate.toFixed(1) : String(rate)
}
