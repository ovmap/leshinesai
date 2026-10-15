/**
 * 提货及时率格式化
 * data: [{ customer, cdcWarehouse, month, rate, numerator, denominator }]
 * 模块内部做了透视转换：按 customer+cdcWarehouse 分组，月份展开为列
 */
export function formatPickupRate(data: any, scope: string): string {
  let md = `## 提货及时率\n\n`

  if (!data) return md + '暂无数据'

  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return md + '暂无数据'

  // 收集所有月份
  const months = new Set<string>()
  list.forEach((item: any) => { if (item.month) months.add(item.month) })
  const monthCols = [...months].sort()

  md += `| 始发仓库 | 客户 | ${monthCols.join(' | ')} |\n`
  md += `|----------|------|${monthCols.map(() => '------').join('|')}|\n`

  // 按 customer+cdcWarehouse 分组
  const groups = new Map<string, any>()
  list.forEach((item: any) => {
    const key = `${item.cdcWarehouse || ''}_${item.customer || ''}`
    if (!groups.has(key)) {
      groups.set(key, { cdcWarehouse: item.cdcWarehouse, customer: item.customer, rates: {} })
    }
    if (item.month) {
      groups.get(key).rates[item.month] = item.rate
    }
  })

  groups.forEach(g => {
    const rates = monthCols.map(m => g.rates[m] ?? '-')
    md += `| ${g.cdcWarehouse || '-'} | ${g.customer || '-'} | ${rates.join(' | ')} |\n`
  })

  return md
}
