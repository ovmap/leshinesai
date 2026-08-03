/**
 * 配单价格式化
 * data 结构: { deliveryPrice: string }
 */
export function formatDryPrice(data: any): string {
  let md = `## 配单价\n\n`

  const price = data?.deliveryPrice
  if (price === undefined || price === null) {
    md += '暂无数据'
    return md
  }

  const priceNum = parseFloat(price)
  md += `- **配送单价**: ${priceNum.toFixed(2)} 元\n`

  return md
}
