/**
 * 准时交付率格式化
 * data 结构: { deliveryRate: string|number }
 */
export function formatEndToEnd(data: any): string {
  let md = `## 准时交付率\n\n`

  const rate = data?.deliveryRate
  if (rate === undefined || rate === null) {
    md += '暂无数据'
    return md
  }

  const rateStr = typeof rate === 'string' && rate.includes('%')
    ? rate
    : `${Math.round(parseFloat(String(rate)))}%`

  md += `- **准时交付率**: ${rateStr}\n`

  return md
}
