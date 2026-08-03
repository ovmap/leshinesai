/**
 * 运输异常格式化
 * data 结构: { rawData: [{ abnormalType, abnormalTypeName, abnormalInfoList }] }
 */
export function formatAbnormalTransportation(data: any, scope: string): string {
  let md = `## 运输异常\n\n`

  const rawData = data?.rawData || data || []
  if (!Array.isArray(rawData) || rawData.length === 0) {
    md += '暂无数据'
    return md
  }

  // 汇总
  let totalCount = 0
  rawData.forEach((group: any) => {
    group.abnormalInfoList?.forEach((info: any) => {
      totalCount += info.abnormalNum || 0
    })
  })

  md += `- **异常总数**: ${totalCount} 条\n\n`

  // 按类型分组
  md += `### 异常分类\n\n`
  md += `| 异常类型 | 异常天数 | 数量 | 分类占比 | 整体占比 |\n`
  md += `|----------|----------|------|----------|----------|\n`

  rawData.forEach((group: any) => {
    const typeName = group.abnormalTypeName || '未知'
    group.abnormalInfoList?.forEach((info: any) => {
      const days = info.abnormalDays || '-'
      const num = info.abnormalNum || 0
      const classifyRate = ((info.classifyRate || 0) * 100).toFixed(1) + '%'
      const overallRate = ((info.overallRate || 0) * 100).toFixed(1) + '%'
      md += `| ${typeName} | ${days} | ${num} | ${classifyRate} | ${overallRate} |\n`
    })
  })

  return md
}
