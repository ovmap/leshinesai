/**
 * 应签未签格式化
 * data: 二维数组 [headers[], ...rows[]] 或普通对象数组
 * 第一行是表头，后续行是数据
 */
export function formatSignUp(data: any, scope: string): string {
  let md = `## 应签未签\n\n`

  if (!data) return md + '暂无数据'

  // 二维数组格式（API 原始返回）
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
    const headers = data[0]
    const rows = data.slice(1)
    if (!headers.length || !rows.length) return md + '暂无数据'

    md += `| ${headers.join(' | ')} |\n`
    md += `|${headers.map(() => '------').join('|')}|\n`
    rows.forEach((row: any[]) => {
      md += `| ${row.map(v => v ?? '-').join(' | ')} |\n`
    })
    return md
  }

  // 普通对象数组
  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return md + '暂无数据'

  const cols = Object.keys(list[0] || {})
  if (!cols.length) return md + '暂无数据'

  md += `| ${cols.join(' | ')} |\n`
  md += `|${cols.map(() => '------').join('|')}|\n`
  list.forEach((row: any) => {
    md += `| ${cols.map(c => row[c] ?? '-').join(' | ')} |\n`
  })

  return md
}
