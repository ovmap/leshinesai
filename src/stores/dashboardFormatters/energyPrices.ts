/**
 * 能源价格趋势格式化
 * data 结构: { items: [{ month, gasoline, diesel, aircraftFuel, event }] }
 */
export function formatEnergyPrices(data: any, scope: string): string {
  let md = `## 能源价格趋势\n\n`

  const items = data?.items || []
  if (items.length === 0) {
    md += '暂无数据'
    return md
  }

  // 表头
  md += `| 月份 | 汽油 (元/吨) | 柴油 (元/吨) | 航空燃油 (元/吨) |\n`
  md += `|------|-------------|-------------|----------------|\n`

  // 数据行
  items.forEach((item: any) => {
    const month = `${item.month}月`
    const gasoline = parseFloat(item.gasoline || '0').toFixed(2)
    const diesel = parseFloat(item.diesel || '0').toFixed(2)
    const aircraftFuel = parseFloat(item.aircraftFuel || '0').toFixed(2)
    md += `| ${month} | ${gasoline} | ${diesel} | ${aircraftFuel} |\n`
  })

  // detail/full 显示关键事件
  if ((scope === 'detail' || scope === 'full') && items.some((i: any) => i.event)) {
    md += '\n### 关键事件\n\n'
    items.forEach((item: any) => {
      if (item.event) {
        md += `- **${item.month}月**: ${item.event}\n`
      }
    })
  }

  return md
}
