/**
 * 累计货量格式化
 * data 结构: { day: {...}, month: {...}, year: {...} }
 */
export function formatCargoVolume(data: any): string {
  let md = `## 累计货量\n\n`

  const periods = [
    { key: 'day', label: '日累计' },
    { key: 'month', label: '月累计' },
    { key: 'year', label: '年累计' },
  ]

  periods.forEach(({ key, label }) => {
    const d = data?.[key]
    if (!d) return

    const volume = parseFloat(d.totalVolume || '0')
    const unit = d.unit || 'm³'
    const yoy = d.yoy || '-'
    const mom = d.mom || '-'

    md += `**${label}货量**: ${volume.toLocaleString()} ${unit}\n`
    md += `- 同比: ${yoy}\n`
    md += `- 环比: ${mom}\n`
    if (d.currentDate) md += `- 统计日期: ${d.currentDate}\n`
    md += '\n'
  })

  return md.trim()
}
