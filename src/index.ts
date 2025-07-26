/**
 * Vite plugin，generate .d.ts for .module.css automatically.
 */
import type { Plugin } from 'vite'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { Buffer } from 'buffer'
import { getInlineLineMappings } from './sourcemap'

/**
 * CSS注释信息接口
 */
interface CssCommentInfo {
  content: string // 注释内容（不包括/** 和 */）
  endLine: number // 注释结尾*/所在的行数（从1开始）
}

/**
 * 提取CSS文件中以/**开头的注释内容和结尾行数
 * 使用现代的 String.matchAll() 方法
 * @param cssContent CSS文件内容
 * @returns 包含注释内容和结尾行数的对象数组
 */
function extractCssComments(cssContent: string): CssCommentInfo[] {
  const regex = /\/\*\*([\s\S]*?)\*\//g
  const comments: CssCommentInfo[] = []

  for (const match of cssContent.matchAll(regex)) {
    // 获取注释内容（去除/** 和 */）
    const content = match[1].trim()

    // 计算结尾*/所在的行数
    // 从字符串开始到匹配结束位置的内容中计算换行符数量
    const textBeforeEnd = cssContent.substring(0, match.index! + match[0].length)
    const endLine = (textBeforeEnd.match(/\n/g) || []).length + 1

    comments[endLine] = {
      content,
      endLine,
    }
  }

  return comments
}

function cssModuleDTSPlugin(
  options = {
    /**
     * The output dir of *.module.css.d.ts,
     * relative path of the project root, default is "css-module-types".
     */
    dtsOutputDir: 'css-module-types',
  }
): Plugin {
  let rootDir = ''
  let cssSourceMapEnabled = false
  return {
    name: 'css-module-dts-generate',
    apply: 'serve',
    enforce: 'post',
    configResolved(config) {
      rootDir = config.root
      cssSourceMapEnabled = config.css.devSourcemap
      mkdirSync(path.join(rootDir, options.dtsOutputDir), { recursive: true })
    },

    async transform(code, id) {
      if (!id.endsWith('.module.css')) {
        return null
      }
      const compiled = code
        .replaceAll('import {', '// import {')
        .replaceAll('__vite__updateStyle', '// __vite__updateStyle')
        .replaceAll('import.meta.hot', '// import.meta.hot')
        .replaceAll('const __vite__css', 'export const __vite__css')
      const base64 = Buffer.from(compiled, 'utf-8').toString('base64')
      const style = await import(`data:text/javascript;base64,${base64}`)
      const lineMapping = cssSourceMapEnabled
        ? await getInlineLineMappings(style.__vite__css)
        : null
      const result: {
        line?: number
        rule: string
        comment: string
        value: string
      }[] = []
      const source = readFileSync(id, 'utf-8')
      const comments = cssSourceMapEnabled ? extractCssComments(source) : null
      for (const key in style.default) {
        const hashKey = style.default[key]
        const line = lineMapping?.find(v => {
          return v.generatedContent.includes('.' + hashKey) && v.originalLine
        })
        let comment = ''
        if (line?.originalLine) {
          comment = comments?.[line.originalLine - 1]?.content ?? ''
        }
        result.push({
          comment,
          line: line?.originalLine,
          rule: key, // style.default[key],
          value: hashKey,
        })
      }
      const relativePath = path.relative(rootDir, id)
      const dirname = path.join(rootDir, options.dtsOutputDir, path.dirname(relativePath))
      const fileName = path.basename(id)
      mkdirSync(dirname, { recursive: true })
      const dts = [
        'declare const styles: {',
        ...result.map(item => {
          const lineInfo = item.line ? `#L${item.line}` : ''
          const line = item.line ? ':' + item.line : ''
          const comment = item.comment ? `\`\`\`txt\n${item.comment.trim()}\n\`\`\`\n` : ''
          return [
            `  /** ${comment} [👀👉 ${fileName}${line}](file:///${id}${lineInfo}) */`,
            `  readonly ${JSON.stringify(item.rule)}: ${JSON.stringify(item.value)};`,
          ].join('\n')
        }),
        '};',
        'export = styles;',
      ].join('\n')
      writeFileSync(path.join(rootDir, options.dtsOutputDir, relativePath + '.d.ts'), dts)
    },
  }
}

export default cssModuleDTSPlugin
