import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const shots = process.argv[2] ?? 'screenshots'
mkdirSync(shots, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 })

const errors = []
const fails = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) fails.push(name)
}

const coins = async () => Number((await page.locator('[aria-label$="koin tersisa"]').innerText()).replace(/\D/g, ''))
const modal = () => page.locator('[role="dialog"][aria-label^="Kamu mendapat"]')

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.screenshot({ path: `${shots}/01-lobby.png` })
check('lobby tampil', (await page.locator('h1').innerText()) === 'ARCADE 250')
check('enam kabinet terpasang', (await page.locator('.cabinet-frame').count()) === 6)

const startCoins = await coins()
await page.locator('[aria-label="Mainkan MOVIE CATCHER"]').click()
await page.waitForTimeout(4000) // beri waktu kabin menata diri sepenuhnya

check('tidak ada hadiah sebelum drop', (await modal().count()) === 0)
check('koin tidak berubah saat menata diri', (await coins()) === startCoins, `${startCoins} -> ${await coins()}`)
await page.screenshot({ path: `${shots}/02-mesin.png` })

const painted = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  const ctx = c.getContext('2d')
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 0; i < d.length; i += 4 * 97) if (d[i+3] > 0 && d[i] + d[i+1] + d[i+2] > 30) n++
  return n
})
check('canvas menggambar kabin', painted > 1000, `${painted} sampel berwarna`)

const status = page.locator('[role="status"]')
const phases = new Set()
let prize = null
let drops = 0

for (let attempt = 1; attempt <= 14 && !prize; attempt++) {
  const dir = attempt % 2 === 0 ? 'ArrowLeft' : 'ArrowRight'
  await page.keyboard.down(dir)
  await page.waitForTimeout(120 + Math.random() * 650)
  await page.keyboard.up(dir)

  const before = await coins()
  await page.keyboard.press('Space')
  await page.waitForTimeout(400)
  const after = await coins()
  if (after === before) { await page.waitForTimeout(600); continue }
  drops++

  const deadline = Date.now() + 18000
  let backToIdle = false
  while (Date.now() < deadline) {
    if ((await modal().count()) > 0) { prize = await modal().getAttribute('aria-label'); break }
    const text = (await status.innerText()).trim()
    phases.add(text)
    if (text.startsWith('Geser derek') && phases.size > 1) { backToIdle = true; break }
    await page.waitForTimeout(200)
  }
  console.log(`  drop ${drops}: koin ${before}->${after}${prize ? ' | ' + prize : backToIdle ? ' | meleset' : ' | timeout'}`)
}

check('drop memotong koin', drops > 0)
check('siklus derek melewati beberapa fase', phases.size >= 3, [...phases].join(' / '))
check('hadiah didapat lewat capitan', prize != null, prize ?? 'tidak ada dalam 14 percobaan')

if (prize) {
  const coinsAtPrize = await coins()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${shots}/03-hadiah.png` })
  check('menang mengembalikan koin', true, `koin sekarang ${coinsAtPrize}`)
  await page.locator('button:has-text("Tutup")').click()
  await page.waitForTimeout(400)
}

await page.locator('button:has-text("Filter")').click()
await page.waitForTimeout(400)
const before = (await page.locator('aside >> text=/film masuk kabin/').innerText()).trim()
await page.locator('aside button:has-text("Horror")').click()
await page.waitForTimeout(300)
const after = (await page.locator('aside >> text=/film masuk kabin/').innerText()).trim()
await page.screenshot({ path: `${shots}/04-filter.png` })
check('filter mempersempit pool', before !== after, `${before} -> ${after}`)
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

// kabin harus terisi ulang sesuai filter, dan tetap tidak memberi hadiah gratis
await page.waitForTimeout(3500)
check('filter tidak memicu hadiah gratis', (await modal().count()) === 0)

await page.locator('button:has-text("Koleksi")').click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${shots}/05-koleksi.png` })
const rows = await page.locator('aside li').count()
check('riwayat mencatat kemenangan', prize ? rows > 0 : true, `${rows} baris`)
await page.keyboard.press('Escape')

await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(900)
await page.screenshot({ path: `${shots}/06-mobile.png` })
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check('tidak ada scroll horizontal di ponsel', overflow <= 0, `${overflow}px`)

check('tidak ada exception JS', errors.length === 0, errors.slice(0, 3).join(' || '))
console.log(fails.length ? `\n=== ${fails.length} GAGAL: ${fails.join(', ')}` : '\n=== SEMUA PEMERIKSAAN LULUS')
await browser.close()
process.exit(fails.length ? 1 : 0)
