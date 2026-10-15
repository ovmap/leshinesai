/**
 * 应签未签明细格式化
 * data: [{ warehouse, logisticName, abnormalTypeName, abnormalCode, abnormalDesc, abnormalOrderNum }]
 * warehouse 对应 RDC/CDC，logisticName 对应 配送商/承运商
 */
export function formatSignUpDetail(data: any, scope: string): string {
  let md = `## 应签未签明细\n\n`

  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return md + '暂无数据'

  md += `| RDC/CDC | 配送商/承运商 | 异常分类 | 异常代码 | 异常描述 | 应签未签数量 |\n`
  md += `|---------|-------------|----------|----------|----------|------------|\n`

  list.forEach((row: any) => {
    md += `| ${row.warehouse || '-'} | ${row.logisticName || '-'} | ${row.abnormalTypeName || '-'} | ${row.abnormalCode || '-'} | ${row.abnormalDesc || '-'} | ${row.abnormalOrderNum ?? '-'} |\n`
  })

  return md
}
