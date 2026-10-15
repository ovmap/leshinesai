/**
 * ToC物流商KPI评分格式化
 * data: [{ month, logistic, totalScore, totalDeduction, deductionDesc, totalBonus, bonusDescription, kpi: [...] }]
 * kpiType: 28=入库及时率, 29=出库及时率, 31=运作差错(次数), 33=客户满意度
 */
export function formatTocWarehousingScores(data: any, scope: string): string {
  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return '## ToC物流商KPI评分\n\n暂无数据'

  let md = `## ToC物流商KPI评分\n\n`
  md += `| 年月 | 物流商 | 得分合计 | 入库及时率 | 出库及时率 | 运作差错(次数) | 客户满意度 |\n`
  md += `|------|--------|----------|-----------|-----------|--------------|----------|\n`

  list.forEach((row: any) => {
    const k = buildKpiMap(row.kpi)
    md += `| ${row.month || '-'} | ${row.logistic || '-'} | ${row.totalScore ?? '-'} | ${fmtRate(k[28])} | ${fmtRate(k[29])} | ${fmtCount(k[31])} | ${fmtSatisfact(k[33])} |\n`
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

function fmtCount(kpi: any): string {
  if (!kpi) return '-'
  return kpi.rate ?? kpi.score ?? '-'
}

function fmtSatisfact(kpi: any): string {
  if (!kpi) return '-'
  const rate = kpi.rate
  if (rate === null || rate === undefined) return '-'
  return typeof rate === 'number' && rate <= 10 ? rate.toFixed(1) : String(rate)
}
