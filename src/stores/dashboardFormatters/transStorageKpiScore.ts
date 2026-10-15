/**
 * 运输仓储多业务KPI评分格式化
 * data: [{ month, bizType, assessUnit, logistic, assessProject, weight, projectScore, finalScore }]
 */
export function formatTransStorageKpiScore(data: any, scope: string): string {
  const list = Array.isArray(data) ? data : (data?.list || data?.items || [])
  if (!list.length) return '## 运输仓储多业务KPI评分\n\n暂无数据'

  let md = `## 运输仓储多业务KPI评分\n\n`
  md += `| 年月 | 业务分类 | 考核单元 | 物流商 | 考核项目 | 权重 | 项目得分 | 最终得分 |\n`
  md += `|------|----------|----------|--------|----------|------|----------|----------|\n`

  list.forEach((row: any) => {
    md += `| ${row.month || '-'} | ${row.bizType || '-'} | ${row.assessUnit || '-'} | ${row.logistic || '-'} | ${row.assessProject || '-'} | ${row.weight ?? '-'} | ${row.projectScore ?? '-'} | ${row.finalScore ?? '-'} |\n`
  })

  return md
}
