/**
 * 未返单明细格式化
 * data: [{ warehouse, logisticName, billType, year, month, count }]
 * billType: 1=发票, 2=运单
 */
export function formatUdReorderProgress(data: any, scope: string): string {
  let md = `## 未返单明细\n\n`

  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return md + '暂无数据'

  md += `| 仓库 | 物流商 | 单据类型 | 年份 | 月份 | 未返单数量 |\n`
  md += `|------|--------|----------|------|------|----------|\n`

  const billTypeMap: Record<string, string> = { '1': '发票', '2': '运单' }

  list.forEach((row: any) => {
    const billType = billTypeMap[String(row.billType)] || row.billType || '-'
    md += `| ${row.warehouse || '-'} | ${row.logisticName || '-'} | ${billType} | ${row.year ?? '-'} | ${row.month ?? '-'} | ${row.count ?? '-'} |\n`
  })

  return md
}
