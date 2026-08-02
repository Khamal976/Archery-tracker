import {
  centroid,
  dispersionEllipse,
  distance,
  extremeSpread,
  mean,
  percentile,
  sampleSd,
  type Ellipse,
} from './geometry'
import type { Point } from './types'

/** Метрики кучности считаются от трёх выстрелов с координатами: три точки — уже группа. */
export const MIN_GROUP = 3
/** До 10 выстрелов CEP95 подписывается как ориентировочный. */
export const CEP95_RELIABLE_N = 10
/** Флаер — дальше 2.5 радиальных СКО от центроида остальных выстрелов. */
export const FLYER_K = 2.5
/** Меньше пяти точек — искать выброс бессмысленно, пометок нет. */
export const MIN_FLYER_N = 5
/** Смещение значимо, если больше двух стандартных ошибок среднего. */
export const SIGHT_SIGMA = 2

export interface PrecisionOk {
  insufficient: false
  n: number
  /** Центр группы. Он же смещение от центра мишени — это и есть системная ошибка. */
  centroid: Point
  /** Среднее расстояние точек от ЦЕНТРОИДА (не от центра мишени). */
  meanRadius: number
  sdX: number
  sdY: number
  /** Радиальное СКО: sqrt(sdX² + sdY²). На нём построено правило флаеров. */
  sdR: number
  extremeSpread: number
  cep50: number
  cep95: number
  /** true при n < 10: перцентиль на малой выборке дискретен и шумен. */
  cep95Approx: boolean
  ellipse: Ellipse | null
}

export interface PrecisionInsufficient {
  insufficient: true
  n: number
}

export type PrecisionResult = PrecisionOk | PrecisionInsufficient

/**
 * Кучность — разброс группы относительно самой себя.
 * Единицы результата совпадают с единицами входа (мм или mrad).
 */
export function computePrecision(samples: Point[]): PrecisionResult {
  const n = samples.length
  if (n < MIN_GROUP) return { insufficient: true, n }

  const c = centroid(samples)
  const radii = samples.map((p) => distance(p, c))
  const sorted = [...radii].sort((a, b) => a - b)
  const sdX = sampleSd(samples.map((p) => p.x))
  const sdY = sampleSd(samples.map((p) => p.y))

  return {
    insufficient: false,
    n,
    centroid: c,
    meanRadius: mean(radii),
    sdX,
    sdY,
    sdR: Math.hypot(sdX, sdY),
    extremeSpread: extremeSpread(samples),
    cep50: percentile(sorted, 0.5),
    cep95: percentile(sorted, 0.95),
    cep95Approx: n < CEP95_RELIABLE_N,
    ellipse: dispersionEllipse(samples, 2),
  }
}

/**
 * Флаеры: выстрелы дальше k радиальных СКО от центроида.
 *
 * Центроид и СКО для проверки точки считаются ПО ОСТАЛЬНЫМ точкам. Иначе одинокий
 * далёкий выстрел раздувает СКО настолько, что сам под порог не попадает: на серии
 * из шести стрел правило «2.5 СКО от общего центроида» не срабатывает никогда.
 * Проход по-прежнему один — итеративного пересчёта после исключения нет.
 * Исходные данные не меняются, это только пометка.
 */
export function flyerFlags(samples: Point[], k = FLYER_K): boolean[] {
  const n = samples.length
  if (n < MIN_FLYER_N) return samples.map(() => false)

  return samples.map((p, i) => {
    const rest = samples.filter((_, j) => j !== i)
    const c = centroid(rest)
    const sdR = Math.hypot(sampleSd(rest.map((q) => q.x)), sampleSd(rest.map((q) => q.y)))
    if (sdR === 0) return false
    return distance(p, c) > k * sdR
  })
}

export interface AxisAdvice {
  /** Смещение центроида по оси, в единицах входа. */
  offset: number
  /** Стандартная ошибка среднего по оси. */
  sem: number
  significant: boolean
  /** Куда двигать прицел: он идёт вслед за группой. */
  direction: 'right' | 'left' | 'up' | 'down' | null
}

export interface SightAdvice {
  n: number
  enough: boolean
  horizontal: AxisAdvice
  vertical: AxisAdvice
  any: boolean
}

/**
 * Подсказка по прицелу. Смещение значимо, если больше двух стандартных ошибок среднего;
 * оси считаются независимо, поэтому подсказка может быть только по вертикали.
 * Направление: прицел двигается вслед за группой (группа вправо-вверх — прицел вправо-вверх).
 */
export function sightAdvice(samples: Point[], sigma = SIGHT_SIGMA): SightAdvice {
  const n = samples.length
  const empty: AxisAdvice = { offset: 0, sem: 0, significant: false, direction: null }
  if (n < MIN_GROUP) {
    return { n, enough: false, horizontal: empty, vertical: empty, any: false }
  }

  const c = centroid(samples)
  const semX = sampleSd(samples.map((p) => p.x)) / Math.sqrt(n)
  const semY = sampleSd(samples.map((p) => p.y)) / Math.sqrt(n)
  const sigX = Math.abs(c.x) > sigma * semX
  const sigY = Math.abs(c.y) > sigma * semY

  return {
    n,
    enough: true,
    horizontal: {
      offset: c.x,
      sem: semX,
      significant: sigX,
      direction: sigX ? (c.x > 0 ? 'right' : 'left') : null,
    },
    vertical: {
      offset: c.y,
      sem: semY,
      significant: sigY,
      direction: sigY ? (c.y > 0 ? 'up' : 'down') : null,
    },
    any: sigX || sigY,
  }
}

/**
 * Выборка координат из выстрелов. Серии, введённые числами, координат не имеют
 * и в кучность не попадают — нулей вместо них не подставляем.
 */
export function samplesFromShots(shots: { x: number | null; y: number | null }[]): Point[] {
  const out: Point[] = []
  for (const s of shots) {
    if (s.x === null || s.y === null) continue
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) continue
    out.push({ x: s.x, y: s.y })
  }
  return out
}

/** Перевод выборки в mrad: делим на дистанцию в метрах (мм/м = mrad). */
export function samplesToMrad(samples: Point[], distanceM: number): Point[] {
  if (!distanceM) return samples.map(() => ({ x: 0, y: 0 }))
  return samples.map((p) => ({ x: p.x / distanceM, y: p.y / distanceM }))
}

/**
 * Пересчёт готовых метрик в другие единицы. Все метрики кучности однородны первой
 * степени по координатам, поэтому масштабируются множителем без пересчёта выборки.
 */
export function scalePrecision(p: PrecisionResult, factor: number): PrecisionResult {
  if (p.insufficient) return p
  return {
    ...p,
    centroid: { x: p.centroid.x * factor, y: p.centroid.y * factor },
    meanRadius: p.meanRadius * factor,
    sdX: p.sdX * factor,
    sdY: p.sdY * factor,
    sdR: p.sdR * factor,
    extremeSpread: p.extremeSpread * factor,
    cep50: p.cep50 * factor,
    cep95: p.cep95 * factor,
    ellipse: p.ellipse
      ? {
          cx: p.ellipse.cx * factor,
          cy: p.ellipse.cy * factor,
          rx: p.ellipse.rx * factor,
          ry: p.ellipse.ry * factor,
          angleDeg: p.ellipse.angleDeg,
        }
      : null,
  }
}
