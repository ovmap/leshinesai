/**
 * 返单进展格式化
 * data 结构: { confirmed, notConfirm, notConfirmWithin30d, notConfirm30dTo60d, notConfirmOver60d }
 */
export function formatReorderProgress(data: any): string {
  let md = `## 返单进展\n\n`

  const confirmed = data?.confirmed || 0
  const notConfirm = data?.notConfirm || 0
  const total = confirmed + notConfirm
  const rate = total > 0 ? ((confirmed / total) * 100).toFixed(1) : '0'

  md += `- **已返单**: ${confirmed} 单\n`
  md += `- **未返单**: ${notConfirm} 单\n`
  md += `- **返单率**: ${rate}%\n\n`

  // 未返单时间分布
  md += `### 未返单时间分布\n\n`
  md += `| 时间段 | 数量 |\n`
  md += `|--------|------|\n`

  const within30d = data?.notConfirmWithin30d || 0
  const between30And60 = data?.notConfirm30dTo60d || 0
  const over60d = data?.notConfirmOver60d || 0

  md += `| 30天以内 | ${within30d} |\n`
  md += `| 30-60天 | ${between30And60} |\n`
  md += `| 60天以上 | ${over60d} |\n`

  return md
}
