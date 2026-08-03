/**
 * 能源价格卡片格式化
 * data 结构: { gasoline, gasolinePriceIsUp, diesel, dieselPriceIsUp, aircraftFuel, aircraftFuelPriceIsUp }
 */
export function formatEnergyPricesCard(data: any): string {
  let md = `## 能源价格\n\n`

  const items = [
    { name: '汽油', value: data?.gasoline, isUp: data?.gasolinePriceIsUp },
    { name: '柴油', value: data?.diesel, isUp: data?.dieselPriceIsUp },
    { name: '航空燃油', value: data?.aircraftFuel, isUp: data?.aircraftFuelPriceIsUp },
  ]

  items.forEach(({ name, value, isUp }) => {
    if (value === undefined || value === null) return
    const arrow = isUp ? '↑' : '↓'
    const trend = isUp ? '上涨' : '下跌'
    md += `- **${name}**: ${value} 元/吨 (${arrow} ${trend})\n`
  })

  return md
}
