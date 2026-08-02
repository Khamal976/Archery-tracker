import { EPS, norm } from './geometry'
import type { HitResolution, Point, TargetFace } from './types'

/**
 * Разбор попадания по фейсу.
 *
 * Правила:
 *  - попадание точно на линию кольца засчитывается в пользу большего номинала;
 *  - X = 10 очков, но флаг X ведётся отдельно (счётчик X — тай-брейк в рекордах);
 *  - на компаунд-фейсе с флагом innerTenOnly внешняя десятка даёт 9, внутренняя — 10 и X;
 *  - для многоспотовых фейсов кольцо считается от центра ближайшего спота,
 *    тап вне зоны всех спотов — промах;
 *  - у пустого фейса счёта нет, координаты пишутся.
 *
 * @param p координаты тапа в системе фейса (мм, +x вправо, +y вверх)
 */
export function resolveHit(face: TargetFace, p: Point): HitResolution {
  if (face.kind === 'blank') {
    return {
      spotIndex: null,
      local: { x: p.x, y: p.y },
      radiusMm: norm(p),
      value: 0,
      isX: false,
      isMiss: false,
      scored: false,
    }
  }

  let spotIndex: number | null = null
  let local: Point = { x: p.x, y: p.y }

  if (face.spots && face.spots.centers.length > 0) {
    let best = 0
    let bestDist = Infinity
    face.spots.centers.forEach((c, i) => {
      const d = Math.hypot(p.x - c.x, p.y - c.y)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    const c = face.spots.centers[best]
    spotIndex = best
    local = { x: p.x - c.x, y: p.y - c.y }

    if (bestDist > face.spots.zoneRadiusMm + EPS) {
      return { spotIndex, local, radiusMm: bestDist, value: 0, isX: false, isMiss: true, scored: true }
    }
  }

  const r = norm(local)
  const scoredRing = ringAt(face, r)

  if (scoredRing === null) {
    return { spotIndex, local, radiusMm: r, value: 0, isX: false, isMiss: true, scored: true }
  }

  const isX = face.hasX && face.xRadiusMm !== null && r <= face.xRadiusMm + EPS
  let value = scoredRing

  // Компаунд: засчитывается только внутренняя десятка, внешняя даёт 9.
  if (face.innerTenOnly && value === 10 && !isX) value = 9

  return { spotIndex, local, radiusMm: r, value, isX, isMiss: false, scored: true }
}

/**
 * Номинал кольца по расстоянию от центра счёта. null — мимо всех колец.
 * Кольца отсортированы по возрастанию радиуса, поэтому первое подходящее — самое ценное.
 */
export function ringAt(face: TargetFace, radiusMm: number): number | null {
  for (const ring of face.rings) {
    if (radiusMm <= ring.radiusMm + EPS) return ring.value
  }
  return null
}

/** Индекс ближайшего спота; null для одноцелевого фейса. */
export function nearestSpot(face: TargetFace, p: Point): number | null {
  if (!face.spots || face.spots.centers.length === 0) return null
  let best = 0
  let bestDist = Infinity
  face.spots.centers.forEach((c, i) => {
    const d = Math.hypot(p.x - c.x, p.y - c.y)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  })
  return best
}

/** Координаты фейса из локальных координат спота — для отрисовки точки. */
export function toFaceCoords(face: TargetFace, local: Point, spotIndex: number | null): Point {
  if (spotIndex === null || !face.spots) return local
  const c = face.spots.centers[spotIndex]
  if (!c) return local
  return { x: local.x + c.x, y: local.y + c.y }
}

/** Подпись номинала: X, M или число. */
export function formatValue(value: number, isX: boolean, isMiss: boolean): string {
  if (isMiss) return 'M'
  if (isX) return 'X'
  return String(value)
}

export interface ScoreTotals {
  arrows: number
  total: number
  xCount: number
  tenCount: number
  goldCount: number
  missCount: number
  avgPerArrow: number
  xRatio: number
  tenRatio: number
  goldRatio: number
}

export interface ScorableShot {
  value: number
  isX: boolean
  isMiss: boolean
}

/** Суммарный счёт по набору выстрелов. Жёлтое — 9 и 10. */
export function totals(shots: ScorableShot[]): ScoreTotals {
  let total = 0
  let xCount = 0
  let tenCount = 0
  let goldCount = 0
  let missCount = 0
  for (const s of shots) {
    total += s.value
    if (s.isX) xCount++
    if (s.value >= 10) tenCount++
    if (s.value >= 9) goldCount++
    if (s.isMiss) missCount++
  }
  const arrows = shots.length
  const share = (k: number) => (arrows > 0 ? k / arrows : 0)
  return {
    arrows,
    total,
    xCount,
    tenCount,
    goldCount,
    missCount,
    avgPerArrow: arrows > 0 ? total / arrows : 0,
    xRatio: share(xCount),
    tenRatio: share(tenCount),
    goldRatio: share(goldCount),
  }
}
