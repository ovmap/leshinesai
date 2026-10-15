/**
 * 地图模块格式化
 * data 结构: 地图相关数据
 */
export function formatMapPage(data: any, scope: string): string {
  let md = `## 地图\n\n`
  md += '地图模块已加载，显示物流网络分布。\n'
  return md
}
