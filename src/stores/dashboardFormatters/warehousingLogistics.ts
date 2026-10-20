/**
 * 准时交付率(仓+物流)格式化
 * data: { heardList: string[], treeList: [{ key, childList, itemList, rateList }] }
 * 树形结构：level0=始发仓, level1=目的仓, level2=物流商
 * 动态列：heardList 去掉固定列后为时间列
 */
export function formatWarehousingLogistics(data: any, scope: string): string {
  const MAX_ROWS = 5
  let md = `## 准时交付率(仓+物流)\n\n`

  if (!data) return md + '暂无数据'

  const heardList: string[] = data.heardList || []
  const treeList: any[] = data.treeList || []
  const fixedCols = ['始发仓', '目的仓', '物流商']
  const timeCols = heardList.filter(h => !fixedCols.includes(h))

  if (!timeCols.length || !treeList.length) return md + '暂无数据'

  // 表头：固定列 + 时间列
  md += `| ${fixedCols.join(' | ')} | ${timeCols.join(' | ')} |\n`
  md += `|${fixedCols.map(() => '------').join('|')}|${timeCols.map(() => '------').join('|')}|\n`

  // 收集所有行用于计数
  const allRows: string[] = []
  function walk(items: any[], level: number, parentValues: string[]) {
    items.forEach((item: any) => {
      const currentValues = [...parentValues]
      currentValues[level] = item.key || '-'

      if (level === 2 || !item.childList?.length) {
        const fixed = [
          currentValues[0] || '-',
          currentValues[1] || '-',
          currentValues[2] || '-',
        ]
        const rates = (item.rateList || []).map((r: any) => r ?? '-')
        allRows.push(`| ${fixed.join(' | ')} | ${rates.join(' | ')} |\n`)
      }

      if (item.childList?.length) {
        walk(item.childList, level + 1, currentValues)
      }
    })
  }
  walk(treeList, 0, [])

  const totalRows = allRows.length
  allRows.slice(0, MAX_ROWS).forEach(row => { md += row })

  if (totalRows > MAX_ROWS) {
    md += `\n> 显示前 ${MAX_ROWS} 条，共 ${totalRows} 条数据\n`
  }

  return md
}
