/**
 * 加急&重点客户风险格式化
 * data 结构: { list: [{ invoiceNo, transType, location, toProvince, predictArriveTime, riskType, hasRisk }], total }
 */
export function formatUrgentCustomer(data: any, scope: string): string {
  console.log('[formatter:urgentCustomer] data keys:', data ? Object.keys(data) : 'null', 'scope:', scope, 'data.total:', data?.total)
  let md = `## 加急&重点客户风险\n\n`

  const list = data?.list || data?.rawData || []
  if (!Array.isArray(list) || list.length === 0) {
    md += '暂无数据'
    return md
  }

  // 过滤掉无风险订单（"在途无风险"、"异常无风险"）
  const NO_RISK_TYPES = ['在途无风险', '异常无风险']
  const isRisky = (item: any) => !NO_RISK_TYPES.includes(item.riskType)
  const riskyList = list.filter(isRisky)

  // 汇总
  const riskCount = riskyList.length

  const noRiskCount = list.length - riskyList.length
  console.log('[formatter:urgentCustomer] list.length:', list.length, 'riskyCount:', riskCount, 'noRiskCount:', noRiskCount)
  md += `- **有风险订单**: ${riskCount} 条  \n- **无风险订单**: ${noRiskCount} 条`

  // summary 只输出汇总
  if (scope === 'summary') {
    return md
  }

  // 运输方式映射
  const transTypeMap: Record<string, string> = {
    '1': '公路', '2': '航空', '3': '铁路', '4': '快递',
  }

  // detail/full 输出明细：有风险的排前面，无风险的排后面
  const sortedList = [...riskyList, ...list.filter((item: any) => !isRisky(item))]

  md += `\n### 订单明细（有风险 ${riskCount} 条）\n\n`
  md += `| 发货单号 | 运输方式 | 在途位置 | 目的省市 | 预计到达 | 风险类型 |\n`
  md += `|----------|----------|----------|----------|----------|----------|\n`

  const items = scope === 'full' ? sortedList : sortedList.slice(0, 20)
  items.forEach((item: any) => {
    const invoiceNo = item.invoiceNo || '-'
    const transType = transTypeMap[String(item.transType)] || item.transType || '-'
    const location = item.location || '-'
    const toProvince = item.toProvince || '-'
    const predictTime = item.predictArriveTime || '-'
    const riskType = item.riskType || '无'
    md += `| ${invoiceNo} | ${transType} | ${location} | ${toProvince} | ${predictTime} | ${riskType} |\n`
  })

  if (scope !== 'full' && list.length > 20) {
    md += `\n_... 还有 ${list.length - 20} 条数据_\n`
  }

  return md
}
