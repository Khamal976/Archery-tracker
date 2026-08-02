/**
 * Звук и вибро для таймера. Звук синтезируется WebAudio — файлов нет, значит
 * ничего не надо кэшировать и офлайн он работает так же, как онлайн.
 */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function beep(count = 1, freq = 880, durationMs = 160): void {
  const a = audio()
  if (!a) return
  for (let i = 0; i < count; i++) {
    const osc = a.createOscillator()
    const gain = a.createGain()
    const start = a.currentTime + i * (durationMs + 90) / 1000
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000)
    osc.connect(gain).connect(a.destination)
    osc.start(start)
    osc.stop(start + durationMs / 1000 + 0.02)
  }
}

/** Вибрация. На iOS API нет — тихо ничего не делаем, на Android работает. */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* не поддерживается */
  }
}

export function cue(kind: 'start' | 'warn' | 'stop', sound: boolean, haptic: boolean): void {
  if (sound) {
    if (kind === 'start') beep(2, 880)
    else if (kind === 'warn') beep(1, 660)
    else beep(3, 520)
  }
  if (haptic) {
    if (kind === 'start') vibrate([120, 80, 120])
    else if (kind === 'warn') vibrate(200)
    else vibrate([200, 100, 200, 100, 200])
  }
}
