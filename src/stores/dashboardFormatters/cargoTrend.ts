/**
 * 货量趋势格式化
 * data 结构: { timeSeries: [{ timeDimension, items: [{ dataSource, value }], totalValue, totalYoy, totalMom }], filters }
 */
export function formatCargoTrend(data: any, scope: string): string {
  const timeSeries = data?.timeSeries || []
  const filters = data?.filters || {}

  const timeTypeNames: Record<string, string> = {
    CALENDAR_YEAR: '自然年', FICAL_YEAR: '财年', CALENDAR_QUARTER: '自然季',
    FICAL_QUARTER: '财季', MONTH: '月', WEEK: '周', DAY: '日',
  }
  const metricNames: Record<string, string> = {
    VOLUME: '订单数量', WEIGHT: '重量', VOLUME_SIZE: '体积',
  }

  let md = `## 货量趋势\n\n`
  md += `- **时间维度**: ${timeTypeNames[filters.timeType] || filters.timeType || '-'}\n`
  md += `- **指标**: ${metricNames[filters.metric] || filters.metric || '-'}\n`
  md += `- **数据源**: ${Array.isArray(filters.dataSource) ? filters.dataSource.join(', ') : filters.dataSource || '全部'}\n`
  md += `- **时间范围**: ${filters.dateRange || '-'}\n\n`

  if (timeSeries.length === 0) {
    md += '_暂无数据_\n'
    return md
  }

  // 提取所有数据源
  const allSources = new Set<string>()
  timeSeries.forEach((item: any) => {
    if (item.items) {
      item.items.forEach((i: any) => allSources.add(i.dataSource))
    }
  })
  const sourceNames = Array.from(allSources)

  // 表头
  md += `| 时间段 | ${sourceNames.join(' | ')} | 合计 | 同比 | 环比 |\n`
  md += `|--------|${sourceNames.map(() => '------').join('|')}|------|------|------|\n`

  // 数据行
  timeSeries.forEach((timeItem: any) => {
    const values = sourceNames.map(code => {
      const item = timeItem.items?.find((i: any) => i.dataSource === code)
      const val = parseFloat(item?.value) || 0
      return val >= 1000 ? Math.round(val / 1000) + 'k' : val.toFixed(0)
    })
    const total = timeItem.totalValue
    const totalStr = total >= 1000 ? Math.round(total / 1000) + 'k' : total?.toFixed(0) || '0'
    const yoy = timeItem.totalYoy || '-'
    const mom = timeItem.totalMom || '-'
    md += `| ${timeItem.timeDimension} | ${values.join(' | ')} | ${totalStr} | ${yoy} | ${mom} |\n`
  })

  return md
}
