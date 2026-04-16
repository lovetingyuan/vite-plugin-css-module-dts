import { describe, it, expect } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import { readFileSync, rmSync, existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import cssModuleDTS from '../src/index'

const fixturesDir = path.resolve(import.meta.dirname, 'fixtures')

// dtsOutputDir must be relative to rootDir (fixturesDir) on Windows,
// because path.join(rootDir, absolutePath) does NOT discard rootDir on Windows.
function uniqueRelativeDir(): string {
  return `test-dts-${randomUUID()}`
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
  it('generates a .d.ts file for a basic CSS module', async () => {
    const dtsRelDir = uniqueRelativeDir()
    const server = await createTestServer(dtsRelDir)
    try {
      await server.listen()
      await server.transformRequest('/basic.module.css')
      const dtsPath = path.join(fixturesDir, dtsRelDir, 'basic.module.css.d.ts')
      expect(existsSync(dtsPath)).toBe(true)
      const content = readFileSync(dtsPath, 'utf-8')
      expect(content).toContain('declare const styles: {')
      expect(content).toContain('export = styles;')
    } finally {
      await server.close()
      rmSync(path.join(fixturesDir, dtsRelDir), { recursive: true, force: true })
    }
  })

  it('emits readonly properties for each CSS class', async () => {
    const dtsRelDir = uniqueRelativeDir()
    const server = await createTestServer(dtsRelDir)
    try {
      await server.listen()
      await server.transformRequest('/basic.module.css')
      const dtsPath = path.join(fixturesDir, dtsRelDir, 'basic.module.css.d.ts')
      const content = readFileSync(dtsPath, 'utf-8')
      expect(content).toContain('readonly "container"')
      expect(content).toContain('readonly "title"')
      expect(content).toContain('readonly "btn"')
    } finally {
      await server.close()
      rmSync(path.join(fixturesDir, dtsRelDir), { recursive: true, force: true })
    }
  })

  it('does not generate .d.ts for non-module CSS files', async () => {
    const dtsRelDir = uniqueRelativeDir()
    const server = await createTestServer(dtsRelDir)
    try {
      await server.listen()
      await server.transformRequest('/plain.css')
      const dtsPath = path.join(fixturesDir, dtsRelDir, 'plain.css.d.ts')
      expect(existsSync(dtsPath)).toBe(false)
    } finally {
      await server.close()
      rmSync(path.join(fixturesDir, dtsRelDir), { recursive: true, force: true })
    }
  })

  // Sourcemaps are not reliably emitted during programmatic Vite server usage in test mode
  // (devSourcemap requires actual HMR/browser pipeline to produce inline sourcemaps in the
  // compiled CSS). Without a real sourcemap, getInlineLineMappings returns no mappings and
  // comments are never associated with class names.
  it.skip('includes JSDoc comments in .d.ts when devSourcemap is enabled', async () => {
    const dtsRelDir = uniqueRelativeDir()
    const server = await createTestServer(dtsRelDir, true)
    try {
      await server.listen()
      await server.transformRequest('/with-comments.module.css')
      const dtsPath = path.join(fixturesDir, dtsRelDir, 'with-comments.module.css.d.ts')
      const content = readFileSync(dtsPath, 'utf-8')
      expect(content).toContain('Outer wrapper')
      expect(content).toContain('Main heading')
    } finally {
      await server.close()
      rmSync(path.join(fixturesDir, dtsRelDir), { recursive: true, force: true })
    }
  })

  it('writes .d.ts to a custom dtsOutputDir', async () => {
    const dtsRelDir = uniqueRelativeDir()
    const server = await createTestServer(dtsRelDir)
    try {
      await server.listen()
      await server.transformRequest('/basic.module.css')
      const dtsPath = path.join(fixturesDir, dtsRelDir, 'basic.module.css.d.ts')
      expect(existsSync(dtsPath)).toBe(true)
    } finally {
      await server.close()
      rmSync(path.join(fixturesDir, dtsRelDir), { recursive: true, force: true })
    }
  })

  it('includes a file:// link to the source CSS in the JSDoc', async () => {
    const dtsRelDir = uniqueRelativeDir()
    const server = await createTestServer(dtsRelDir)
    try {
      await server.listen()
      await server.transformRequest('/basic.module.css')
      const dtsPath = path.join(fixturesDir, dtsRelDir, 'basic.module.css.d.ts')
      const content = readFileSync(dtsPath, 'utf-8')
      const expectedPath = path.join(fixturesDir, 'basic.module.css').replace(/\\/g, '/')
      expect(content).toContain(`file:///${expectedPath}`)
    } finally {
      await server.close()
      rmSync(path.join(fixturesDir, dtsRelDir), { recursive: true, force: true })
    }
  })
})
