/**
 * 准时交付率(联想客户)格式化
 * data: [{ reasonOne, reasonTwoName, soCount, goodsCount, deliveryRate, childList }]
 */
export function formatLenovoCustomer(data: any, scope: string): string {
  let md = `## 准时交付率(联想客户)\n\n`

  if (!data) return md + '暂无数据'

  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return md + '暂无数据'

  md += `| 原因大类 | 原因分析 | 销售订单数量 | 商品数量 | 交付率 |\n`
  md += `|----------|----------|-------------|----------|--------|\n`

  function walk(items: any[]) {
    items.forEach((item: any) => {
      md += `| ${item.reasonOne || '-'} | ${item.reasonTwoName || '-'} | ${item.soCount ?? '-'} | ${item.goodsCount ?? '-'} | ${item.deliveryRate ?? '-'} |\n`
      if (item.childList?.length) walk(item.childList)
    })
  }
  walk(list)

  return md
}
