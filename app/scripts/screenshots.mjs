import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const phase = process.argv[2] === 'after' ? 'after' : 'before'
const outDir = path.join(root, 'docs/screenshots', phase)
fs.mkdirSync(outDir, { recursive: true })

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function runTimed(args, ms = 12000) {
  return new Promise((resolve) => {
    const child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve('timeout')
    }, ms)
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve(code === 0 ? 'ok' : `exit:${code}`)
    })
  })
}

async function shot(width, height, file) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'habit-shot-'))
  const out = path.join(outDir, file)
  if (fs.existsSync(out)) fs.unlinkSync(out)
  const status = await runTimed([
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-features=ChromeWhatsNewUI,OptimizationHints',
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    `--screenshot=${out}`,
    'http://localhost:5173/?demo=1',
  ])
  const size = fs.existsSync(out) ? fs.statSync(out).size : 0
  console.log(file, status, size)
  if (size < 1000) throw new Error(`bad screenshot ${file}`)
}

await shot(360, 800, '360.png')
await shot(1440, 900, '1440.png')
console.log(`done: docs/screenshots/${phase}/`)
