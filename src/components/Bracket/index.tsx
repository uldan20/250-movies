import { useCallback, useMemo, useState } from 'react'
import type { Movie } from '../../data/types'
import { formatRuntime } from '../../lib/format'
import { sample } from '../../lib/rng'
import { buzz, sfx } from '../../lib/sound'
import PosterImage from '../PosterImage'

type Props = {
  pool: Movie[]
  coins: number
  onSpend: () => void
  onPrize: (movie: Movie) => void
  onInsertCoin: () => void
  onOpenFilters: () => void
}

const FULL_SIZE = 16

const ROUND_LABEL: Record<number, string> = {
  16: '16 Besar',
  8: 'Perempat Final',
  4: 'Semifinal',
  2: 'Final',
}

/** Turnamen butuh jumlah peserta berupa pangkat dua. */
function bracketSize(poolSize: number): number {
  let size = 2
  while (size * 2 <= Math.min(FULL_SIZE, poolSize)) size *= 2
  return size
}

export default function Bracket({
  pool,
  coins,
  onSpend,
  onPrize,
  onInsertCoin,
  onOpenFilters,
}: Props) {
  /** Peserta babak yang sedang berjalan. Kosong berarti turnamen belum dimulai. */
  const [entrants, setEntrants] = useState<Movie[]>([])
  const [winners, setWinners] = useState<Movie[]>([])
  const [picked, setPicked] = useState<string | null>(null)

  const size = bracketSize(pool.length)
  const running = entrants.length > 0
  const canStart = !running && coins > 0 && size >= 2

  // Pasangan duel ditentukan oleh berapa banyak pemenang yang sudah terkumpul
  // di babak ini — tidak ada penghitung terpisah yang bisa melenceng.
  const duelIndex = winners.length
  const left = entrants[duelIndex * 2]
  const right = entrants[duelIndex * 2 + 1]

  const totalDuels = useMemo(() => (size >= 2 ? size - 1 : 0), [size])
  const duelsDone = useMemo(() => {
    if (!running) return 0
    // Semua babak sebelumnya sudah selesai seluruhnya.
    let done = 0
    for (let n = size; n > entrants.length; n /= 2) done += n / 2
    return done + winners.length
  }, [entrants.length, running, size, winners.length])

  const start = useCallback(() => {
    if (!canStart) return
    onSpend()
    sfx.coin()
    setEntrants(sample(pool, size))
    setWinners([])
    setPicked(null)
  }, [canStart, onSpend, pool, size])

  const pick = useCallback(
    (movie: Movie) => {
      if (!running || picked) return
      setPicked(movie.id)
      sfx.click()
      buzz(12)

      window.setTimeout(() => {
        const nextWinners = [...winners, movie]
        setPicked(null)

        if (nextWinners.length * 2 < entrants.length) {
          setWinners(nextWinners)
          return
        }

        if (nextWinners.length === 1) {
          // Juara: peserta terakhir yang kamu pilih.
          sfx.drop()
          buzz([20, 30, 60])
          setEntrants([])
          setWinners([])
          onPrize(nextWinners[0])
          return
        }

        setEntrants(nextWinners)
        setWinners([])
      }, 260)
    },
    [entrants.length, onPrize, picked, running, winners],
  )

  const abandon = useCallback(() => {
    if (!window.confirm('Batalkan turnamen? Koin yang sudah dipakai tidak kembali.')) return
    sfx.fail()
    setEntrants([])
    setWinners([])
    setPicked(null)
  }, [])

  function Card({ movie }: { movie: Movie }) {
    const isPicked = picked === movie.id
    const isLoser = picked != null && !isPicked
    return (
      <button
        onClick={() => pick(movie)}
        disabled={picked != null}
        data-movie={movie.id}
        aria-label={`Pilih ${movie.title} (${movie.year})`}
        className="min-w-0 flex-1 text-left transition-all duration-200"
        style={{
          transform: isPicked ? 'scale(1.03)' : 'none',
          opacity: isLoser ? 0.3 : 1,
        }}
      >
        <PosterImage
          movie={movie}
          className="aspect-[2/3] w-full"
          rounded={isPicked ? 'rounded-[8px] ring-2 ring-signal-blue' : 'rounded-[8px]'}
        />
        <p className="t-body-sm mt-2 line-clamp-2 font-medium text-frost">{movie.title}</p>
        <p className="t-caption mt-0.5 text-mist">
          {movie.year} · {formatRuntime(movie.runtime)}
        </p>
        <p className="t-caption mt-0.5 text-mist">⭐ {movie.rating.toFixed(1)} · #{movie.rank}</p>
      </button>
    )
  }

  const blocked = size < 2 || coins === 0

  return (
    <div
      className="mx-auto w-full max-w-md px-5"
      data-bracket-size={running ? String(size) : ''}
      data-round-size={running ? String(entrants.length) : ''}
      data-duel={running ? String(duelIndex) : ''}
    >
      <div className="relative overflow-hidden rounded-[8px] border border-hairline bg-black p-5">
        {running && left && right ? (
          <>
            <div className="mb-1 flex items-baseline justify-between">
              <p className="t-eyebrow text-signal-blue">
                {ROUND_LABEL[entrants.length] ?? `${entrants.length} Besar`}
              </p>
              <p className="t-caption text-mist">
                Duel {duelsDone + 1} dari {totalDuels}
              </p>
            </div>

            {/* kemajuan turnamen */}
            <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-slate">
              <div
                className="h-full bg-signal-blue transition-[width] duration-300"
                style={{ width: `${(duelsDone / totalDuels) * 100}%` }}
              />
            </div>

            <p
              className="t-body-sm mb-4 text-center font-light text-ash"
              aria-live="polite"
              role="status"
            >
              Mana yang lebih kamu mau tonton?
            </p>

            <div className="flex items-start gap-3">
              <Card movie={left} />
              <span className="t-caption self-center px-1 font-semibold text-mist">vs</span>
              <Card movie={right} />
            </div>

            <button onClick={abandon} className="pill pill--sm pill--quiet mt-6 w-full">
              Batalkan turnamen
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="t-subheading font-semibold text-frost">
              {size >= 2 ? `Turnamen ${size} Besar` : 'Butuh minimal 2 film'}
            </p>
            <p className="t-body-sm max-w-xs font-light text-ash">
              {size >= 2
                ? `${size} film diundi dari pool, lalu kamu yang memutuskan di ${size - 1} duel. Juaranya jadi tontonanmu.`
                : 'Longgarkan filter supaya ada cukup film untuk dipertandingkan.'}
            </p>
            {size >= 2 && (
              <button onClick={start} disabled={!canStart} className="pill pill--filled mt-1">
                Mulai turnamen
              </button>
            )}
          </div>
        )}

        {blocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 px-8 text-center">
            {size < 2 ? (
              <>
                <p className="t-body font-light text-ash">
                  Tidak cukup film yang lolos filter untuk dipertandingkan.
                </p>
                <button onClick={onOpenFilters} className="pill pill--filled">
                  Ubah filter
                </button>
              </>
            ) : (
              <>
                <p className="t-subheading font-semibold text-frost">Koin habis</p>
                <button
                  onClick={() => {
                    sfx.coin()
                    onInsertCoin()
                  }}
                  className="pill pill--filled"
                >
                  Masukkan koin
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p
        className="t-caption mt-5 text-center font-light text-mist"
        aria-label={`${coins} koin tersisa`}
      >
        {coins} koin · satu turnamen memakai satu koin, berapa pun jumlah duelnya
      </p>
      <p className="t-caption mt-1 text-center font-light text-mist">
        Satu-satunya mesin yang bukan undian — pesertanya diacak, juaranya kamu yang tentukan
      </p>
    </div>
  )
}
