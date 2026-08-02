import {
  computePrecision,
  flyerFlags,
  samplesFromShots,
  samplesToMrad,
  scalePrecision,
  sightAdvice,
  type PrecisionResult,
  type SightAdvice,
} from '../core/metrics'
import { totals, type ScoreTotals } from '../core/scoring'
import type { End, Session, Shot, Stage, TargetFace } from '../core/types'
import type { SessionBundle } from '../db/repo'

export interface StatsOptions {
  excludeFlyers: boolean
}

export interface EndStats {
  end: End
  shots: Shot[]
  totals: ScoreTotals
  /** Выстрелов с координатами. Ноль — серия введена числами. */
  withCoords: number
  precisionMm: PrecisionResult
  precisionMrad: PrecisionResult
}

export interface StageStats {
  stage: Stage
  face: TargetFace | undefined
  ends: EndStats[]
  shots: Shot[]
  totals: ScoreTotals
  withCoords: number
  precisionMm: PrecisionResult
  precisionMrad: PrecisionResult
  advice: SightAdvice
  /** id выстрелов, помеченных флаерами (считается по всему этапу). */
  flyerIds: Set<string>
  arrowsPlanned: number | null
}

export interface SessionStats {
  session: Session
  stages: StageStats[]
  totals: ScoreTotals
  withCoords: number
  /** Метрики по всей сессии: в mrad всегда, в мм — только если дистанция одна. */
  precisionMrad: PrecisionResult
  precisionMm: PrecisionResult | null
  /** Единая дистанция сессии, если она одна. */
  singleDistanceM: number | null
  arrowsPlanned: number | null
  flyerIds: Set<string>
}

const byIndex = <T extends { index: number }>(rows: T[]) => [...rows].sort((a, b) => a.index - b.index)

/**
 * Метрики на трёх уровнях: серия, этап, сессия.
 *
 * Флаеры ищутся ПО ЭТАПУ целиком — на серии из трёх стрел выброс не определить,
 * а пометки должны быть одинаковыми на всех уровнях, иначе они противоречат друг другу.
 * Счёт, средний балл и рекорды исключение флаеров не меняет никогда.
 */
export function computeSessionStats(
  bundle: SessionBundle,
  faces: Map<string, TargetFace>,
  opts: StatsOptions = { excludeFlyers: false },
): SessionStats {
  const stages: StageStats[] = byIndex(bundle.stages).map((stage) => {
    const stageShots = bundle.shots.filter((s) => s.stageId === stage.id)
    const coordShots = stageShots.filter((s) => s.x !== null && s.y !== null)

    const flags = flyerFlags(samplesFromShots(coordShots))
    const flyerIds = new Set<string>()
    coordShots.forEach((s, i) => {
      if (flags[i]) flyerIds.add(s.id)
    })

    const keep = (s: Shot) => !(opts.excludeFlyers && flyerIds.has(s.id))
    const stageSamples = samplesFromShots(coordShots.filter(keep))
    const precisionMm = computePrecision(stageSamples)

    const ends: EndStats[] = byIndex(bundle.ends.filter((e) => e.stageId === stage.id)).map((end) => {
      const endShots = byIndex(bundle.shots.filter((s) => s.endId === end.id))
      const endSamples = samplesFromShots(endShots.filter(keep))
      const p = computePrecision(endSamples)
      return {
        end,
        shots: endShots,
        totals: totals(endShots),
        withCoords: endShots.filter((s) => s.x !== null).length,
        precisionMm: p,
        precisionMrad: scalePrecision(p, 1 / stage.distanceM),
      }
    })

    return {
      stage,
      face: faces.get(stage.faceId),
      ends,
      shots: stageShots,
      totals: totals(stageShots),
      withCoords: coordShots.length,
      precisionMm,
      precisionMrad: scalePrecision(precisionMm, 1 / stage.distanceM),
      advice: sightAdvice(stageSamples),
      flyerIds,
      arrowsPlanned: stage.endsPlanned === null ? null : stage.endsPlanned * stage.arrowsPerEnd,
    }
  })

  const allFlyers = new Set<string>()
  for (const st of stages) for (const id of st.flyerIds) allFlyers.add(id)

  // Сессия целиком: точки складываются в mrad по дистанции своего этапа.
  // В миллиметрах метрики между дистанциями не смешиваются — это разные величины.
  const keepAll = (s: Shot) => !(opts.excludeFlyers && allFlyers.has(s.id))
  const pooledMm = stages.map((st) => samplesFromShots(st.shots.filter(keepAll)))
  const pooledMrad = stages.flatMap((st, i) => samplesToMrad(pooledMm[i], st.stage.distanceM))

  const distances = new Set(stages.map((s) => s.stage.distanceM))
  const singleDistanceM = distances.size === 1 ? [...distances][0] : null

  const allShots = bundle.shots
  const arrowsPlanned = stages.reduce<number | null>(
    (acc, s) => (acc === null || s.arrowsPlanned === null ? null : acc + s.arrowsPlanned),
    0,
  )

  return {
    session: bundle.session,
    stages,
    totals: totals(allShots),
    withCoords: allShots.filter((s) => s.x !== null).length,
    precisionMrad: computePrecision(pooledMrad),
    precisionMm: singleDistanceM !== null ? computePrecision(pooledMm.flat()) : null,
    singleDistanceM,
    arrowsPlanned,
    flyerIds: allFlyers,
  }
}

/** Гистограмма по кольцам: X, 10..1, M. */
export interface RingBar {
  key: string
  count: number
}

export function ringHistogram(shots: Shot[], face: TargetFace | undefined): RingBar[] {
  const values = face
    ? [...new Set(face.rings.map((r) => r.value))].sort((a, b) => b - a)
    : [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  const bars: RingBar[] = []
  const xs = shots.filter((s) => s.isX).length
  if (face?.hasX) bars.push({ key: 'X', count: xs })
  for (const v of values) {
    const count = shots.filter((s) => !s.isMiss && s.value === v && !(v === 10 && s.isX)).length
    bars.push({ key: String(v), count })
  }
  bars.push({ key: 'M', count: shots.filter((s) => s.isMiss).length })
  return bars
}

/** Средний балл по сериям в порядке отстрела — видно, где устал. */
export function endTrend(stats: SessionStats): { end: string; avg: number; total: number }[] {
  const out: { end: string; avg: number; total: number }[] = []
  let n = 0
  for (const st of stats.stages) {
    for (const e of st.ends) {
      if (e.shots.length === 0) continue
      n++
      out.push({ end: String(n), avg: e.totals.avgPerArrow, total: e.totals.total })
    }
  }
  return out
}

/** Длительность сессии: сумма активных интервалов, пауза не считается. */
export function activeMs(session: Session): number {
  const running = session.lastResumedAt ? Date.now() - session.lastResumedAt : 0
  return session.activeMs + running
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} мин`
  return `${Math.floor(min / 60)} ч ${String(min % 60).padStart(2, '0')} мин`
}

export function formatMm(v: number): string {
  return v >= 100 ? v.toFixed(0) : v.toFixed(1)
}

export function formatMrad(v: number): string {
  return v.toFixed(2)
}
