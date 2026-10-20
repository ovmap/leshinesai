/**
 * CDD 周报格式化（运输准时交付率）
 * CDD（Committed Delivery Date %）：运输准时交付率
 * 接口返回 HTML 字符串，需要转为 Markdown
 */
export function formatCddWeeklyReport(data: any, scope: string): string {
  let md = `## CDD 周报（运输准时交付率）\n\n`

  if (!data) {
    md += '暂无数据\n'
    return md
  }

  // data 是 HTML 字符串
  if (typeof data === 'string') {
    md += htmlToMarkdown(data) + '\n'
    return md
  }

  // 如果 data 是对象，尝试取 data 字段
  const content = data.data || data.content || data.report || data.text
  if (content && typeof content === 'string') {
    md += htmlToMarkdown(content) + '\n'
    return md
  }

  md += '暂无数据\n'
  return md
}

/**
 * 简易 HTML 转 Markdown（针对周报类内容：p, strong, table, br, li）
 */
function htmlToMarkdown(html: string): string {
  if (!html) return ''

  let text = html

  // 处理表格
  text = convertTables(text)

  // <br> / <br/> → 换行
  text = text.replace(/<br\s*\/?>/gi, '\n')

  // <p> → 段落（前后加换行）
  text = text.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
  text = text.replace(/<p[^>]*>/gi, '')
  text = text.replace(/<\/p>/gi, '\n')

  // <strong>/<b> → **bold**
  text = text.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**')

  // <em>/<i> → *italic*
  text = text.replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*')

  // <li> → - item
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
  text = text.replace(/<\/?[uo]l[^>]*>/gi, '\n')

  // 清理剩余 HTML 标签
  text = text.replace(/<[^>]+>/g, '')

  // HTML 实体
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&quot;/g, '"')

  // 清理多余空行
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

/**
 * 转换 HTML 表格为 Markdown 表格
 */
function convertTables(html: string): string {
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi
  return html.replace(tableRegex, (_match, tableContent: string) => {
    const rows: string[][] = []
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let rowMatch

    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const cells: string[] = []
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
      let cellMatch

      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        let cellText = cellMatch[1].trim()
        // 清理单元格内的标签
        cellText = cellText.replace(/<[^>]+>/g, '').trim()
        cellText = cellText.replace(/&nbsp;/g, ' ')
        cellText = cellText.replace(/&amp;/g, '&')
        cellText = cellText.replace(/&lt;/g, '<')
        cellText = cellText.replace(/&gt;/g, '>')
        cells.push(cellText)
      }

      if (cells.length > 0) {
        rows.push(cells)
      }
    }

    if (rows.length === 0) return ''

    // 生成 Markdown 表格
    let md = '\n'
    // 表头
    md += '| ' + rows[0].join(' | ') + ' |\n'
    // 分隔线
    md += '| ' + rows[0].map(() => '---').join(' | ') + ' |\n'
    // 数据行
    for (let i = 1; i < rows.length; i++) {
      md += '| ' + rows[i].join(' | ') + ' |\n'
    }
    md += '\n'
    return md
  })
}
