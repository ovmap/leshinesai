/**
 * 运输开放业务KPI评分格式化
 * data: [{ month, logistic, customer, totalScore, totalDeduction, deductionDesc, totalBonus, bonusDescription, kpi: [...] }]
 * kpiType: 38=准时交货率, 37=送货准确率, 39=货物破损率, 40=返单及时率
 */
export function formatTransportationOpenScores(data: any, scope: string): string {
  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return '## 运输开放业务KPI评分\n\n暂无数据'

  let md = `## 运输开放业务KPI评分\n\n`
  md += `| 年月 | 物流商 | 客户 | 得分合计 | 准时交货率 | 送货准确率 | 货物破损率 | 返单及时率 |\n`
  md += `|------|--------|------|----------|-----------|-----------|-----------|----------|\n`

  list.forEach((row: any) => {
    const k = buildKpiMap(row.kpi)
    md += `| ${row.month || '-'} | ${row.logistic || '-'} | ${row.customer || '-'} | ${row.totalScore ?? '-'} | ${fmtRate(k[38])} | ${fmtRate(k[37])} | ${fmtRate(k[39])} | ${fmtRate(k[40])} |\n`
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
