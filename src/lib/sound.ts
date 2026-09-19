import { KEYS, readJSON, writeJSON } from './storage'

/**
 * Semua efek suara disintesis dengan WebAudio, jadi tidak ada satu pun file
 * audio yang perlu diunduh dan nadanya pas dengan tema arcade 8-bit.
 */
class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private motor: { osc: OscillatorNode; gain: GainNode } | null = null
  muted = readJSON<{ muted?: boolean }>(KEYS.settings, {}).muted ?? false

  /** AudioContext hanya boleh dibuat setelah ada interaksi pengguna. */
  private ensure(): AudioContext | null {
    if (this.muted) return null
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as any).webkitAudioContext
      if (!Ctor) return null
      try {
        this.ctx = new Ctor()
      } catch {
        return null
      }
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.32
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setMuted(muted: boolean) {
    this.muted = muted
    const settings = readJSON<Record<string, unknown>>(KEYS.settings, {})
    writeJSON(KEYS.settings, { ...settings, muted })
    if (muted) this.stopMotor()
  }

  private blip(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    gain = 0.5,
    slideTo?: number,
  ) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + duration)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }

  /** Derau putih pendek — dipakai untuk benturan dan pecahnya kapsul. */
  private noise(duration: number, gain = 0.3, filterHz = 1400) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration))
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = filterHz
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(filter).connect(g).connect(this.master)
    src.start(t)
  }

  click() {
    this.blip(880, 0.05, 'square', 0.25)
  }

  coin() {
    this.blip(988, 0.07, 'square', 0.4)
    window.setTimeout(() => this.blip(1319, 0.16, 'square', 0.35), 70)
  }

  /** Dengung motor derek selama derek bergerak. */
  startMotor() {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.motor) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    osc.type = 'sawtooth'
    osc.frequency.value = 72
    filter.type = 'lowpass'
    filter.frequency.value = 420
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.05)
    osc.connect(filter).connect(gain).connect(this.master)
    osc.start()
    this.motor = { osc, gain }
  }

  stopMotor() {
    if (!this.motor || !this.ctx) return
    const { osc, gain } = this.motor
    this.motor = null
    const t = this.ctx.currentTime
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    osc.stop(t + 0.12)
  }

  clamp() {
    this.noise(0.09, 0.32, 2600)
    this.blip(210, 0.09, 'square', 0.3, 130)
  }

  bump() {
    this.noise(0.05, 0.16, 900)
  }

  slip() {
    this.blip(420, 0.28, 'sawtooth', 0.32, 90)
  }

  drop() {
    this.noise(0.14, 0.34, 700)
    this.blip(140, 0.18, 'sine', 0.35, 70)
  }

  /** Fanfare naik; tier tinggi dapat nada tambahan. */
  win(extraNote = false) {
    const notes = extraNote ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047]
    notes.forEach((f, i) => window.setTimeout(() => this.blip(f, 0.2, 'square', 0.42), i * 95))
  }

  fail() {
    this.blip(300, 0.16, 'square', 0.3)
    window.setTimeout(() => this.blip(190, 0.3, 'square', 0.3, 110), 140)
  }

  crack() {
    this.noise(0.22, 0.42, 3200)
  }
}

export const sfx = new Sfx()

/** Getar singkat di perangkat yang mendukung; diabaikan diam-diam bila tidak. */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* tidak didukung */
  }
}
