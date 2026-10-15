/**
 * 城配物流商KPI评分格式化
 * data: [{ month, logistic, cdcWarehouse, totalScore, kpi: [...] }]
 * kpiType: 12=SEC入库周期达标率, 1=发货及时率, 4=库存准确率, 13=准时交货率, 14=货损率,
 *          15=异常解决及时率, 43=SEC APP签收率, 16=TMS APP签收率, 17=信息签收及时性,
 *          11=返单及时率, 5=运作准确率, 18=客户满意度
 */
export function formatCityLogisticsScores(data: any, scope: string): string {
  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return '## 城配物流商KPI评分\n\n暂无数据'

  let md = `## 城配物流商KPI评分\n\n`
  md += `| 年月 | 物流商 | CDC仓库 | 得分合计 | SEC入库周期达标率 | 发货及时率 | 库存准确率 | 准时交货率 | 货损率 | 异常解决及时率 | SEC APP签收率 | TMS APP签收率 | 信息签收及时性 | 返单及时率 | 运作准确率 | 客户满意度 |\n`
  md += `|------|--------|---------|----------|-----------------|-----------|-----------|-----------|--------|--------------|-------------|-------------|--------------|-----------|-----------|----------|\n`

  list.forEach((row: any) => {
    const k = buildKpiMap(row.kpi)
    md += `| ${row.month || '-'} | ${row.logistic || '-'} | ${row.cdcWarehouse || '-'} | ${row.totalScore ?? '-'} | ${fmtRate(k[12])} | ${fmtRate(k[1])} | ${fmtRate(k[4])} | ${fmtRate(k[13])} | ${fmtRate(k[14])} | ${fmtRate(k[15])} | ${fmtRate(k[43])} | ${fmtRate(k[16])} | ${fmtRate(k[17])} | ${fmtRate(k[11])} | ${fmtRate(k[5])} | ${fmtSatisfact(k[18])} |\n`
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

function fmtSatisfact(kpi: any): string {
  if (!kpi) return '-'
  const rate = kpi.rate
  if (rate === null || rate === undefined) return '-'
  // 客户满意度是评分(0-10)，不是百分比
  return typeof rate === 'number' && rate <= 10 ? rate.toFixed(1) : String(rate)
}
