/**
 * 返单及时率格式化
 * data: [{ fromwarehouse, logisticName, year, month, confirmTotal, nonCompliantOrderCount, confirmInTimeRate }]
 */
export function formatOrderRate(data: any, scope: string): string {
  let md = `## 返单及时率\n\n`

  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return md + '暂无数据'

  md += `| 仓库 | 物流商 | 年份 | 月份 | 返单总数 | 不及时订单数 | 返单及时率 |\n`
  md += `|------|--------|------|------|----------|-------------|----------|\n`

  list.forEach((row: any) => {
    const rate = row.confirmInTimeRate
    const rateStr = rate !== null && rate !== undefined
      ? (typeof rate === 'string' && rate.includes('%') ? rate : `${(parseFloat(String(rate)) * 100).toFixed(1)}%`)
      : '-'
    md += `| ${row.fromwarehouse || '-'} | ${row.logisticName || '-'} | ${row.year ?? '-'} | ${row.month ?? '-'} | ${row.confirmTotal ?? '-'} | ${row.nonCompliantOrderCount ?? '-'} | ${rateStr} |\n`
  })

  return md
}
