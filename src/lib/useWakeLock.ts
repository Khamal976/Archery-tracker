import { useEffect, useRef, useState } from 'react'

/**
 * Экран не гаснет, пока идёт сессия.
 *
 * Показать страницу поверх экрана блокировки веб-приложение не может — это флаг
 * нативной Activity. Поэтому идём с другой стороны: не даём телефону заблокироваться,
 * а внутри приложения гасим картинку своим дежурным слоем (см. IdleDim).
 *
 * Система снимает лок при любом уходе страницы в фон, поэтому переполучаем его
 * на visibilitychange. В режиме энергосбережения Chrome может отказать — это не ошибка.
 */
export function useWakeLock(enabled: boolean): { active: boolean; supported: boolean } {
  const ref = useRef<WakeLockSentinel | null>(null)
  const [active, setActive] = useState(false)
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  useEffect(() => {
    if (!enabled || !supported) return
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || ref.current) return
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void sentinel.release()
          return
        }
        ref.current = sentinel
        setActive(true)
        sentinel.addEventListener('release', () => {
          ref.current = null
          setActive(false)
        })
      } catch {
        setActive(false)
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      const s = ref.current
      ref.current = null
      setActive(false)
      if (s) void s.release().catch(() => undefined)
    }
  }, [enabled, supported])

  return { active, supported }
}
