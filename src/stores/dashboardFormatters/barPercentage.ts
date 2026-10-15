/**
 * 货量占比(条形图)格式化
 * data: [{ key/name, value, rate }]
 * 模块使用 ECharts 条形图展示，这里转为表格
 */
export function formatBarPercentage(data: any, scope: string): string {
  let md = `## 货量占比\n\n`

  const list = Array.isArray(data) ? data : (data?.items || data?.list || [])
  if (!list.length) return md + '暂无数据'

  md += `| 名称 | 数值 | 占比 |\n`
  md += `|------|------|------|\n`

  list.forEach((row: any) => {
    const name = row.key || row.name || '-'
    const value = row.value ?? '-'
    const rate = row.rate !== null && row.rate !== undefined
      ? (typeof row.rate === 'string' ? row.rate : `${(parseFloat(String(row.rate)) * 100).toFixed(1)}%`)
      : '-'
    md += `| ${name} | ${value} | ${rate} |\n`
  })

  return md
}
