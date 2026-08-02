import type { ThemeName } from '../core/types'
import { patchSettings } from '../db/repo'

/** Переключатель темы: свет на площадке меняется быстро, лезть в настройки некогда. */
export function ThemeToggle({ theme, className = '' }: { theme: ThemeName; className?: string }) {
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      onClick={() => patchSettings({ theme: next })}
      className={`tap inline-flex items-center justify-center rounded-xl border border-line px-3 text-lg ${className}`}
      aria-label={next === 'light' ? 'Светлая тема' : 'Тёмная тема'}
      title={next === 'light' ? 'Светлая тема' : 'Тёмная тема'}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
