/**
 * 签收信息格式化
 * data 结构: { signed, unsigned, detailList, detailTotal, filters }
 */
export function formatSigningInformation(data: any, scope: string): string {
  const s = data?.signed ?? 0
  const u = data?.unsigned ?? 0
  const t = s + u
  const r = t > 0 ? ((s / t) * 100).toFixed(1) : '0'

  let md = `## 签收信息\n\n`
  md += `- **已签收**: ${s.toLocaleString()} 单\n`
  md += `- **待签收**: ${u.toLocaleString()} 单\n`
  md += `- **签收率**: ${r}%\n`

  if (data?.filters) {
    const f = data.filters
    const hasFilter = f.fromWarehouse || f.toProvince || f.toRdc || f.modeType
    if (hasFilter) {
      md += `\n**当前筛选**:\n`
      if (f.fromWarehouse) md += `- 始发仓: ${f.fromWarehouse}\n`
      if (f.toProvince) md += `- 目的省: ${f.toProvince}\n`
      if (f.toRdc) md += `- 目的RDC: ${f.toRdc}\n`
      if (f.modeType) md += `- 配送模式: ${f.modeType}\n`
    }
  }

  if (scope === 'detail' || scope === 'full') {
    const list = data?.detailList || []
    if (list.length === 0) {
      md += '\n## 未签收明细\n\n暂无数据\n'
    } else {
      const total = data?.detailTotal ?? list.length
      const page = 1 // 默认第1页
      md += `\n## 未签收明细 (共 ${total} 条, 当前第 ${page} 页)\n\n`
      md += `| 始发仓 | 运输单号 | 承运商 | 目的省 | 目的市 | 配送模式 | 件数 | 体积 | 发货时间 |\n`
      md += `|--------|----------|--------|--------|--------|----------|------|------|----------|\n`
      list.slice(0, 20).forEach((row: any) => {
        md += `| ${row.fromWarehouse || ''} | ${row.transNo || ''} | ${row.carrierName || ''} | ${row.toProvince || ''} | ${row.toCity || ''} | ${row.modeType || ''} | ${row.goodsNum || ''} | ${row.volume || ''} | ${row.deliverTime || ''} |\n`
      })
      if (list.length > 20) {
        md += `\n_... 还有 ${list.length - 20} 条数据_\n`
      }
    }
  }

  return md
}
