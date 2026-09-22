import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const shots = process.argv[2] ?? 'screenshots'
mkdirSync(shots, { recursive: true })
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 430, height: 940 }, deviceScaleFactor: 2 })

const errors = []
const fails = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) fails.push(name)
}

const coins = async () =>
  Number((await page.locator('[aria-label$="koin tersisa"]').first().getAttribute('aria-label')).replace(/\D/g, ''))
const prizeModal = () => page.locator('[role="status"][aria-label^="Kamu mendapat"]')
const tab = (label) => page.locator(`nav button[aria-label="${label}"]`)

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2200)
await page.screenshot({ path: `${shots}/a1-beranda.png` })

check('beranda tampil', (await page.locator('h1').first().innerText()) === 'Beranda')
check('pemilih punya enam titik', (await page.locator('[aria-label^="Ke slide"]').count()) === 6)
check('pemilih punya enam kartu mesin', (await page.locator('[data-game-card]').count()) === 6)

// Baris kategori menyaring kartu mesin, bukan cuma menyorot labelnya.
await page.locator('button[data-category="kejutan"]').click()
await page.waitForTimeout(700)
const kejutan = await page.locator('[data-game-card]').count()
check('kategori mempersempit pemilih', kejutan === 2, `${kejutan} kartu untuk "Kejutan"`)
await page.locator('button[data-category="all"]').click()
await page.waitForTimeout(700)
check('kategori "Semua" mengembalikan semua', (await page.locator('[data-game-card]').count()) === 6)
check('rak konten terisi', (await page.locator('h2').count()) >= 4, `${await page.locator('h2').count()} rak`)
check('tab bar punya empat tab', (await page.locator('nav button').count()) === 4)

const startCoins = await coins()

// Masuk mesin lewat tombol hero, seperti pengguna sungguhan.
await page.locator('button[aria-label^="Mainkan"]').first().click()
await page.waitForTimeout(4200)
await page.screenshot({ path: `${shots}/a2-mesin.png` })

check('tidak ada hadiah sebelum capit', (await prizeModal().count()) === 0)
check('koin tidak berubah saat menata diri', (await coins()) === startCoins, `${startCoins} -> ${await coins()}`)

const painted = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 0; i < d.length; i += 4 * 97) if (d[i + 3] > 0 && d[i] + d[i + 1] + d[i + 2] > 30) n++
  return n
})
check('canvas menggambar kabin', painted > 1000, `${painted} sampel`)

const status = page.locator('[role="status"]').first()
const phases = new Set()
let prize = null
let drops = 0

for (let attempt = 1; attempt <= 14 && !prize; attempt++) {
  const dir = attempt % 2 === 0 ? 'ArrowLeft' : 'ArrowRight'
  await page.keyboard.down(dir)
  await page.waitForTimeout(120 + Math.random() * 600)
  await page.keyboard.up(dir)

  const before = await coins()
  await page.keyboard.press('Space')
  await page.waitForTimeout(400)
  if ((await coins()) === before) { await page.waitForTimeout(600); continue }
  drops++

  const deadline = Date.now() + 18000
  while (Date.now() < deadline) {
    if ((await prizeModal().count()) > 0) { prize = await prizeModal().getAttribute('aria-label'); break }
    const text = (await status.innerText()).trim()
    phases.add(text)
    if (text.startsWith('Geser derek') && phases.size > 1) break
    await page.waitForTimeout(200)
  }
  console.log(`  capit ${drops}: koin ${before} -> ${await coins()}${prize ? ' | ' + prize : ''}`)
}

check('capit memotong koin', drops > 0)
check('siklus derek melewati beberapa fase', phases.size >= 3, [...phases].join(' / '))
check('hadiah didapat lewat capitan', prize != null, prize ?? 'tidak ada dalam 14 percobaan')

if (prize) {
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${shots}/a3-hadiah.png` })
  await page.locator('button[aria-label="Tutup"]').click()
  await page.waitForTimeout(400)
}

// Filter
await page.locator('button:has-text("Filter")').first().click()
await page.waitForTimeout(500)
const before = (await page.locator('text=/film masuk kabin/').innerText()).trim()
await page.locator('[role="dialog"] button:has-text("Horror")').click()
await page.waitForTimeout(400)
const after = (await page.locator('text=/film masuk kabin/').innerText()).trim()
await page.screenshot({ path: `${shots}/a4-filter.png` })
check('filter mempersempit pool', before !== after, `${before} -> ${after}`)
await page.locator('[role="dialog"] button:has-text("Selesai")').click()
await page.waitForTimeout(600)
check('filter tidak memicu hadiah gratis', (await prizeModal().count()) === 0)

// Koleksi + hapus satu tangkapan tanpa mereset progres
const coinsBeforeDelete = await coins()
await tab('Koleksi').click()
await page.waitForTimeout(900)
await page.screenshot({ path: `${shots}/a5-koleksi.png` })

const beforeDelete = await page.locator('main .grid > div').count()
check('koleksi mencatat tangkapan', beforeDelete > 0, `${beforeDelete} film`)

await page.locator('button:has-text("Edit")').click()
await page.waitForTimeout(300)
check('mode edit memunculkan tombol hapus', (await page.locator('button[aria-label^="Hapus "]').count()) === beforeDelete)
await page.locator('button[aria-label^="Hapus "]').first().click()
await page.waitForTimeout(400)
const afterDelete = await page.locator('main .grid > div').count()
check('satu tangkapan terhapus', afterDelete === beforeDelete - 1, `${beforeDelete} -> ${afterDelete}`)

await tab('Mesin').click()
await page.waitForTimeout(700)
check('menghapus tangkapan tidak mengubah koin', (await coins()) === coinsBeforeDelete, `${coinsBeforeDelete} -> ${await coins()}`)
await tab('Koleksi').click()
await page.waitForTimeout(500)

// Cari
await tab('Cari').click()
await page.waitForTimeout(500)
await page.locator('input[type="search"]').fill('kubrick')
await page.waitForTimeout(500)
const hits = await page.locator('main .grid > button').count()
await page.screenshot({ path: `${shots}/a6-cari.png` })
check('pencarian menemukan hasil', hits > 0, `${hits} film untuk "kubrick"`)

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
)
check('tidak ada scroll horizontal di ponsel', overflow <= 0, `${overflow}px`)

// Kartu mesin di lebar desktop: tombol putarnya pernah hilang karena tinggi
// kartu bergantung rantai aspect-ratio -> max-height, jadi keadaan ini dikunci
// di sini — kartu utuh di layar, dan mozaik posternya tidak melebihi kartu.
await tab('Beranda').click()
await page.setViewportSize({ width: 1440, height: 900 })
await page.waitForTimeout(1200)
await page.screenshot({ path: `${shots}/a7-desktop.png` })

const hero = await page.evaluate(() => {
  const card = document.querySelector('[data-game-card][data-active="true"]')
  if (!card) return { ok: false, reason: 'kartu aktif tidak ada' }
  const art = card.querySelector('[data-art]')
  const play = card.querySelector('[data-play]')
  if (!art || !play) return { ok: false, reason: 'isi kartu tidak lengkap' }
  const r = card.getBoundingClientRect()
  const p = play.getBoundingClientRect()
  const top = document.elementFromPoint(p.x + p.width / 2, p.y + p.height / 2)
  return {
    ok: true,
    label: card.getAttribute('aria-label'),
    visible: r.width > 0 && r.height > 0 && r.y >= 0 && r.bottom <= innerHeight,
    onTop: card === top || card.contains(top),
    artOverflow: art.scrollWidth - card.clientWidth,
  }
})
check('kartu mesin aktif ada di desktop', hero.ok && hero.label.startsWith('Mainkan'), hero.reason ?? hero.label)
check('kartu mesin terlihat penuh', hero.ok && hero.visible)
check('tombol putar tidak tertimpa latar', hero.ok && hero.onTop, hero.ok ? String(hero.onTop) : '')
check('mozaik poster tidak melebihi kartu', hero.ok && hero.artOverflow <= 24, `${hero.artOverflow}px`)
check('tidak ada exception JS', errors.length === 0, errors.slice(0, 3).join(' || '))

await browser.close()
console.log(fails.length ? `\n=== ${fails.length} GAGAL: ${fails.join(', ')}` : '\n=== SEMUA PEMERIKSAAN LULUS')
process.exit(fails.length ? 1 : 0)
