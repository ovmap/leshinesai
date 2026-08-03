/**
 * 运力池格式化
 * data 结构: { list: [{ logisticName, route, truckCount, truckType }] }
 */
export function formatCapacityPool(data: any, scope: string): string {
  let md = `## 运力池\n\n`

  const list = data?.list || data?.rawData || []
  if (!Array.isArray(list) || list.length === 0) {
    md += '暂无数据'
    return md
  }

  // 汇总
  const totalVehicles = list.reduce((sum: number, item: any) => sum + (item.truckCount || 0), 0)
  md += `- **物流商数量**: ${list.length} 家\n`
  md += `- **可用车辆总数**: ${totalVehicles} 台\n\n`

  // 列表
  md += `### 运力明细\n\n`
  md += `| 物流商 | 线路 | 车辆数 | 车辆类型 |\n`
  md += `|--------|------|--------|----------|\n`

  list.forEach((item: any) => {
    const name = item.logisticName || item.thirdParty || '-'
    const route = item.route || '-'
    const count = item.truckCount || item.vehicleCount || 0
    const type = item.truckType || item.vehicleType || '-'
    md += `| ${name} | ${route} | ${count} | ${type} |\n`
  })

  return md
}
