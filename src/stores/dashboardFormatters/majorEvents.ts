/**
 * 重大活动&极端天气影响格式化
 * data 结构: { list: [{ province, city, desc, affectOrderCount }] }
 */
export function formatMajorEvents(data: any, scope: string): string {
  let md = `## 重大活动&极端天气影响\n\n`

  const list = data?.list || data?.rawData || []
  if (!Array.isArray(list) || list.length === 0) {
    md += '暂无数据'
    return md
  }

  // 汇总
  const totalAffected = list.reduce((sum: number, item: any) => sum + (item.affectOrderCount || 0), 0)
  md += `- **影响区域数**: ${list.length} 个\n`
  md += `- **影响订单总数**: ${totalAffected} 条\n\n`

  // 列表
  md += `### 影响明细\n\n`
  md += `| 区域 | 影响描述 | 影响订单数 |\n`
  md += `|------|----------|------------|\n`

  list.forEach((item: any) => {
    const province = item.province || ''
    const city = item.city || ''
    const area = city ? `${province} ${city}` : province
    const desc = item.desc || item.impact || '-'
    const count = item.affectOrderCount || item.affectedOrders || 0
    md += `| ${area} | ${desc} | ${count} |\n`
  })

  return md
}
