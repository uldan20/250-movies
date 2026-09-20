/**
 * Menjaga janji visual Case Opening: ubin yang berhenti di bawah penanda harus
 * benar-benar film yang diberikan. Kalau invarian ini pecah, animasinya
 * berbohong kepada pemain.
 *
 * Sekalian memeriksa ekonomi koinnya: mesin ini selalu memberi hadiah, jadi
 * koinnya memang terpakai dan tidak dikembalikan.
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
  Number(
    (await page.locator('[aria-label$="koin tersisa"]').first().getAttribute('aria-label')).replace(/\D/g, ''),
  )
const prizeEl = () => page.locator('[role="status"][aria-label^="Kamu mendapat"]')

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
await page.locator('nav button[aria-label="Mesin"]').click()
await page.waitForTimeout(700)
await page.locator('button[role="tab"][data-machine="case"]').click()
await page.waitForTimeout(900)

check('strip poster terpasang', (await page.locator('[data-winner] [data-movie]').count()) > 20,
  `${await page.locator('[data-winner] [data-movie]').count()} ubin`)

const start = await coins()
let spins = 0
let mismatches = 0

for (let i = 0; i < SPINS; i++) {
  await page.locator('button:has-text("Buka case")').click()
  spins++

  await prizeEl().waitFor({ timeout: 15000 })
  await page.waitForTimeout(250)

  const geom = await page.evaluate(() => {
    const strip = document.querySelector('[data-winner]')
    const viewport = strip.parentElement
    const vr = viewport.getBoundingClientRect()
    const markerX = vr.left + vr.width / 2
    const hit = [...strip.querySelectorAll('[data-movie]')].find((t) => {
      const r = t.getBoundingClientRect()
      return markerX >= r.left && markerX <= r.right
    })
    return { winner: strip.getAttribute('data-winner'), underMarker: hit?.getAttribute('data-movie') ?? null }
  })
  const prizeId = await prizeEl().getAttribute('data-movie-id')

  const ok = geom.winner === geom.underMarker && geom.underMarker === prizeId
  if (!ok) mismatches++
  console.log(
    `  putaran ${spins}: penanda=${geom.underMarker} | hadiah=${prizeId} | ${ok ? 'cocok' : 'TIDAK COCOK'}`,
  )

  await page.locator('button[aria-label="Tutup"]').click()
  await page.waitForTimeout(400)
}

check('hadiah selalu ubin yang berhenti di penanda', mismatches === 0, `${mismatches} tidak cocok dari ${spins}`)

const finalCoins = await coins()
check('koin terpakai dan tidak dikembalikan', finalCoins === start - spins, `${start} -> ${finalCoins}, diharapkan ${start - spins}`)

await page.locator('nav button[aria-label="Koleksi"]').click()
await page.waitForTimeout(800)
const rows = await page.locator('main .grid > div').count()
check('tangkapan tercatat di koleksi', rows > 0 && rows <= spins, `${rows} film unik dari ${spins} putaran`)

check('tidak ada exception JS', errors.length === 0, errors.slice(0, 3).join(' || '))
await browser.close()
console.log(fails.length ? `\n=== ${fails.length} GAGAL: ${fails.join(', ')}` : '\n=== SEMUA PEMERIKSAAN LULUS')
process.exit(fails.length ? 1 : 0)
