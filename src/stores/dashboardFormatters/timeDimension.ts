/**
 * 准时交付率(时间维度)格式化
 * data: [{ columnName, eteOnTimeRate }]
 * columnName 包含多个时间维度值，eteOnTimeRate 是对应的达成率
 */
export function formatTimeDimension(data: any, scope: string): string {
  let md = `## 准时交付率(时间维度)\n\n`

  if (!data) return md + '暂无数据'

  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return md + '暂无数据'

  // 收集所有时间维度列名
  const timeCols = new Set<string>()
  list.forEach((item: any) => {
    if (item.columnName) timeCols.add(item.columnName)
  })
  const cols = [...timeCols]

  md += `| 时间维度 | 准时交付率 |\n`
  md += `|----------|----------|\n`

  list.forEach((item: any) => {
    md += `| ${item.columnName || '-'} | ${item.eteOnTimeRate ?? '-'} |\n`
  })

  return md
}
