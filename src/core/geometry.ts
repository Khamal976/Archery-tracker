import type { Point } from './types'

/** Допуск для сравнений «точно на линии»: попадание на линию идёт в пользу большего номинала. */
export const EPS = 1e-9

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function norm(p: Point): number {
  return Math.hypot(p.x, p.y)
}

export function centroid(points: Point[]): Point {
  const n = points.length
  if (n === 0) return { x: 0, y: 0 }
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / n, y: sy / n }
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  let s = 0
  for (const v of values) s += v
  return s / values.length
}

/** Выборочное СКО (делитель n−1). При n < 2 — 0. */
export function sampleSd(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const m = mean(values)
  let s = 0
  for (const v of values) s += (v - m) * (v - m)
  return Math.sqrt(s / (n - 1))
}

/**
 * Перцентиль по эмпирическим данным, линейная интерполяция (тип 7 — как в numpy
 * и Excel PERCENTILE). Метод зафиксирован, чтобы CEP был воспроизводим в тестах.
 * @param sortedAsc отсортированный по возрастанию массив
 * @param p доля от 0 до 1
 */
export function percentile(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length
  if (n === 0) return NaN
  if (n === 1) return sortedAsc[0]
  const h = (n - 1) * Math.min(Math.max(p, 0), 1)
  const lo = Math.floor(h)
  const hi = Math.min(lo + 1, n - 1)
  return sortedAsc[lo] + (h - lo) * (sortedAsc[hi] - sortedAsc[lo])
}

/** Максимальное расстояние между двумя точками группы. */
export function extremeSpread(points: Point[]): number {
  let max = 0
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = distance(points[i], points[j])
      if (d > max) max = d
    }
  }
  return max
}

export interface Ellipse {
  cx: number
  cy: number
  /** Полуось вдоль главного направления. */
  rx: number
  /** Полуось поперёк. */
  ry: number
  /** Угол поворота главной оси, градусы, против часовой (в конвенции +y вверх). */
  angleDeg: number
}

/**
 * Эллипс рассеивания по ковариационной матрице группы.
 * @param k множитель полуосей в сигмах (по умолчанию 2σ)
 */
export function dispersionEllipse(points: Point[], k = 2): Ellipse | null {
  const n = points.length
  if (n < 3) return null
  const c = centroid(points)
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of points) {
    const dx = p.x - c.x
    const dy = p.y - c.y
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  sxx /= n - 1
  syy /= n - 1
  sxy /= n - 1

  const halfTrace = (sxx + syy) / 2
  const diff = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy)
  const l1 = Math.max(halfTrace + diff, 0)
  const l2 = Math.max(halfTrace - diff, 0)
  const angleDeg = (Math.atan2(2 * sxy, sxx - syy) / 2) * (180 / Math.PI)

  return {
    cx: c.x,
    cy: c.y,
    rx: k * Math.sqrt(l1),
    ry: k * Math.sqrt(l2),
    angleDeg,
  }
}

/**
 * Угловая величина: мм на мишени -> миллирадианы.
 * mrad = (мм / (м * 1000)) * 1000 = мм / м.
 */
export function toMrad(mm: number, distanceM: number): number {
  if (!distanceM) return 0
  return mm / distanceM
}

export function mradToMm(mrad: number, distanceM: number): number {
  return mrad * distanceM
}
