/**
 * 货量(表格占比)格式化
 * data: [{ value, rate, fromWarehouse, toProvince, toCity }]
 * 维度1: 始发仓&目的省份 (fromWarehouse, toProvince)
 * 维度2: 目的城市 (toCity)
 */
export function formatTablePercentage(data: any, scope: string): string {
  let md = `## 货量(表格占比)\n\n`

  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return md + '暂无数据'

  // 检测维度：有 fromWarehouse 的是维度1，有 toCity 的是维度2
  const hasDimension1 = list.some((r: any) => r.fromWarehouse !== undefined)
  const hasDimension2 = list.some((r: any) => r.toCity !== undefined)

  if (hasDimension1) {
    md += `| 排名 | 始发仓 | 目的省份 | 货量 | 占比 |\n`
    md += `|------|--------|----------|------|------|\n`
    list.forEach((row: any) => {
      const rate = row.rate !== null && row.rate !== undefined
        ? (typeof row.rate === 'string' ? row.rate : `${(parseFloat(String(row.rate)) * 100).toFixed(1)}%`)
        : '-'
      md += `| ${row.rank ?? '-'} | ${row.fromWarehouse || '-'} | ${row.toProvince || '-'} | ${row.value ?? '-'} | ${rate} |\n`
    })
  } else if (hasDimension2) {
    md += `| 排名 | 目的城市 | 货量 | 占比 |\n`
    md += `|------|----------|------|------|\n`
    list.forEach((row: any) => {
      const rate = row.rate !== null && row.rate !== undefined
        ? (typeof row.rate === 'string' ? row.rate : `${(parseFloat(String(row.rate)) * 100).toFixed(1)}%`)
        : '-'
      md += `| ${row.rank ?? '-'} | ${row.toCity || '-'} | ${row.value ?? '-'} | ${rate} |\n`
    })
  } else {
    // fallback: 通用表格
    const cols = Object.keys(list[0] || {})
    md += `| ${cols.join(' | ')} |\n`
    md += `|${cols.map(() => '------').join('|')}|\n`
    list.forEach((row: any) => {
      md += `| ${cols.map(c => row[c] ?? '-').join(' | ')} |\n`
    })
  }

  return md
}
