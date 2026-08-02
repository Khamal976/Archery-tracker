import type { ReactNode } from 'react'

export const CHART_AXIS = { stroke: 'var(--c-muted)', fontSize: 11 }

export const CHART_TOOLTIP = {
  background: 'var(--c-surface)',
  border: '1px solid var(--c-border)',
  borderRadius: 8,
  color: 'var(--c-text)',
}

/**
 * Recharts отдаёт значение как ValueType | undefined. Оборачиваем, чтобы не тащить
 * приведения типов в каждый график.
 */
export function chartValue(
  fn: (n: number) => string,
  name?: string,
): (value: unknown) => ReactNode | [ReactNode, string] {
  return (value: unknown) => {
    const text = typeof value === 'number' ? fn(value) : '—'
    return name ? [text, name] : text
  }
}
