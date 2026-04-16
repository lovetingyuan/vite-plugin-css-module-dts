# Plugin Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vitest integration test suite that starts a real Vite dev server and verifies the plugin generates correct `.d.ts` files.

**Architecture:** Each test creates a temporary output directory, starts a `vite.createServer` instance with the plugin loaded, calls `server.transformRequest()` to trigger the `transform` hook, then asserts the written `.d.ts` file content. No source files are modified.

**Tech Stack:** Vitest, Vite `createServer`, Node.js `fs`, `os.tmpdir()`

---

## File Structure

| Path | Action | Purpose |
|------|--------|---------|
| `vitest.config.ts` | Create | Vitest config pointing at `tests/` |
| `tests/fixtures/basic.module.css` | Create | Simple CSS module, no comments |
| `tests/fixtures/with-comments.module.css` | Create | CSS module with JSDoc comments |
| `tests/fixtures/plain.css` | Create | Non-module CSS (should be ignored) |
| `tests/plugin.test.ts` | Create | All integration tests |
| `package.json` | Modify | Add `vitest` dev dependency and `test` script |

---

### Task 1: Install Vitest and create config

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install --save-dev vitest
```

Expected: `vitest` appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Update the test script in package.json**

In `package.json`, change:
```json
"test": "echo \"Error: no test specified\" && exit 1",
```
to:
```json
"test": "vitest run",
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

```bash
npm test
```

Expected output contains: `No test files found` or exits 0 with 0 tests.

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.ts
git commit -m "chore: add vitest"
```

---

### Task 2: Create test fixtures

**Files:**
- Create: `tests/fixtures/basic.module.css`
- Create: `tests/fixtures/with-comments.module.css`
- Create: `tests/fixtures/plain.css`

- [ ] **Step 1: Create basic.module.css**

```css
.container {
  max-width: 800px;
}

.title {
  font-size: 2rem;
}

.btn {
  padding: 8px 20px;
}
```

- [ ] **Step 2: Create with-comments.module.css**

```css
/**
 * Outer wrapper
 */
.container {
  max-width: 800px;
}

/**
 * Main heading
 * Used on the hero section
 */
.title {
  font-size: 2rem;
}
```

- [ ] **Step 3: Create plain.css**

```css
body {
  margin: 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/
git commit -m "test: add CSS fixtures"
```

---

### Task 3: Write failing test — basic .d.ts generation

**Files:**
- Create: `tests/plugin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import cssModuleDTS from '../src/index'

const fixturesDir = path.resolve(__dirname, 'fixtures')

async function createTestServer(
  dtsOutputDir: string,
  devSourcemap = false
): Promise<ViteDevServer> {
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
  let tmpDir: string

  afterEach(async () => {
    await server?.close()
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
  })

  it('generates a .d.ts file for a basic CSS module', async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'css-dts-'))
    server = await createTestServer(tmpDir)
    await server.listen()

    await server.transformRequest('/basic.module.css')

    const dtsPath = path.join(tmpDir, 'basic.module.css.d.ts')
    const content = readFileSync(dtsPath, 'utf-8')

    expect(content).toContain('declare const styles: {')
    expect(content).toContain('export = styles;')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — either import error or file not found.

---

### Task 4: Fix test setup and make basic test pass

The test in Task 3 may fail because `transformRequest` needs the server to be listening, and the plugin writes to `dtsOutputDir` relative to `config.root`. Adjust the test helper to use an absolute path for `dtsOutputDir` and verify the output path.

- [ ] **Step 1: Update createTestServer to pass absolute dtsOutputDir**

The plugin joins `rootDir + dtsOutputDir`, so we need `dtsOutputDir` to be a relative path from `fixturesDir` to `tmpDir`. Replace the helper:

```ts
async function createTestServer(
  tmpDir: string,
  devSourcemap = false
): Promise<ViteDevServer> {
  return createServer({
    root: fixturesDir,
    plugins: [cssModuleDTS({ dtsOutputDir: tmpDir })],
    css: { devSourcemap },
    server: { port: 0 },
    logLevel: 'silent',
  })
}
```

And update the test body:

```ts
it('generates a .d.ts file for a basic CSS module', async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'css-dts-'))
  server = await createTestServer(tmpDir)
  await server.listen()

  await server.transformRequest('/basic.module.css')

  // plugin writes to: path.join(rootDir, dtsOutputDir, relativePath + '.d.ts')
  // rootDir = fixturesDir, relativePath = 'basic.module.css'
  const dtsPath = path.join(fixturesDir, tmpDir, 'basic.module.css.d.ts')
  const content = readFileSync(dtsPath, 'utf-8')

  expect(content).toContain('declare const styles: {')
  expect(content).toContain('export = styles;')
})
```

- [ ] **Step 2: Run test**

```bash
npm test
```

Expected: PASS for the basic test.

> **Note:** If the path resolution is still wrong, read the plugin source at `src/index.ts:132-150` to trace exactly how `dtsOutputDir` is joined with `rootDir` and `relativePath`, then adjust `dtsPath` in the test accordingly.

- [ ] **Step 3: Commit**

```bash
git add tests/plugin.test.ts
git commit -m "test: basic .d.ts generation passes"
```

---

### Task 5: Test class name properties in generated .d.ts

- [ ] **Step 1: Add test for class name properties**

Add inside the `describe` block in `tests/plugin.test.ts`:

```ts
it('emits readonly properties for each CSS class', async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'css-dts-'))
  server = await createTestServer(tmpDir)
  await server.listen()

  await server.transformRequest('/basic.module.css')

  const dtsPath = path.join(fixturesDir, tmpDir, 'basic.module.css.d.ts')
  const content = readFileSync(dtsPath, 'utf-8')

  expect(content).toContain('readonly "container"')
  expect(content).toContain('readonly "title"')
  expect(content).toContain('readonly "btn"')
})
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/plugin.test.ts
git commit -m "test: verify class name properties in .d.ts"
```

---

### Task 6: Test non-module CSS is ignored

- [ ] **Step 1: Add test**

```ts
it('does not generate .d.ts for non-module CSS files', async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'css-dts-'))
  server = await createTestServer(tmpDir)
  await server.listen()

  await server.transformRequest('/plain.css')

  const dtsPath = path.join(fixturesDir, tmpDir, 'plain.css.d.ts')
  expect(() => readFileSync(dtsPath, 'utf-8')).toThrow()
})
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/plugin.test.ts
git commit -m "test: non-module CSS is ignored"
```

---

### Task 7: Test JSDoc comments appear in .d.ts (with devSourcemap)

- [ ] **Step 1: Add test**

```ts
it('includes JSDoc comments in .d.ts when devSourcemap is enabled', async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'css-dts-'))
  server = await createTestServer(tmpDir, true)
  await server.listen()

  await server.transformRequest('/with-comments.module.css')

  const dtsPath = path.join(fixturesDir, tmpDir, 'with-comments.module.css.d.ts')
  const content = readFileSync(dtsPath, 'utf-8')

  expect(content).toContain('Outer wrapper')
  expect(content).toContain('Main heading')
  expect(content).toContain('Used on the hero section')
})
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all 4 tests PASS.

> If this test fails because sourcemap is not embedded in the transformed CSS during test (Vite may not emit sourcemaps without a real browser request), check the generated `.d.ts` content and adjust expectations. The comments may not appear if Vite's CSS pipeline doesn't produce sourcemaps in this mode — in that case, document the limitation in a comment and mark the test as a known gap.

- [ ] **Step 3: Commit**

```bash
git add tests/plugin.test.ts
git commit -m "test: JSDoc comments in .d.ts with devSourcemap"
```

---

### Task 8: Test custom dtsOutputDir option

- [ ] **Step 1: Add test**

```ts
it('writes .d.ts to a custom dtsOutputDir', async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'css-dts-'))
  const customDir = path.join(tmpDir, 'my-types')
  server = await createTestServer(customDir)
  await server.listen()

  await server.transformRequest('/basic.module.css')

  const dtsPath = path.join(fixturesDir, customDir, 'basic.module.css.d.ts')
  const content = readFileSync(dtsPath, 'utf-8')

  expect(content).toContain('declare const styles: {')
})
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/plugin.test.ts
git commit -m "test: custom dtsOutputDir option"
```

---

### Task 9: Test file link in JSDoc points to source file

- [ ] **Step 1: Add test**

```ts
it('includes a file:// link to the source CSS in the JSDoc', async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'css-dts-'))
  server = await createTestServer(tmpDir)
  await server.listen()

  await server.transformRequest('/basic.module.css')

  const dtsPath = path.join(fixturesDir, tmpDir, 'basic.module.css.d.ts')
  const content = readFileSync(dtsPath, 'utf-8')

  // The plugin writes: file:///absolute/path/to/file.module.css
  expect(content).toContain('file:///')
  expect(content).toContain('basic.module.css')
})
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all 6 tests PASS.

- [ ] **Step 3: Final commit**

```bash
git add tests/plugin.test.ts
git commit -m "test: file:// link in JSDoc"
```

---

## Notes

- The plugin uses `apply: 'serve'` so it only runs in dev mode — `createServer` (not `build`) is the correct API.
- `server.transformRequest('/basic.module.css')` triggers Vite's full transform pipeline including the plugin's `transform` hook.
- The plugin writes files synchronously via `writeFileSync`, so the `.d.ts` is available immediately after `transformRequest` resolves.
- If `transformRequest` returns `null` for a fixture, check that the file URL matches what Vite expects (leading `/` relative to `root`).
