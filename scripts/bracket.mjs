/**
 * Turnamen adalah satu-satunya mesin yang bukan undian, jadi yang dijaga di
 * sini bukan keacakannya melainkan struktur bracket-nya: jumlah duel harus
 * tepat, film yang sudah kalah tidak boleh muncul lagi, dan juaranya harus
 * benar-benar film yang kamu pilih di duel terakhir.
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

const prizeEl = () => page.locator('[role="status"][aria-label^="Kamu mendapat"]')

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
await page.locator('nav button[aria-label="Mesin"]').click()
await page.waitForTimeout(600)
await page.locator('button[role="tab"][data-machine="bracket"]').click()
await page.waitForTimeout(700)

await page.locator('button:has-text("Mulai turnamen")').click()
await page.waitForTimeout(600)

const bracketSize = Number(await page.locator('[data-bracket-size]').getAttribute('data-bracket-size'))
check('turnamen 16 besar', bracketSize === 16, String(bracketSize))

const eliminated = new Set()
const roundSizes = []
let duels = 0
let lastWinner = null
let reappeared = 0

while (duels < 40) {
  if ((await prizeEl().count()) > 0) break

  const state = await page.evaluate(() => {
    const host = document.querySelector('[data-bracket-size]')
    const cards = [...host.querySelectorAll('[data-movie]')].map((c) => c.getAttribute('data-movie'))
    return { roundSize: host.getAttribute('data-round-size'), duel: host.getAttribute('data-duel'), cards }
  })
  if (state.cards.length !== 2) break

  const size = Number(state.roundSize)
  if (roundSizes[roundSizes.length - 1] !== size) roundSizes.push(size)

  // Film yang sudah kalah tidak boleh kembali ke meja.
  if (state.cards.some((id) => eliminated.has(id))) reappeared++

  const [a, b] = state.cards
  await page.locator(`button[data-movie="${a}"]`).click()
  lastWinner = a
  eliminated.add(b)
  duels++
  await page.waitForTimeout(500)
}

await prizeEl().waitFor({ timeout: 8000 })
const prizeId = await prizeEl().getAttribute('data-movie-id')

check('jumlah duel tepat 15', duels === 15, `${duels} duel`)
check('babak menyusut 16-8-4-2', roundSizes.join('-') === '16-8-4-2', roundSizes.join('-'))
check('film yang kalah tidak pernah muncul lagi', reappeared === 0, `${reappeared} kemunculan ulang`)
check('juara adalah pilihan di duel terakhir', prizeId === lastWinner, `${prizeId} vs ${lastWinner}`)
check('film yang kalah tidak jadi juara', !eliminated.has(prizeId))

await page.locator('button[aria-label="Tutup"]').click()
await page.waitForTimeout(400)
check('mesin kembali siap dimulai', (await page.locator('button:has-text("Mulai turnamen")').count()) === 1)
check('tidak ada exception JS', errors.length === 0, errors.slice(0, 3).join(' || '))

await browser.close()
console.log(fails.length ? `\n=== ${fails.length} GAGAL: ${fails.join(', ')}` : '\n=== SEMUA PEMERIKSAAN LULUS')
process.exit(fails.length ? 1 : 0)
