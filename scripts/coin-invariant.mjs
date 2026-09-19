import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const coins = async () => Number((await page.locator('[aria-label$="koin tersisa"]').innerText()).replace(/\D/g, ''))
const modal = () => page.locator('[role="dialog"][aria-label^="Kamu mendapat"]')
const phase = async () => (await page.locator('[role="status"]').innerText()).trim()

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.locator('[aria-label="Mainkan MOVIE CATCHER"]').click()
await page.waitForTimeout(4200)

const start = await coins()
let drops = 0, wins = 0
console.log('koin awal:', start)

for (let i = 0; i < 10 && (await coins()) > 0; i++) {
  // tunggu mesin benar-benar menganggur
  for (let w = 0; w < 60 && !(await phase()).startsWith('Geser derek'); w++) await page.waitForTimeout(200)

  const dir = i % 2 ? 'ArrowLeft' : 'ArrowRight'
  await page.keyboard.down(dir); await page.waitForTimeout(100 + Math.random() * 600); await page.keyboard.up(dir)

  const before = await coins()
  await page.keyboard.press('Space')
  await page.waitForTimeout(500)
  if ((await coins()) === before) { console.log('  drop ditolak (mesin sibuk)'); continue }
  drops++

  // tunggu sampai mesin menganggur lagi ATAU modal muncul
  let won = false
  for (let w = 0; w < 110; w++) {
    if ((await modal().count()) > 0) { won = true; break }
    if ((await phase()).startsWith('Geser derek')) break
    await page.waitForTimeout(200)
  }
  if (won) {
    wins++
    const label = await modal().getAttribute('aria-label')
    console.log(`  drop ${drops}: MENANG — ${label.replace('Kamu mendapat ', '')} | koin ${await coins()}`)
    await page.locator('button:has-text("Tutup")').click()
    await page.waitForTimeout(300)
  } else {
    console.log(`  drop ${drops}: meleset | koin ${await coins()}`)
  }
}

await page.waitForTimeout(1200)
const finalCoins = await coins()
await page.locator('button:has-text("Koleksi")').click()
await page.waitForTimeout(700)
const rows = await page.locator('aside li').count()

const expected = start - drops + wins
console.log(`\ndrop=${drops} menang=${wins}`)
console.log(`koin: ${finalCoins}, diharapkan ${expected}  -> ${finalCoins === expected ? 'LULUS' : 'GAGAL'}`)
console.log(`riwayat: ${rows} baris, diharapkan ${wins}  -> ${rows === wins ? 'LULUS' : 'GAGAL'}`)
console.log('exception JS:', errors.length ? errors.slice(0,3).join(' || ') : 'tidak ada')
await browser.close()
process.exit(finalCoins === expected && rows === wins && errors.length === 0 ? 0 : 1)
