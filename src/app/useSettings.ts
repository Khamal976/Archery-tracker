import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { DEFAULT_SETTINGS } from '../db/db'
import { getSettings } from '../db/repo'
import type { Settings } from '../core/types'

export function useSettings(): Settings {
  const s = useLiveQuery(() => getSettings(), [], undefined)
  return s ?? DEFAULT_SETTINGS
}

/** Тема висит классом на <html>, цвет строки состояния синхронизируется с фоном. */
export function useThemeEffect(theme: Settings['theme']): void {
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#12100e' : '#e4dfd8')
  }, [theme])
}
