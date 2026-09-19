import type { Movie } from '../data/types'
import { TIER_COLOR, TIER_LABEL, formatRuntime, tierOf } from './format'
import { resolvePoster } from './posters'

/** Poster dimuat dengan CORS supaya canvas tidak tercemar dan bisa diekspor. */
function loadCorsImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length === maxLines) return lines
    } else {
      line = next
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

/** Render kartu hasil 900x1400 lalu kembalikan data URL PNG. */
export async function buildShareCard(movie: Movie): Promise<string | null> {
  const W = 900
  const H = 1400
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const tier = tierOf(movie.rank)
  const accent = TIER_COLOR[tier]

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#1a0f38')
  bg.addColorStop(0.5, '#0d0820')
  bg.addColorStop(1, '#08040f')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const halo = ctx.createRadialGradient(W / 2, 260, 40, W / 2, 260, 620)
  halo.addColorStop(0, `${accent}44`)
  halo.addColorStop(1, 'transparent')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = accent
  ctx.lineWidth = 6
  ctx.strokeRect(24, 24, W - 48, H - 48)

  // kepala
  ctx.fillStyle = accent
  ctx.font = '700 30px "Space Grotesk", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('ARCADE 250', 64, 104)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '500 24px "Space Grotesk", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(TIER_LABEL[tier], W - 64, 104)

  // poster
  const hit = await resolvePoster(movie)
  const img = hit ? await loadCorsImage(hit.url) : null
  const px = 300
  const py = 160
  const pw = 300
  const ph = 450
  ctx.save()
  ctx.shadowColor = `${accent}99`
  ctx.shadowBlur = 40
  ctx.fillStyle = '#120a28'
  ctx.fillRect(px, py, pw, ph)
  ctx.restore()
  if (img) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(px, py, pw, ph)
    ctx.clip()
    const aspect = img.naturalWidth / Math.max(1, img.naturalHeight)
    let dw = pw
    let dh = pw / aspect
    if (dh < ph) {
      dh = ph
      dw = ph * aspect
    }
    ctx.drawImage(img, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh)
    ctx.restore()
  } else {
    ctx.fillStyle = accent
    ctx.font = '700 64px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`#${movie.rank}`, px + pw / 2, py + ph / 2)
  }
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.strokeRect(px, py, pw, ph)

  // peringkat
  ctx.textAlign = 'center'
  ctx.fillStyle = accent
  ctx.font = '700 120px "Space Grotesk", sans-serif'
  ctx.fillText(`#${movie.rank}`, W / 2, 740)

  // judul
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 54px "Space Grotesk", sans-serif'
  const titleLines = wrapText(ctx, movie.title, W - 160, 3)
  titleLines.forEach((line, i) => ctx.fillText(line, W / 2, 820 + i * 64))

  let y = 820 + titleLines.length * 64 + 20

  ctx.fillStyle = 'rgba(255,255,255,0.68)'
  ctx.font = '500 30px "Space Grotesk", sans-serif'
  ctx.fillText(
    `${movie.year}  ·  ${formatRuntime(movie.runtime)}  ·  ⭐ ${movie.rating.toFixed(1)}`,
    W / 2,
    y,
  )
  y += 48
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '500 26px "Space Grotesk", sans-serif'
  ctx.fillText(movie.director, W / 2, y)
  y += 40
  ctx.fillStyle = accent
  ctx.font = '500 24px "Space Grotesk", sans-serif'
  ctx.fillText(movie.genres.join('  ·  '), W / 2, y)

  y += 64
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '400 28px "Space Grotesk", sans-serif'
  wrapText(ctx, movie.synopsis, W - 160, 4).forEach((line, i) =>
    ctx.fillText(line, W / 2, y + i * 40),
  )

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '500 22px "Space Grotesk", sans-serif'
  ctx.fillText('Ditarik dari mesin capit IMDb Top 250', W / 2, H - 70)

  try {
    return canvas.toDataURL('image/png')
  } catch {
    // Canvas tercemar oleh gambar lintas-asal — tidak bisa diekspor.
    return null
  }
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
