/**
 * ToB物流商KPI排名格式化
 * data: [{ logistic, cdcWarehouse, rankList: [{ month, rank, totalScore, hasReward, hasPunish }] }]
 * UI 列顺序: 物流商 | 仓库 | (月份→排名|总成绩)×N | (月份→是否进行奖励|红线/重大/严重问题)×N
 */
export function formatTobWarehousingRank(data: any, scope: string): string {
  let md = `## ToB物流商KPI排名\n\n`

  const list = Array.isArray(data) ? data : (data ? [data] : [])
  if (!list.length) return md + '暂无数据'

  // 收集所有月份（降序）
  const monthSet = new Set<string>()
  list.forEach((item: any) => {
    (item.rankList || []).forEach((r: any) => { if (r.month) monthSet.add(r.month) })
  })
  const months = [...monthSet].sort((a, b) => b.localeCompare(a))
  if (!months.length) return md + '暂无数据'

  // 表头: 固定列 + 月份排名/总成绩 + 月份奖励/红线
  const fixedH = ['物流商', '仓库']
  const perfH = months.flatMap(m => [`${m}排名`, `${m}总成绩`])
  const rewardH = months.flatMap(m => [`${m}是否进行奖励`, `${m}红线/重大/严重问题`])
  const allH = [...fixedH, ...perfH, ...rewardH]

  md += `| ${allH.join(' | ')} |\n`
  md += `|${allH.map(() => '------').join('|')}|\n`

  // 按 物流商+仓库 分组
  const groups = new Map<string, any>()
  list.forEach((item: any) => {
    const key = `${item.logistic || ''}_${item.cdcWarehouse || ''}`
    if (!groups.has(key)) {
      groups.set(key, {
        logistic: item.logistic || '-',
        cdcWarehouse: item.cdcWarehouse || '-',
        rankMap: {} as Record<string, any>,
      })
    }
    ;(item.rankList || []).forEach((r: any) => {
      if (r.month) groups.get(key).rankMap[r.month] = r
    })
  })

  groups.forEach((g: any) => {
    const fixed = [g.logistic, g.cdcWarehouse]
    const perfData = months.flatMap(m => {
      const r = g.rankMap[m]
      return r ? [String(r.rank ?? '-'), String(r.totalScore ?? '-')] : ['-', '-']
    })
    const rewardData = months.flatMap(m => {
      const r = g.rankMap[m]
      if (!r) return ['-', '-']
      const reward = r.hasReward === true ? '是' : r.hasReward === false ? '否' : '-'
      const punish = r.hasPunish === true ? '是' : r.hasPunish === false ? '否' : '-'
      return [reward, punish]
    })
    md += `| ${[...fixed, ...perfData, ...rewardData].join(' | ')} |\n`
  })

  return md
}
