// Builds the same input twice. The only difference is a 50 ms delay in the
// load hook for one importer, which changes the order in which modules finish
// loading. The bundle should not depend on that order.
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

const a = await build(null)
const b = await build('cjs-user.cjs')
await writeFile('out-a.cjs', a)
await writeFile('out-b.cjs', b)

const kind = (code) => (code.includes('init_dual') ? 'ESM (__esmMin)' : 'CommonJS (__commonJSMin)')
console.log(`no delay:            ${hash(a)}  dual/index.js wrapped as ${kind(a)}`)
console.log(`cjs-user.cjs delayed: ${hash(b)}  dual/index.js wrapped as ${kind(b)}`)
console.log(a === b ? 'OK: output is the same' : 'BUG: output depends on module load order')
process.exitCode = a === b ? 0 : 1
