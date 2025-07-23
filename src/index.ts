/**
 * Vite plugin，generate .d.ts for .module.css automatically.
 */
import type { Plugin } from 'vite'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { Buffer } from 'buffer'
import { getInlineLineMappings } from './sourcemap'

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
      const lineMapping = cssSourceMapEnabled ? await getInlineLineMappings(style.__vite__css) : []
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
      const relativePath = path.relative(rootDir, id)
      const dirname = path.join(rootDir, options.dtsOutputDir, path.dirname(relativePath))
      const fileName = path.basename(id)
      mkdirSync(dirname, { recursive: true })
      const dts = [
        'declare const styles: {',
        ...result.map(item => {
          const lineInfo = item.line ? `#L${item.line}` : ''
          const line = item.line ? ':' + item.line : ''
          return `  /** [👀👉 ${fileName}${line}](file:///${id}${lineInfo}) */\n  readonly ${JSON.stringify(
            item.rule
          )}: string;`
        }),
        '};',
        'export = styles;',
      ].join('\n')
      writeFileSync(path.join(rootDir, options.dtsOutputDir, relativePath + '.d.ts'), dts)
    },
  }
}

export default cssModuleDTSPlugin
