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
  if (!base64) {
    return []
  }

  let rawMap: RawSourceMap
  try {
    rawMap = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as RawSourceMap
  } catch {
    return []
  }

  // 基本结构校验：source-map 规范要求 version 和 mappings 字段
  if (!rawMap || typeof rawMap !== 'object' || rawMap.version == null || rawMap.mappings == null) {
    return []
  }

  const cssLines = css.split('\n')
  const results: LineMapping[] = []

  let consumer: SourceMapConsumer | undefined
  try {
    consumer = await new SourceMapConsumer(rawMap)

    // 每一行选第一个有映射的点
    const lineToMapping = new Map<number, MappingItem>()
    consumer.eachMapping(m => {
      if (!lineToMapping.has(m.generatedLine)) {
        lineToMapping.set(m.generatedLine, m)
      }
    })

    for (let line = 1; line <= cssLines.length; line++) {
      const generatedContent = cssLines[line - 1] ?? ''
      const mapping = lineToMapping.get(line)

      let originalLine: number | undefined
      // 用 != null 而非 truthy，避免行号为 0 时被误判为无映射
      if (mapping && mapping.source != null && mapping.originalLine != null) {
        originalLine = mapping.originalLine
      }

      results.push({
        generatedLine: line,
        generatedContent,
        originalLine,
      })
    }
  } finally {
    consumer?.destroy()
  }

  return results
}
