/**
 * 干单价格式化
 * data 结构: { trunkLinePrice: string }
 */
export function formatUnitPrice(data: any): string {
  let md = `## 干单价\n\n`

  const price = data?.trunkLinePrice
  if (price === undefined || price === null) {
    md += '暂无数据'
    return md
  }

  const priceNum = parseFloat(price)
  md += `- **干线单价**: ${priceNum.toFixed(2)} 元/公里\n`

  return md
}
