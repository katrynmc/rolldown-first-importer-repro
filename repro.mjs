// Builds the same input with a 50 ms delay in the load hook for one importer
// or the other. The hook returns null, so it does not change any source or
// resolution result. It changes only the order in which modules finish
// loading. The bundle should not depend on that order.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { rolldown } from 'rolldown'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const build = async (slow) => {
  const bundle = await rolldown({
    input: 'src/entry.mjs',
    platform: 'node',
    plugins: [{
      name: 'delay',
      async load(id) {
        if (slow && id.endsWith(slow)) await sleep(50)
        return null
      },
    }],
  })
  const { output } = await bundle.generate({ format: 'cjs' })
  await bundle.close()
  return output[0].code
}

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12)
const kind = (code) => (code.includes('init_dual') ? 'ESM (__esmMin)' : 'CommonJS (__commonJSMin)')

const cases = [
  { name: 'ESM importer delayed', slow: 'esm-user.mjs', file: 'out-esm-delayed.cjs' },
  { name: 'CommonJS importer delayed', slow: 'cjs-user.cjs', file: 'out-cjs-delayed.cjs' },
  { name: 'no delay (for information)', slow: null, file: 'out-no-delay.cjs' },
]

let runtimeOk = true
for (const c of cases) {
  c.code = await build(c.slow)
  await writeFile(c.file, c.code)
  const out = execFileSync(process.execPath, [c.file], { encoding: 'utf8' }).trim()
  if (out !== '42 42') runtimeOk = false
  console.log(`${c.name.padEnd(27)} ${hash(c.code)}  dual/index.js as ${kind(c.code).padEnd(24)} runs: ${out}`)
}

const [esmDelayed, cjsDelayed] = cases
const same = esmDelayed.code === cjsDelayed.code
console.log(same ? 'OK: output does not depend on load order' : 'BUG: output depends on module load order')
console.log(runtimeOk ? 'Every bundle prints "42 42".' : 'A bundle did not print "42 42".')
process.exitCode = same && runtimeOk ? 0 : 1
