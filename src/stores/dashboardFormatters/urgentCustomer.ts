/**
 * 加急&重点客户风险格式化
 * data 结构: { list: [{ invoiceNo, transType, location, toProvince, predictArriveTime, riskType, hasRisk }] }
 */
export function formatUrgentCustomer(data: any, scope: string): string {
  let md = `## 加急&重点客户风险\n\n`

  const list = data?.list || data?.rawData || []
  if (!Array.isArray(list) || list.length === 0) {
    md += '暂无数据'
    return md
  }

  // 汇总
  const urgentCount = list.filter((item: any) => item.hasRisk).length
  const riskCount = list.filter((item: any) => item.riskType).length

  md += `- **总订单数**: ${list.length} 条\n`
  md += `- **加急订单**: ${urgentCount} 条\n`
  md += `- **有风险订单**: ${riskCount} 条\n\n`

  // 运输方式映射
  const transTypeMap: Record<string, string> = {
    '1': '公路', '2': '航空', '3': '铁路', '4': '快递',
  }

  // 列表
  md += `### 订单明细\n\n`
  md += `| 发货单号 | 运输方式 | 在途位置 | 目的省市 | 预计到达 | 风险类型 |\n`
  md += `|----------|----------|----------|----------|----------|----------|\n`

  list.slice(0, 20).forEach((item: any) => {
    const invoiceNo = item.invoiceNo || '-'
    const transType = transTypeMap[String(item.transType)] || item.transType || '-'
    const location = item.location || '-'
    const toProvince = item.toProvince || '-'
    const predictTime = item.predictArriveTime || '-'
    const riskType = item.riskType || '无'
    md += `| ${invoiceNo} | ${transType} | ${location} | ${toProvince} | ${predictTime} | ${riskType} |\n`
  })

  if (list.length > 20) {
    md += `\n_... 还有 ${list.length - 20} 条数据_\n`
  }

  return md
}
