/**
 * Penyimpanan state bersama untuk sinkronisasi antar perangkat.
 *
 * Protokolnya sengaja kecil:
 *   GET  /api/state?code=XXXXXXXX        -> { version, data }
 *   PUT  /api/state  { code, version, data }
 *        -> 200 { version }              bila version cocok
 *        -> 409 { version, data }        bila sudah didahului perangkat lain
 *
 * `version` adalah penghitung naik sederhana. Perangkat yang tertinggal akan
 * ditolak dan menerima kembali isi terbaru, jadi perubahan tidak ditimpa diam-diam.
 *
 * Handler-nya dibuat lewat createHandler(store) supaya bisa diuji dengan
 * penyimpanan di memori, tanpa menyalin ulang logikanya.
 */

export const config = { runtime: 'edge' }

const CODE_RE = /^[A-Z0-9]{6,12}$/
const MAX_BODY = 256 * 1024
const TTL_SECONDS = 60 * 60 * 24 * 180

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/** Penyimpanan Upstash/Vercel KV lewat REST, tanpa SDK. */
export function upstashStore() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const auth = { Authorization: `Bearer ${token}` }
  return {
    async read(key) {
      const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: auth })
      if (!res.ok) throw new Error(`store read ${res.status}`)
      const body = await res.json()
      if (body.result == null) return null
      try {
        return JSON.parse(body.result)
      } catch {
        return null
      }
    },
    async write(key, value) {
      const res = await fetch(
        `${url}/set/${encodeURIComponent(key)}?EX=${TTL_SECONDS}`,
        { method: 'POST', headers: auth, body: JSON.stringify(value) },
      )
      if (!res.ok) throw new Error(`store write ${res.status}`)
    },
  }
}

export function createHandler(getStore) {
  return async function handler(request) {
    const store = typeof getStore === 'function' ? getStore() : getStore
    if (!store) {
      return json(
        {
          error: 'not_configured',
          message:
            'Penyimpanan bersama belum dipasang. Tambahkan Upstash Redis dari Vercel Storage.',
        },
        503,
      )
    }

    const url = new URL(request.url)

    if (request.method === 'GET') {
      const code = (url.searchParams.get('code') ?? '').toUpperCase()
      if (!CODE_RE.test(code)) return json({ error: 'bad_code' }, 400)
      const doc = await store.read(`arcade250:${code}`)
      return json(doc ?? { version: 0, data: null })
    }

    if (request.method === 'PUT') {
      const raw = await request.text()
      if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413)

      let body
      try {
        body = JSON.parse(raw)
      } catch {
        return json({ error: 'bad_json' }, 400)
      }

      const code = String(body?.code ?? '').toUpperCase()
      if (!CODE_RE.test(code)) return json({ error: 'bad_code' }, 400)
      if (body?.data == null || typeof body.data !== 'object') return json({ error: 'bad_data' }, 400)

      const key = `arcade250:${code}`
      const current = (await store.read(key)) ?? { version: 0, data: null }
      const sent = Number(body.version ?? 0)

      // Perangkat yang tertinggal menerima isi terbaru, bukan menimpanya.
      if (sent !== current.version) {
        return json({ error: 'conflict', version: current.version, data: current.data }, 409)
      }

      const next = { version: current.version + 1, data: body.data }
      await store.write(key, next)
      return json({ version: next.version })
    }

    return json({ error: 'method_not_allowed' }, 405)
  }
}

export default createHandler(upstashStore)
