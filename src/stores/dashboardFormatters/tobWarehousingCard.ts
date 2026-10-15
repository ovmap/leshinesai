/**
 * ToB物流商KPI评分格式化
 * data: [{ month, logistic, cdcWarehouse, totalScore, kpi: [{ kpiType, numerator, denominator, rate, score, trend, color }] }]
 * kpiType: 1=发货及时率, 2=入库及时率, 3=仓储STD达标率, 4=库存准确率, 5=运作准确率
 */
export function formatTobWarehousingCard(data: any, scope: string): string {
  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return '## ToB物流商KPI评分\n\n暂无数据'

  let md = `## ToB物流商KPI评分\n\n`
  md += `| 年月 | 物流商 | CDC仓库 | 得分合计 | 发货及时率 | 入库及时率 | 仓储STD达标率 | 库存准确率 | 运作准确率 |\n`
  md += `|------|--------|---------|----------|-----------|-----------|--------------|-----------|----------|\n`

  list.forEach((row: any) => {
    const kpiMap = buildKpiMap(row.kpi)
    md += `| ${row.month || '-'} | ${row.logistic || '-'} | ${row.cdcWarehouse || '-'} | ${row.totalScore ?? '-'} | ${fmtRate(kpiMap[1])} | ${fmtRate(kpiMap[2])} | ${fmtRate(kpiMap[3])} | ${fmtRate(kpiMap[4])} | ${fmtRate(kpiMap[5])} |\n`
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
