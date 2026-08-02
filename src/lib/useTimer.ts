import { useCallback, useEffect, useRef, useState } from 'react'
import type { TimerConfig } from '../core/types'
import { cue } from './feedback'

export type TimerPhase = 'idle' | 'prep' | 'shoot' | 'wait'

const PHASE_LABEL: Record<TimerPhase, string> = {
  idle: 'Таймер',
  prep: 'Подготовка',
  shoot: 'Стрельба',
  wait: 'Чужая линия',
}

export function phaseLabel(p: TimerPhase): string {
  return PHASE_LABEL[p]
}

/**
 * Таймер серии: подготовка -> стрельба -> (в режиме AB/CD) равное ожидание чужой линии.
 * Сигналы: старт стрельбы, предупреждение за 30 секунд, конец серии.
 */
export function useEndTimer(
  cfg: TimerConfig | null,
  feedback: { sound: boolean; haptic: boolean },
): {
  phase: TimerPhase
  remaining: number
  running: boolean
  start: () => void
  stop: () => void
  label: string
} {
  const [phase, setPhase] = useState<TimerPhase>('idle')
  const [remaining, setRemaining] = useState(0)
  const deadline = useRef<number>(0)
  const warned = useRef(false)
  const fb = useRef(feedback)
  fb.current = feedback

  const enter = useCallback(
    (next: TimerPhase, seconds: number) => {
      warned.current = false
      deadline.current = Date.now() + seconds * 1000
      setRemaining(seconds)
      setPhase(next)
      if (next === 'shoot') cue('start', fb.current.sound, fb.current.haptic)
      if (next === 'idle') cue('stop', fb.current.sound, fb.current.haptic)
    },
    [],
  )

  const start = useCallback(() => {
    if (!cfg?.enabled) return
    if (cfg.prepSeconds > 0) enter('prep', cfg.prepSeconds)
    else enter('shoot', cfg.seconds)
  }, [cfg, enter])

  const stop = useCallback(() => {
    setPhase('idle')
    setRemaining(0)
    deadline.current = 0
  }, [])

  useEffect(() => {
    if (phase === 'idle' || !cfg) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
      setRemaining(left)

      if (phase === 'shoot' && !warned.current && left <= 30 && left > 0) {
        warned.current = true
        cue('warn', fb.current.sound, fb.current.haptic)
      }
      if (left > 0) return

      if (phase === 'prep') enter('shoot', cfg.seconds)
      else if (phase === 'shoot') {
        if (cfg.abcd) {
          cue('stop', fb.current.sound, fb.current.haptic)
          enter('wait', cfg.seconds)
        } else enter('idle', 0)
      } else if (phase === 'wait') enter('idle', 0)
    }
    const id = window.setInterval(tick, 250)
    tick()
    return () => window.clearInterval(id)
  }, [phase, cfg, enter])

  return {
    phase,
    remaining,
    running: phase !== 'idle',
    start,
    stop,
    label: PHASE_LABEL[phase],
  }
}

export function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
