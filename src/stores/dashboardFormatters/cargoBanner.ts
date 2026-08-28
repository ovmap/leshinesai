/**
 * 运输智能体预警卡片格式化
 * data 结构: { cards: [{ title, content, rawData? }] }
 * 
 * scope 支持:
 * - 'summary': 汇总所有卡片（标题+数量+索引）
 * - 'detail:N': 输出第 N 个卡片的详情（N=0,1,2,3）
 * - 'full': 输出所有卡片的完整数据
 */
export function formatCargoBanner(data: any, scope: string): string {
  console.log('[formatter:cargoBanner] data keys:', data ? Object.keys(data) : 'null', 'scope:', scope)
  let md = `## 运输智能体预警\n\n`

  const cards = data?.cards || []
  if (!Array.isArray(cards) || cards.length === 0) {
    md += '暂无数据'
    return md
  }

  // 解析 detail:N 格式
  const detailMatch = scope.match(/^detail:(\d+)$/)
  if (detailMatch) {
    const idx = parseInt(detailMatch[1], 10)
    if (idx < 0 || idx >= cards.length) {
      md += `错误: 卡片索引 ${idx} 超出范围（0-${cards.length - 1}）`
      return md
    }
    return formatSingleCard(cards[idx], idx)
  }

  // summary: 汇总所有卡片
  if (scope === 'summary') {
    md += `共 ${cards.length} 个预警卡片：\n\n`
    cards.forEach((card: any, idx: number) => {
      const title = card.title || '未知卡片'
      const count = Array.isArray(card.content) ? card.content.length : 0
      md += `${idx}. **${title}**: ${count} 条\n`
    })
    md += `\n> 查看详情: 使用 scope='detail:N'（N=0,1,2,3）获取单个卡片详情`
    return md.trim()
  }

  // full: 输出所有卡片的完整数据
  if (scope === 'full') {
    cards.forEach((card: any, idx: number) => {
      md += formatSingleCard(card, idx, true)
      md += '\n\n---\n\n'
    })
    return md.trim()
  }

  // detail (无索引): 默认显示第一个卡片
  md += formatSingleCard(cards[0], 0)
  return md.trim()
}

/**
 * 格式化单个卡片
 */
function formatSingleCard(card: any, idx: number, showAll = false): string {
  const title = card.title || '未知卡片'
  const content = Array.isArray(card.content) ? card.content : []
  
  let md = `### [${idx}] ${title}（${content.length} 条）\n\n`
  
  if (content.length === 0) {
    md += '暂无数据\n'
    return md
  }

  // 车辆安全监控有特殊结构（rawData）
  if (title === '车辆安全监控' && card.rawData && Array.isArray(card.rawData) && card.rawData.length > 0) {
    md += `| 车牌号 | 位置 | 异常信息 | 异常时间 |\n`
    md += `|--------|------|----------|----------|\n`
    
    const items = showAll ? card.rawData : card.rawData.slice(0, 15)
    items.forEach((item: any) => {
      const carNo = item.carNo || '-'
      const location = item.location || '-'
      const abnormalMsg = item.abnormalMsg || '-'
      const abnormalTime = item.abnormalTime || '-'
      md += `| ${carNo} | ${location} | ${abnormalMsg} | ${abnormalTime} |\n`
    })
    
    if (!showAll && card.rawData.length > 15) {
      md += `\n_... 还有 ${card.rawData.length - 15} 条数据_\n`
    }
  } else {
    // 其他卡片直接显示 content 数组
    const items = showAll ? content : content.slice(0, 15)
    items.forEach((item: string) => {
      md += `${item}\n`
    })
    
    if (!showAll && content.length > 15) {
      md += `\n_... 还有 ${content.length - 15} 条数据_\n`
    }
  }
  
  return md
}
