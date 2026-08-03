/**
 * 提货及时率格式化
 * data 结构: { pickupRate: string|number }
 */
export function formatOnTime(data: any): string {
  let md = `## 提货及时率\n\n`

  const rate = data?.pickupRate
  if (rate === undefined || rate === null) {
    md += '暂无数据'
    return md
  }

  const rateStr = typeof rate === 'string' && rate.includes('%')
    ? rate
    : `${Math.round(parseFloat(String(rate)))}%`

  md += `- **提货及时率**: ${rateStr}\n`

  return md
}
