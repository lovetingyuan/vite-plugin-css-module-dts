/**
 * Vite 插件，自动为css module生成类型注释文件
 */
import type { Plugin } from 'vite'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { Buffer } from 'buffer'
import { getInlineLineMappings } from './sourcemap'

function cssModuleDTSPlugin(
  options = {
    /**
     * 表示dts输出的目录
     */
    dtsOutputDir: 'css-module-types',
  }
): Plugin {
  let rootDir = ''
  return {
    name: 'css-module-dts-generate',
    apply: 'serve',
    enforce: 'post',
    configResolved(config) {
      rootDir = config.root
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
      const lineMapping = await getInlineLineMappings(style.__vite__css)
      // const sourceCode = await extractSourcesFromCSS(style.__vite__css)
      const result: {
        line?: number
        rule: string
      }[] = []
      for (const key in style.default) {
        const hashKey = style.default[key]
        const line = lineMapping.find(v => {
          return v.generatedContent.includes('.' + hashKey) && v.originalLine
        })
        result.push({
          line: line?.originalLine,
          rule: key, // style.default[key],
        })
      }
      console.log(id, result, rootDir, path.relative(rootDir, id))
      const relativePath = path.relative(rootDir, id)
      const dirname = path.join(rootDir, options.dtsOutputDir, path.dirname(relativePath))
      mkdirSync(dirname, { recursive: true })
      const dts = [
        'declare const styles: {',
        ...result.map(item => {
          return `  /** @see {@link file:///${id}#L${item.line}} */\n  readonly ${JSON.stringify(
            item.rule
          )}: string;`
        }),
        '};',
        'export = styles;',
        '',
      ].join('\n')
      writeFileSync(path.join(rootDir, options.dtsOutputDir, relativePath + '.d.ts'), dts)
    },
  }
}

export default cssModuleDTSPlugin
