/**
 * Menguji janji sinkronisasi dengan dua konteks browser terpisah — dua
 * localStorage berbeda, persis seperti laptop dan HP.
 *
 * Yang dijaga: koleksi menyeberang setelah kode disambungkan, penghapusan ikut
 * menyeberang (bukan cuma penambahan), dan perangkat tanpa kode tetap terpisah.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PORT = 4181
const BASE = `http://127.0.0.1:${PORT}/`

const server = spawn(process.execPath, ['scripts/dev-sync-server.mjs'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
})
server.on('error', (e) => { console.error('spawn gagal:', e.message); process.exit(1) })
await Promise.race([
  new Promise((resolve) => server.stdout.once('data', resolve)),
  new Promise((_, reject) => setTimeout(() => reject(new Error('server tidak siap dalam 10 detik')), 10000)),
])
console.log('· server siap')

const fails = []
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) fails.push(name)
}

let browser
function shutdown() {
  try { server.kill('SIGKILL') } catch { /* sudah mati */ }
}
process.on('exit', shutdown)
process.on('SIGINT', () => { shutdown(); process.exit(130) })
process.on('SIGTERM', () => { shutdown(); process.exit(143) })
process.on('uncaughtException', (e) => { console.error('gagal:', e.message); shutdown(); process.exit(1) })

browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
console.log('· browser siap')
const errors = []

async function device(label) {
  const context = await browser.newContext({ viewport: { width: 430, height: 940 } })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`))
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  console.log(`· perangkat ${label} siap`)
  return { context, page }
}

async function openSettings(page) {
  // Tombol pengaturan kini ada di setiap layar, tapi tes tetap memakai yang
  // pertama agar tidak bergantung pada tab yang sedang terbuka.
  await page.locator('button[aria-label="Pengaturan"]').first().click()
  await page.waitForTimeout(400)
}
const closeSheet = (page) => page.locator('button[aria-label="Tutup"]').click()
const watchlistCount = async (page) => {
  await page.locator('nav button[aria-label="Koleksi"]').click()
  await page.waitForTimeout(400)
  await page.locator('button:has-text("Watchlist")').click()
  await page.waitForTimeout(400)
  return page.locator('main .grid > div').count()
}

// --- Perangkat A: buat kode, lalu tandai satu film ---
const a = await device('A')
await openSettings(a.page)
await a.page.waitForTimeout(400)
await a.page.locator('button:has-text("Buat kode sync")').click()
await a.page.waitForTimeout(900)
const code = await a.page.locator('[data-sync-code]').getAttribute('data-sync-code')
check('kode sync dibuat', !!code && /^[A-Z0-9]{8}$/.test(code), code ?? 'kosong')
const statusA = await a.page.locator('[data-sync-code]').isVisible()
check('kode tampil di pengaturan', statusA)
await closeSheet(a.page)

await a.page.locator('nav button[aria-label="Cari"]').click()
await a.page.waitForTimeout(500)
await a.page.locator('main .grid > button').first().click()
await a.page.waitForTimeout(500)
const title = await a.page.locator('[role="dialog"] h3').innerText()
await a.page.locator('button:has-text("Watchlist")').first().click()
await a.page.waitForTimeout(400)
await closeSheet(a.page)
await a.page.waitForTimeout(1600) // beri waktu pengiriman tertunda
check('perangkat A punya 1 watchlist', (await watchlistCount(a.page)) === 1, title)

// --- Perangkat B: konteks terpisah, sambungkan dengan kode yang sama ---
const b = await device('B')
check('perangkat B mulai kosong', (await watchlistCount(b.page)) === 0)
await openSettings(b.page)
await b.page.waitForTimeout(400)
await b.page.locator('input[aria-label^="Masukkan kode sync"]').fill(code)
await b.page.locator('button:has-text("Sambungkan")').click()
await b.page.waitForTimeout(1500)
await closeSheet(b.page)
check('koleksi menyeberang ke perangkat B', (await watchlistCount(b.page)) === 1)

// --- Penghapusan juga harus menyeberang ---
await a.page.locator('button:has-text("Edit")').click()
await a.page.waitForTimeout(300)
await a.page.locator('button[aria-label^="Hapus "]').first().click()
await a.page.waitForTimeout(1600)
check('perangkat A kembali kosong', (await watchlistCount(a.page)) === 0)

await b.page.reload({ waitUntil: 'domcontentloaded' })
await b.page.waitForTimeout(1800)
check('penghapusan menyeberang ke perangkat B', (await watchlistCount(b.page)) === 0)

// --- Perangkat tanpa kode tetap terpisah ---
const c = await device('C')
await openSettings(c.page)
await c.page.waitForTimeout(400)
await c.page.locator('button:has-text("Buat kode sync")').click()
await c.page.waitForTimeout(900)
const codeC = await c.page.locator('[data-sync-code]').getAttribute('data-sync-code')
check('kode tiap perangkat berbeda', codeC !== code, `${code} vs ${codeC}`)

check('tidak ada exception JS', errors.length === 0, errors.slice(0, 3).join(' || '))

await browser.close()
shutdown()
console.log(fails.length ? `\n=== ${fails.length} GAGAL: ${fails.join(', ')}` : '\n=== SEMUA PEMERIKSAAN LULUS')
process.exit(fails.length ? 1 : 0)
