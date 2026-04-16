import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const tsdownCli = path.resolve(currentDir, '../node_modules/tsdown/dist/run.mjs')

const result = spawnSync(process.execPath, [tsdownCli], {
  cwd: process.cwd(),
  encoding: 'utf8',
})

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
process.stdout.write(output)

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

const warningPattern = /Invalid input options|Expected never but received "define"|DeprecationWarning/

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

if (warningPattern.test(output)) {
  console.error('Build emitted an invalid input options warning.')
  process.exit(1)
}
