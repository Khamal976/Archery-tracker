import { computePrecision, samplesFromShots, samplesToMrad } from '../core/metrics'
import { totals, type ScoreTotals } from '../core/scoring'
import type { Point, Session, Setup, SetupVersion, Shot, Stage, TargetFace } from '../core/types'
import { activeMs } from './stats'

export interface Everything {
  sessions: Session[]
  stages: Stage[]
  ends: unknown[]
  shots: Shot[]
  faces: TargetFace[]
  setups: Setup[]
  versions: SetupVersion[]
}

/** Денормализованный выстрел: всё, по чему фильтруем и группируем. */
export interface ShotRow {
  shot: Shot
  session: Session
  stage: Stage
  faceId: string
  distanceM: number
  date: number
  setupId: string | null
  versionId: string | null
}

export interface Filters {
  distanceM: number | 'all'
  faceId: string | 'all'
  setupId: string | 'all'
  /** Дней назад; 0 — за всё время. */
  days: number
  scoredOnly: boolean
}

export const DEFAULT_FILTERS: Filters = {
  distanceM: 'all',
  faceId: 'all',
  setupId: 'all',
  days: 0,
  scoredOnly: false,
}

export function denormalize(all: Everything): ShotRow[] {
  const sessions = new Map(all.sessions.map((s) => [s.id, s] as const))
  const stages = new Map(all.stages.map((s) => [s.id, s] as const))
  const rows: ShotRow[] = []
  for (const shot of all.shots) {
    const session = sessions.get(shot.sessionId)
    const stage = stages.get(shot.stageId)
    if (!session || !stage) continue
    rows.push({
      shot,
      session,
      stage,
      faceId: stage.faceId,
      distanceM: stage.distanceM,
      date: session.startedAt,
      setupId: session.setupId,
      versionId: session.setupVersionId,
    })
  }
  return rows
}

export function applyFilters(rows: ShotRow[], f: Filters): ShotRow[] {
  const since = f.days > 0 ? Date.now() - f.days * 24 * 3600 * 1000 : 0
  return rows.filter(
    (r) =>
      (f.distanceM === 'all' || r.distanceM === f.distanceM) &&
      (f.faceId === 'all' || r.faceId === f.faceId) &&
      (f.setupId === 'all' || r.setupId === f.setupId) &&
      (!f.scoredOnly || r.session.scored) &&
      r.date >= since,
  )
}

export function distinctDistances(rows: ShotRow[]): number[] {
  return [...new Set(rows.map((r) => r.distanceM))].sort((a, b) => a - b)
}

/** Точки в mrad от центра фейса или своего спота — так 18 м и 70 м сравнимы. */
export function mradPoints(rows: ShotRow[]): Point[] {
  const byDistance = new Map<number, ShotRow[]>()
  for (const r of rows) {
    const list = byDistance.get(r.distanceM) ?? []
    list.push(r)
    byDistance.set(r.distanceM, list)
  }
  const out: Point[] = []
  for (const [distance, list] of byDistance) {
    out.push(...samplesToMrad(samplesFromShots(list.map((r) => r.shot)), distance))
  }
  return out
}

export interface SessionPoint {
  date: number
  label: string
  /** null для отстрела без счёта: там баллов нет, и нулём их подменять нельзя. */
  avg: number | null
  meanRadiusMm: number | null
  meanRadiusMrad: number | null
  arrows: number
  scored: boolean
}

/** Динамика по сессиям: средний балл и mean radius. */
export function sessionSeries(rows: ShotRow[]): SessionPoint[] {
  const bySession = new Map<string, ShotRow[]>()
  for (const r of rows) {
    const list = bySession.get(r.session.id) ?? []
    list.push(r)
    bySession.set(r.session.id, list)
  }

  const points: SessionPoint[] = []
  for (const [, list] of bySession) {
    const session = list[0].session
    const t = totals(list.map((r) => r.shot))
    const mm = computePrecision(samplesFromShots(list.map((r) => r.shot)))
    const mrad = computePrecision(mradPoints(list))
    const oneDistance = new Set(list.map((r) => r.distanceM)).size === 1
    points.push({
      date: session.startedAt,
      label: new Date(session.startedAt).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
      }),
      avg: session.scored ? t.avgPerArrow : null,
      meanRadiusMm: oneDistance && !mm.insufficient ? mm.meanRadius : null,
      meanRadiusMrad: mrad.insufficient ? null : mrad.meanRadius,
      arrows: t.arrows,
      scored: session.scored,
    })
  }
  return points.sort((a, b) => a.date - b.date)
}

export interface RecordRow {
  formatId: string
  formatName: string
  total: number
  xCount: number
  sessionId: string
  date: number
}

/**
 * Личные рекорды по каждому формату. Учитываются только завершённые полные сессии
 * со счётом: недострелянная сессия и свободная тренировка сравнению не подлежат.
 * Тай-брейк — число X.
 */
export function personalRecords(all: Everything, rankedFormats: Set<string>): RecordRow[] {
  const best = new Map<string, RecordRow>()
  for (const session of all.sessions) {
    if (!session.scored || session.status !== 'finished' || !session.complete) continue
    if (!rankedFormats.has(session.formatId)) continue
    const t = totals(all.shots.filter((s) => s.sessionId === session.id))
    if (t.arrows === 0) continue
    const row: RecordRow = {
      formatId: session.formatId,
      formatName: session.formatName,
      total: t.total,
      xCount: t.xCount,
      sessionId: session.id,
      date: session.startedAt,
    }
    const cur = best.get(session.formatId)
    if (!cur || row.total > cur.total || (row.total === cur.total && row.xCount > cur.xCount)) {
      best.set(session.formatId, row)
    }
  }
  return [...best.values()].sort((a, b) => a.formatName.localeCompare(b.formatName, 'ru'))
}

export interface VolumeBucket {
  key: string
  arrows: number
  hours: number
}

function weekKey(ts: number): string {
  const d = new Date(ts)
  const day = (d.getDay() + 6) % 7 // понедельник — 0
  d.setDate(d.getDate() - day)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthKey(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })
}

/** Объём: стрел и часов по неделям или месяцам. Часы — активное время сессий. */
export function volume(rows: ShotRow[], by: 'week' | 'month', limit: number): VolumeBucket[] {
  const key = by === 'week' ? weekKey : monthKey
  const arrows = new Map<string, number>()
  const order = new Map<string, number>()
  const sessionsSeen = new Map<string, Set<string>>()
  const hours = new Map<string, number>()

  for (const r of rows) {
    const k = key(r.date)
    arrows.set(k, (arrows.get(k) ?? 0) + 1)
    if (!order.has(k)) order.set(k, r.date)
    order.set(k, Math.max(order.get(k)!, r.date))
    const seen = sessionsSeen.get(k) ?? new Set<string>()
    if (!seen.has(r.session.id)) {
      seen.add(r.session.id)
      hours.set(k, (hours.get(k) ?? 0) + activeMs(r.session) / 3600000)
      sessionsSeen.set(k, seen)
    }
  }

  return [...arrows.keys()]
    .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    .slice(-limit)
    .map((k) => ({ key: k, arrows: arrows.get(k) ?? 0, hours: Number((hours.get(k) ?? 0).toFixed(1)) }))
}

export interface ComparisonRow {
  distanceM: number
  arrows: number
  /** Средний балл только по сессиям со счётом; null — сравнивать нечего. */
  avg: number | null
  scoredArrows: number
  meanRadiusMm: number | null
  meanRadiusMrad: number | null
}

export interface Comparison {
  label: string
  rows: ComparisonRow[]
  overall: ScoreTotals
}

/** Сводка по одному сетапу или одной его версии, разложенная по дистанциям. */
export function summarize(rows: ShotRow[], label: string): Comparison {
  const byDistance = new Map<number, ShotRow[]>()
  for (const r of rows) {
    const list = byDistance.get(r.distanceM) ?? []
    list.push(r)
    byDistance.set(r.distanceM, list)
  }
  const out: ComparisonRow[] = []
  for (const [distanceM, list] of [...byDistance.entries()].sort((a, b) => a[0] - b[0])) {
    // Кучность считаем по всем выстрелам, включая отстрел без счёта — он для того и нужен.
    // Средний балл — только по сессиям со счётом, иначе бланк тянет среднее в ноль.
    const scored = list.filter((r) => r.session.scored)
    const t = totals(scored.map((r) => r.shot))
    const mm = computePrecision(samplesFromShots(list.map((r) => r.shot)))
    out.push({
      distanceM,
      arrows: list.length,
      avg: t.arrows > 0 ? t.avgPerArrow : null,
      scoredArrows: t.arrows,
      meanRadiusMm: mm.insufficient ? null : mm.meanRadius,
      meanRadiusMrad: mm.insufficient ? null : mm.meanRadius / distanceM,
    })
  }
  return {
    label,
    rows: out,
    overall: totals(rows.filter((r) => r.session.scored).map((r) => r.shot)),
  }
}
