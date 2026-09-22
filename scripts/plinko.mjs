/**
 * Plinko membalik pola mesin lain: pemenangnya tidak ditentukan lebih dulu,
 * physics yang memilih slot. Yang harus dijaga karena itu adalah sambungannya —
 * film yang diberikan wajib film pada slot yang benar-benar kejatuhan bola.
 *
 * Sekalian memeriksa keadilannya: isi slot harus diundi ulang tiap lemparan,
 * kalau tidak slot tengah yang lebih sering kena akan terus memberi film yang
 * sama.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
const DROPS = 6

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
await page.locator('button[role="tab"][data-machine="plinko"]').click()
await page.waitForTimeout(900)

const board = page.locator('[data-slots]')
check('papan punya sembilan slot', (await board.getAttribute('data-slots')).split(',').length === 9)

let drops = 0
let mismatches = 0
const landedSlots = new Set()
const slotSets = new Set()
const winners = []

for (let i = 0; i < DROPS; i++) {
  // Geser titik jatuh supaya lintasannya bervariasi.
  const nudge = i % 2 === 0 ? 'Geser titik jatuh ke kiri' : 'Geser titik jatuh ke kanan'
  for (let n = 0; n < (i % 3); n++) {
    await page.locator(`button[aria-label="${nudge}"]`).click()
    await page.waitForTimeout(80)
  }

  await page.locator('button:has-text("Jatuhkan")').click()
  drops++
  await prizeEl().waitFor({ timeout: 20000 })
  await page.waitForTimeout(200)

  const state = await page.evaluate(() => {
    const el = document.querySelector('[data-slots]')
    return {
      slots: el.getAttribute('data-slots').split(','),
      landed: el.getAttribute('data-landed'),
    }
  })
  const prizeId = await prizeEl().getAttribute('data-movie-id')
  const slotIndex = Number(state.landed)
  const ok = state.landed !== '' && state.slots[slotIndex] === prizeId
  if (!ok) mismatches++
  landedSlots.add(state.landed)
  slotSets.add(state.slots.join(','))
  winners.push(prizeId)
  console.log(`  lemparan ${drops}: slot ${state.landed} -> ${state.slots[slotIndex]} | hadiah ${prizeId} | ${ok ? 'cocok' : 'TIDAK COCOK'}`)

  await page.locator('button[aria-label="Tutup"]').click()
  await page.waitForTimeout(400)
}

check('hadiah selalu film pada slot yang kejatuhan bola', mismatches === 0, `${mismatches} tidak cocok dari ${drops}`)
check('isi slot diundi ulang tiap lemparan', slotSets.size === drops, `${slotSets.size} susunan dari ${drops} lemparan`)
check('bola tidak selalu jatuh ke slot yang sama', landedSlots.size > 1, `${landedSlots.size} slot berbeda`)
check('tiap lemparan menghasilkan film', winners.every((w) => !!w))
check('tidak ada exception JS', errors.length === 0, errors.slice(0, 3).join(' || '))

await browser.close()
console.log(fails.length ? `\n=== ${fails.length} GAGAL: ${fails.join(', ')}` : '\n=== SEMUA PEMERIKSAAN LULUS')
process.exit(fails.length ? 1 : 0)
