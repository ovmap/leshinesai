/**
 * 华星物流商KPI评分格式化
 * data: [{ month, logistic, transType, deliveryPlatform, totalScore, scoreSummary, qualityDeduction, serviceDeduction, safetyDeduction, otherDeduction, otherBonus, deductionDesc, bonusDescription, kpi: [...] }]
 * kpiType: 34=提货及时率, 35=送货及时率, 36=返单及时率
 */
export function formatTclWarehousingScores(data: any, scope: string): string {
  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return '## 华星物流商KPI评分\n\n暂无数据'

  let md = `## 华星物流商KPI评分\n\n`
  md += `| 年月 | 物流商 | 运输方式 | 发货平台 | 得分合计 | 提货及时率 | 送货及时率 | 返单及时率 | 得分汇总 | 扣分项 | 扣分说明 | 加分项 | 加分说明 |\n`
  md += `|------|--------|----------|----------|----------|-----------|-----------|-----------|----------|--------|----------|--------|----------|\n`

  list.forEach((row: any) => {
    const k = buildKpiMap(row.kpi)
    md += `| ${row.month || '-'} | ${row.logistic || '-'} | ${row.transType || '-'} | ${row.deliveryPlatform || '-'} | ${row.totalScore ?? '-'} | ${fmtRate(k[34])} | ${fmtRate(k[35])} | ${fmtRate(k[36])} | ${row.scoreSummary ?? '-'} | ${row.qualityDeduction ?? row.serviceDeduction ?? '-'} | ${row.deductionDesc || '-'} | ${row.otherBonus ?? '-'} | ${row.bonusDescription || '-'} |\n`
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
