import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

function snapshot(): string {
  return window.location.hash.slice(1) || '/'
}

export function useRoute(): string {
  return useSyncExternalStore(subscribe, snapshot, () => '/')
}

export function navigate(path: string): void {
  if (window.location.hash.slice(1) === path) return
  window.location.hash = path
}

export function replace(path: string): void {
  window.history.replaceState(null, '', `#${path}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function back(): void {
  window.history.back()
}

/** Разбор пути вида /session/abc на сегменты. */
export function segments(path: string): string[] {
  return path.split('/').filter(Boolean)
}
