import { Buffer } from 'buffer'
import { SourceMapConsumer, type RawSourceMap, type MappingItem } from 'source-map'

interface LineMapping {
  generatedLine: number
  generatedContent: string
  source?: string
  originalLine?: number
  originalContent?: string
}

export async function getInlineLineMappings(css: string): Promise<LineMapping[]> {
  const prefix = '/*# sourceMappingURL=data:application/json;base64,'
  const suffix = '*/'

  const start = css.lastIndexOf(prefix)
  const end = css.indexOf(suffix, start)
  if (start === -1 || end === -1) {
    return []
  }

  const base64 = css.slice(start + prefix.length, end).trim()

  const rawMap = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as RawSourceMap
  const cssLines = css.split('\n')

  const consumer = await new SourceMapConsumer(rawMap)

  // 构建源文件行内容
  const sourceLineMap = new Map<string, string[]>()
  if (rawMap.sources && rawMap.sourcesContent) {
    for (let i = 0; i < rawMap.sources.length; i++) {
      const src = rawMap.sources[i]
      const content = rawMap.sourcesContent[i]
      if (content) sourceLineMap.set(src, content.split('\n'))
    }
  }

  // 每一行选第一个有映射的点
  const lineToMapping = new Map<number, MappingItem>()

  consumer.eachMapping(m => {
    if (!lineToMapping.has(m.generatedLine)) {
      lineToMapping.set(m.generatedLine, m)
    }
  })

  const results: LineMapping[] = []

  for (let line = 1; line <= cssLines.length; line++) {
    const generatedContent = cssLines[line - 1]
    const mapping = lineToMapping.get(line)

    let source: string | undefined
    let originalLine: number | undefined
    // let originalContent: string | undefined

    if (mapping && mapping.source && mapping.originalLine) {
      source = mapping.source
      originalLine = mapping.originalLine

      // const srcLines = sourceLineMap.get(source)
      // if (srcLines && srcLines.length >= originalLine) {
      //   originalContent = srcLines[originalLine - 1]
      // }
    }

    results.push({
      generatedLine: line,
      generatedContent,
      // source,
      originalLine,
      // originalContent,
    })
  }

  consumer.destroy()
  return results
}
