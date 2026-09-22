/**
 * Gashapon punya dua tahap (putar lalu pecahkan) dan dua jalur masukan (seret
 * kenop atau tekan tombol), jadi yang dijaga di sini adalah: tiap putaran
 * selalu sampai ke hadiah dan mesin tidak pernah tersangkut — termasuk saat
 * kenop ditekan lalu dilepas tanpa diputar.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 430, height: 940 } })
const errors = []
const fails = []
page.on('pageerror', (e) => errors.push(e.message))
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) fails.push(name)
}

const status = async () => (await page.locator('[role="status"]').first().innerText()).trim()
const prizeEl = () => page.locator('[role="status"][aria-label^="Kamu mendapat"]')
const knob = () => page.locator('button[aria-label^="Putar kenop"]')

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
await page.locator('nav button[aria-label="Mesin"]').click()
await page.waitForTimeout(600)
await page.locator('button[role="tab"][data-machine="gacha"]').click()
await page.waitForTimeout(700)

check('kenop terpasang', (await knob().count()) === 1)
check('laci mulai kosong', (await page.locator('text=Laci kosong').count()) === 1)

let rounds = 0
let prizes = 0

async function waitReady(ms = 6000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if ((await status()).startsWith('Ketuk kapsul')) return true
    await page.waitForTimeout(150)
  }
  return false
}

// --- 1. Jalur tombol Putar ---
for (let i = 0; i < 3; i++) {
  await page.locator('button:has-text("Putar")').first().click()
  rounds++
  const ready = await waitReady()
  check(`putaran ${rounds} sampai kapsul siap`, ready, await status())
  await page.locator('button:has-text("Buka kapsul")').click()
  await prizeEl().waitFor({ timeout: 6000 })
  prizes++
  await page.locator('button[aria-label="Tutup"]').click()
  await page.waitForTimeout(350)
}

// --- 2. Jalur seret kenop, dilepas sebelum satu putaran penuh ---
const box = await knob().boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
await page.mouse.move(cx + 40, cy)
await page.mouse.down()
for (const a of [45, 90, 135]) {
  const r = (a * Math.PI) / 180
  await page.mouse.move(cx + Math.cos(r) * 40, cy + Math.sin(r) * 40)
  await page.waitForTimeout(60)
}
await page.mouse.up()
rounds++
check('seret separuh lalu lepas tetap mengeluarkan kapsul', await waitReady(), await status())
await page.locator('button:has-text("Buka kapsul")').click()
await prizeEl().waitFor({ timeout: 6000 })
prizes++
await page.locator('button[aria-label="Tutup"]').click()
await page.waitForTimeout(350)

// --- 3. Tekan kenop lalu lepas tanpa memutar sama sekali ---
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.waitForTimeout(120)
await page.mouse.up()
rounds++
check('tekan tanpa memutar tidak membuat mesin tersangkut', await waitReady(), await status())
await page.locator('button:has-text("Buka kapsul")').click()
await prizeEl().waitFor({ timeout: 6000 })
prizes++
await page.locator('button[aria-label="Tutup"]').click()
await page.waitForTimeout(500)

check('setiap putaran berujung hadiah', prizes === rounds, `${prizes} hadiah dari ${rounds} putaran`)
check('mesin kembali siap dipakai', (await status()).startsWith('Putar kenop'), await status())
check('tidak ada exception JS', errors.length === 0, errors.slice(0, 3).join(' || '))

await browser.close()
console.log(fails.length ? `\n=== ${fails.length} GAGAL: ${fails.join(', ')}` : '\n=== SEMUA PEMERIKSAAN LULUS')
process.exit(fails.length ? 1 : 0)
