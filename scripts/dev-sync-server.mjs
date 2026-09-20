/**
 * Server lokal untuk menguji sinkronisasi tanpa Vercel.
 *
 * Yang penting: handler-nya diimpor langsung dari api/state.js, jadi yang diuji
 * adalah kode yang nanti benar-benar berjalan di produksi — hanya
 * penyimpanannya yang diganti dengan Map di memori.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { createHandler } from '../api/state.js'

const PORT = Number(process.env.PORT ?? 4180)
const ROOT = new URL('../dist/', import.meta.url).pathname

const memory = new Map()
const handler = createHandler(() => ({
  async read(key) {
    return memory.get(key) ?? null
  },
  async write(key, value) {
    memory.set(key, value)
  },
}))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/api/state') {
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: hasBody ? await readBody(req) : undefined,
    })
    const response = await handler(request)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
    return
  }

  const rel = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '')
  const file = rel === '/' || rel === '' ? 'index.html' : rel.slice(1)
  try {
    const body = await readFile(join(ROOT, file))
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    const fallback = await readFile(join(ROOT, 'index.html'))
    res.writeHead(200, { 'content-type': TYPES['.html'] })
    res.end(fallback)
  }
})

server.listen(PORT, '127.0.0.1', () => console.log(`sync-server siap di ${PORT}`))
