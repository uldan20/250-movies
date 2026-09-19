/**
 * Menguji resolver poster tanpa menyentuh jaringan: respons Wikipedia dipalsukan
 * supaya tiga perilaku yang mudah salah bisa dibuktikan sekaligus —
 *   1. permintaan menyertakan pilicense=any (tanpa ini poster film non-free
 *      memang tidak pernah dikembalikan Wikipedia),
 *   2. hasil pencarian tanpa thumbnail dilewati, dan pencarian diulang tanpa tahun,
 *   3. kandidat dipilih menurut peringkat `index`, bukan urutan kunci objek.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } })

const fails = []
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) fails.push(name)
}

const apiUrls = []
let withYear = 0
let withoutYear = 0

await page.route('**/en.wikipedia.org/w/api.php*', async (route) => {
  const url = route.request().url()
  apiUrls.push(url)
  const search = new URL(url).searchParams.get('gsrsearch') ?? ''

  if (/\b(19|20)\d{2}\b/.test(search)) {
    withYear++
    // Hasil teratas tanpa thumbnail sama sekali — persis kasus artikel daftar.
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ query: { pages: { 7: { index: 1, title: 'Daftar film' } } } }),
    })
  }

  withoutYear++
  // Kunci objek sengaja dibalik: index 1 harus tetap menang.
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      query: {
        pages: {
          22: { index: 2, title: 'B', thumbnail: { source: 'https://stub.test/salah.png' } },
          11: { index: 1, title: 'A', thumbnail: { source: 'https://stub.test/benar.png' } },
        },
      },
    }),
  })
})

await page.route('**/stub.test/**', (route) =>
  route.fulfill({ contentType: 'image/png', body: PNG }),
)

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3500)

check('permintaan dikirim ke Wikipedia', apiUrls.length > 0, `${apiUrls.length} permintaan`)
check(
  'semua permintaan memakai pilicense=any',
  apiUrls.length > 0 && apiUrls.every((u) => u.includes('pilicense=any')),
  apiUrls[0]?.slice(apiUrls[0].indexOf('&prop=')) ?? '',
)
check('mengambil 5 kandidat, bukan 1', apiUrls.every((u) => u.includes('gsrlimit=5')))
check('mencoba ulang tanpa tahun saat gagal', withYear > 0 && withoutYear > 0, `dengan tahun ${withYear}, tanpa tahun ${withoutYear}`)

const srcs = await page.evaluate(() =>
  [...document.querySelectorAll('img')].map((i) => i.getAttribute('src')),
)
const benar = srcs.filter((s) => s?.includes('benar.png')).length
const salah = srcs.filter((s) => s?.includes('salah.png')).length
check('poster terpasang ke halaman', benar > 0, `${benar} gambar`)
check('kandidat dipilih menurut index, bukan urutan kunci', salah === 0, `${salah} salah pilih`)

// Cache: muat ulang halaman tidak boleh memanggil API lagi untuk film yang sama.
const before = apiUrls.length
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
check('hasil di-cache, tidak memanggil ulang', apiUrls.length === before, `${apiUrls.length - before} permintaan baru`)

await browser.close()
console.log(fails.length ? `\n=== ${fails.length} GAGAL: ${fails.join(', ')}` : '\n=== SEMUA PEMERIKSAAN LULUS')
process.exit(fails.length ? 1 : 0)
