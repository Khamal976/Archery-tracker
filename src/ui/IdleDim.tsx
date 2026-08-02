import { useEffect, useState, type ReactNode } from 'react'

/**
 * Дежурный экран. Показать страницу поверх экрана блокировки телефона нельзя,
 * поэтому телефон не блокируем вовсе (см. useWakeLock), а картинку гасим сами:
 * почти чёрный слой экономит батарею на OLED, тап возвращает ввод без разблокировки.
 */
export function IdleDim({
  seconds,
  enabled,
  children,
}: {
  seconds: number
  enabled: boolean
  children: ReactNode
}) {
  const [dim, setDim] = useState(false)

  useEffect(() => {
    if (!enabled || seconds <= 0) {
      setDim(false)
      return
    }
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setDim(true), seconds * 1000)
    }
    const wake = () => {
      setDim(false)
      arm()
    }
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown']
    for (const e of events) window.addEventListener(e, wake)
    document.addEventListener('visibilitychange', wake)
    arm()
    return () => {
      window.clearTimeout(timer)
      for (const e of events) window.removeEventListener(e, wake)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [enabled, seconds])

  if (!dim) return null

  return (
    <button
      onClick={() => setDim(false)}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black text-left"
    >
      <div className="text-center text-[#5a5751]">{children}</div>
      <div className="text-xs text-[#3a3833]">тап — вернуться к вводу</div>
    </button>
  )
}
