/**
 * Menjaga aturan paling penting mesin ini: tidak pernah memberi hadiah yang
 * tidak dicapit. Kalau invarian koin di bawah pecah, ada film yang jatuh ke
 * lubang tanpa melalui capitan.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 430, height: 940 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const coins = async () =>
  Number((await page.locator('[aria-label$="koin tersisa"]').first().getAttribute('aria-label')).replace(/\D/g, ''))
const prizeModal = () => page.locator('[role="status"][aria-label^="Kamu mendapat"]')
const phase = async () => (await page.locator('[role="status"]').first().innerText()).trim()

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.locator('button:has-text("Mainkan")').first().click()
await page.waitForTimeout(4200)

const start = await coins()
let drops = 0
let wins = 0
console.log('koin awal:', start)

for (let i = 0; i < 10 && (await coins()) > 0; i++) {
  for (let w = 0; w < 60 && !(await phase()).startsWith('Geser derek'); w++) await page.waitForTimeout(200)

  const dir = i % 2 ? 'ArrowLeft' : 'ArrowRight'
  await page.keyboard.down(dir)
  await page.waitForTimeout(100 + Math.random() * 600)
  await page.keyboard.up(dir)

  const before = await coins()
  await page.keyboard.press('Space')
  await page.waitForTimeout(500)
  if ((await coins()) === before) { console.log('  capit ditolak (mesin sibuk)'); continue }
  drops++

  let won = false
  for (let w = 0; w < 110; w++) {
    if ((await prizeModal().count()) > 0) { won = true; break }
    if ((await phase()).startsWith('Geser derek')) break
    await page.waitForTimeout(200)
  }
  if (won) {
    wins++
    const label = await prizeModal().getAttribute('aria-label')
    console.log(`  capit ${drops}: MENANG — ${label.replace('Kamu mendapat ', '')} | koin ${await coins()}`)
    await page.locator('button[aria-label="Tutup"]').click()
    await page.waitForTimeout(300)
  } else {
    console.log(`  capit ${drops}: meleset | koin ${await coins()}`)
  }
}

await page.waitForTimeout(1200)
const finalCoins = await coins()
await page.locator('nav button[aria-label="Koleksi"]').click()
await page.waitForTimeout(900)
const rows = await page.locator('main .grid > div').count()

const expected = start - drops + wins
console.log(`\ncapit=${drops} menang=${wins}`)
console.log(`koin: ${finalCoins}, diharapkan ${expected}  -> ${finalCoins === expected ? 'LULUS' : 'GAGAL'}`)
console.log(`koleksi: ${rows} film, diharapkan ${wins}  -> ${rows === wins ? 'LULUS' : 'GAGAL'}`)
console.log('exception JS:', errors.length ? errors.slice(0, 3).join(' || ') : 'tidak ada')
await browser.close()
process.exit(finalCoins === expected && rows === wins && errors.length === 0 ? 0 : 1)
