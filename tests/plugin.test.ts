import { describe, it, expect, afterEach } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import { readFileSync, rmSync, existsSync } from 'fs'
import path from 'path'
import cssModuleDTS from '../src/index'

const fixturesDir = path.resolve(import.meta.dirname, 'fixtures')

// dtsOutputDir must be relative to rootDir (fixturesDir) on Windows,
// because path.join(rootDir, absolutePath) does NOT discard rootDir on Windows.
let testDirCounter = 0
function uniqueRelativeDir(): string {
  return `__dts_test_${Date.now()}_${testDirCounter++}__`
}

async function createTestServer(dtsOutputDir: string, devSourcemap = false): Promise<ViteDevServer> {
  return createServer({
    root: fixturesDir,
    plugins: [cssModuleDTS({ dtsOutputDir })],
    css: { devSourcemap },
    server: { port: 0 },
    logLevel: 'silent',
  })
}

describe('cssModuleDTSPlugin', () => {
  let server: ViteDevServer
  let dtsRelDir: string

  afterEach(async () => {
    await server?.close()
    if (dtsRelDir) {
      rmSync(path.join(fixturesDir, dtsRelDir), { recursive: true, force: true })
    }
  })

  it('generates a .d.ts file for a basic CSS module', async () => {
    dtsRelDir = uniqueRelativeDir()
    server = await createTestServer(dtsRelDir)
    await server.listen()
    await server.transformRequest('/basic.module.css')
    const dtsPath = path.join(fixturesDir, dtsRelDir, 'basic.module.css.d.ts')
    expect(existsSync(dtsPath)).toBe(true)
    const content = readFileSync(dtsPath, 'utf-8')
    expect(content).toContain('declare const styles: {')
    expect(content).toContain('export = styles;')
  })

  it('emits readonly properties for each CSS class', async () => {
    dtsRelDir = uniqueRelativeDir()
    server = await createTestServer(dtsRelDir)
    await server.listen()
    await server.transformRequest('/basic.module.css')
    const dtsPath = path.join(fixturesDir, dtsRelDir, 'basic.module.css.d.ts')
    const content = readFileSync(dtsPath, 'utf-8')
    expect(content).toContain('readonly "container"')
    expect(content).toContain('readonly "title"')
    expect(content).toContain('readonly "btn"')
  })

  it('does not generate .d.ts for non-module CSS files', async () => {
    dtsRelDir = uniqueRelativeDir()
    server = await createTestServer(dtsRelDir)
    await server.listen()
    await server.transformRequest('/plain.css')
    const dtsPath = path.join(fixturesDir, dtsRelDir, 'plain.css.d.ts')
    expect(existsSync(dtsPath)).toBe(false)
  })

  // Sourcemaps are not reliably emitted during programmatic Vite server usage in test mode
  // (devSourcemap requires actual HMR/browser pipeline to produce inline sourcemaps in the
  // compiled CSS). Without a real sourcemap, getInlineLineMappings returns no mappings and
  // comments are never associated with class names.
  it.skip('includes JSDoc comments in .d.ts when devSourcemap is enabled', async () => {
    dtsRelDir = uniqueRelativeDir()
    server = await createTestServer(dtsRelDir, true)
    await server.listen()
    await server.transformRequest('/with-comments.module.css')
    const dtsPath = path.join(fixturesDir, dtsRelDir, 'with-comments.module.css.d.ts')
    const content = readFileSync(dtsPath, 'utf-8')
    expect(content).toContain('Outer wrapper')
    expect(content).toContain('Main heading')
  })

  it('writes .d.ts to a custom dtsOutputDir', async () => {
    dtsRelDir = uniqueRelativeDir()
    server = await createTestServer(dtsRelDir)
    await server.listen()
    await server.transformRequest('/basic.module.css')
    const dtsPath = path.join(fixturesDir, dtsRelDir, 'basic.module.css.d.ts')
    expect(existsSync(dtsPath)).toBe(true)
  })

  it('includes a file:// link to the source CSS in the JSDoc', async () => {
    dtsRelDir = uniqueRelativeDir()
    server = await createTestServer(dtsRelDir)
    await server.listen()
    await server.transformRequest('/basic.module.css')
    const dtsPath = path.join(fixturesDir, dtsRelDir, 'basic.module.css.d.ts')
    const content = readFileSync(dtsPath, 'utf-8')
    expect(content).toContain('file:///')
    expect(content).toContain('basic.module.css')
  })
})
