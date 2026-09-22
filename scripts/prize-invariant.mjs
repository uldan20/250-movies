/**
 * Menjaga aturan paling penting mesin capit: tidak pernah memberi hadiah yang
 * tidak dicapit. Dulu penjaganya penghitung koin; setelah koin dihapus, yang
 * dihitung adalah capitan yang benar-benar turun — jumlah film di koleksi
 * harus persis sama dengan jumlah capitan yang berhasil, tidak pernah lebih.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 430, height: 940 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const prizeModal = () => page.locator('[role="status"][aria-label^="Kamu mendapat"]')
const phase = async () => (await page.locator('[role="status"]').first().innerText()).trim()
const idle = async () => (await phase()).startsWith('Geser derek')

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.locator('button[aria-label^="Mainkan"]').first().click()
await page.waitForTimeout(4200)

let drops = 0
let wins = 0

// Hadiah tidak boleh muncul sebelum satu capitan pun turun.
const prizeBefore = await prizeModal().count()

for (let i = 0; i < 10; i++) {
  for (let w = 0; w < 60 && !(await idle()); w++) await page.waitForTimeout(200)

  const dir = i % 2 ? 'ArrowLeft' : 'ArrowRight'
  await page.keyboard.down(dir)
  await page.waitForTimeout(100 + Math.random() * 600)
  await page.keyboard.up(dir)

  await page.keyboard.press('Space')
  await page.waitForTimeout(500)
  // Derek masih menunggu perintah: capitan tadi tidak jadi turun.
  if (await idle()) { console.log('  capit ditolak (mesin sibuk)'); continue }
  drops++

  let won = false
  for (let w = 0; w < 110; w++) {
    if ((await prizeModal().count()) > 0) { won = true; break }
    if (await idle()) break
    await page.waitForTimeout(200)
  }
  if (won) {
    wins++
    const label = await prizeModal().getAttribute('aria-label')
    console.log(`  capit ${drops}: MENANG — ${label.replace('Kamu mendapat ', '')}`)
    await page.locator('button[aria-label="Tutup"]').click()
    await page.waitForTimeout(300)
  } else {
    console.log(`  capit ${drops}: meleset`)
  }
}

await page.waitForTimeout(1200)
await page.locator('nav button[aria-label="Koleksi"]').click()
await page.waitForTimeout(900)
const rows = await page.locator('main .grid > div').count()

console.log(`\ncapit=${drops} menang=${wins}`)
const noFreePrize = prizeBefore === 0 && wins <= drops
console.log(`hadiah tanpa capitan: ${noFreePrize ? 'tidak ada' : 'ADA'}  -> ${noFreePrize ? 'LULUS' : 'GAGAL'}`)
console.log(`koleksi: ${rows} film, diharapkan ${wins}  -> ${rows === wins ? 'LULUS' : 'GAGAL'}`)
console.log(`capitan benar-benar turun: ${drops}  -> ${drops > 0 ? 'LULUS' : 'GAGAL'}`)
console.log('exception JS:', errors.length ? errors.slice(0, 3).join(' || ') : 'tidak ada')
await browser.close()
process.exit(noFreePrize && rows === wins && drops > 0 && errors.length === 0 ? 0 : 1)
