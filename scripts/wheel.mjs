/**
 * Roda Putar menjanjikan bahwa segmen di bawah jarum itulah hadiahnya. Tes ini
 * tidak mempercayai komponennya: ia membaca sudut putaran mentah dan menghitung
 * sendiri segmen mana yang berada di jam 12, lalu membandingkannya dengan
 * hadiah yang diberikan.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
const SPINS = 5

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 430, height: 940 } })
const errors = []
const fails = []
page.on('pageerror', (e) => errors.push(e.message))
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) fails.push(name)
}

const coins = async () =>
  Number((await page.locator('[aria-label$="koin tersisa"]').first().getAttribute('aria-label')).replace(/\D/g, ''))
const prizeEl = () => page.locator('[role="status"][aria-label^="Kamu mendapat"]')

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
await page.locator('nav button[aria-label="Mesin"]').click()
await page.waitForTimeout(600)
await page.locator('button[role="tab"][data-machine="wheel"]').click()
await page.waitForTimeout(800)

const segCount = await page.evaluate(
  () => document.querySelector('[data-segments]').getAttribute('data-segments').split(',').length,
)
check('roda terisi segmen', segCount > 1 && segCount <= 20, `${segCount} segmen`)

const start = await coins()
let spins = 0
let mismatches = 0

for (let i = 0; i < SPINS; i++) {
  await page.locator('button:has-text("Putar roda")').click()
  spins++
  await prizeEl().waitFor({ timeout: 20000 })
  await page.waitForTimeout(200)

  const geom = await page.evaluate(() => {
    const el = document.querySelector('[data-segments]')
    const segments = el.getAttribute('data-segments').split(',')
    const rotation = Number(el.getAttribute('data-rotation'))
    const seg = 360 / segments.length
    const idx = Math.floor(((((-rotation % 360) + 360) % 360) / seg)) % segments.length
    return { underPointer: segments[idx], rotation, idx }
  })
  const prizeId = await prizeEl().getAttribute('data-movie-id')
  const ok = geom.underPointer === prizeId
  if (!ok) mismatches++
  console.log(`  putaran ${spins}: jarum=${geom.underPointer} | hadiah=${prizeId} | ${ok ? 'cocok' : 'TIDAK COCOK'}`)

  await page.locator('button[aria-label="Tutup"]').click()
  await page.waitForTimeout(400)
}

check('hadiah selalu segmen di bawah jarum', mismatches === 0, `${mismatches} tidak cocok dari ${spins}`)
check('koin terpakai dan tidak dikembalikan', (await coins()) === start - spins, `${start} -> ${await coins()}`)
check('tidak ada exception JS', errors.length === 0, errors.slice(0, 3).join(' || '))

await browser.close()
console.log(fails.length ? `\n=== ${fails.length} GAGAL: ${fails.join(', ')}` : '\n=== SEMUA PEMERIKSAAN LULUS')
process.exit(fails.length ? 1 : 0)
