import { db } from '../db/db'
import type {
  End,
  Session,
  Settings,
  Setup,
  SetupVersion,
  Shot,
  Stage,
  TargetFace,
} from '../core/types'

export const BACKUP_APP = 'archery-tracker'
export const BACKUP_VERSION = 1

export interface BackupFile {
  app: string
  version: number
  exportedAt: number
  faces: TargetFace[]
  setups: Setup[]
  setupVersions: SetupVersion[]
  sessions: Session[]
  stages: Stage[]
  ends: End[]
  shots: Shot[]
  settings: Settings | null
}

export interface MergeStat {
  added: number
  updated: number
  kept: number
}

export interface MergeReport {
  [collection: string]: MergeStat
}

interface Identified {
  id: string
  updatedAt: number
}

/**
 * Мерж по UUID: новые id добавляются, при совпадении побеждает более поздний updatedAt.
 * Ничья остаётся за локальной записью — так повторный импорт одного и того же файла
 * ничего не меняет. Удалённые записи едут в бэкапе тумбстоунами (deletedAt), иначе
 * удалённая на телефоне сессия воскресала бы при каждом импорте с десктопа.
 */
export function mergeRows<T extends Identified>(
  local: T[],
  incoming: T[],
): { rows: T[]; stat: MergeStat } {
  const byId = new Map(local.map((r) => [r.id, r] as const))
  const stat: MergeStat = { added: 0, updated: 0, kept: 0 }
  const writes: T[] = []

  for (const row of incoming) {
    const mine = byId.get(row.id)
    if (!mine) {
      writes.push(row)
      stat.added++
    } else if (row.updatedAt > mine.updatedAt) {
      writes.push(row)
      stat.updated++
    } else {
      stat.kept++
    }
  }
  return { rows: writes, stat }
}

export async function buildBackup(): Promise<BackupFile> {
  const [faces, setups, setupVersions, sessions, stages, ends, shots, settings] = await Promise.all([
    db.faces.toArray(),
    db.setups.toArray(),
    db.setupVersions.toArray(),
    db.sessions.toArray(),
    db.stages.toArray(),
    db.ends.toArray(),
    db.shots.toArray(),
    db.settings.get('settings'),
  ])
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    faces,
    setups,
    setupVersions,
    sessions,
    stages,
    ends,
    shots,
    settings: settings ?? null,
  }
}

export function parseBackup(text: string): BackupFile {
  const data = JSON.parse(text) as Partial<BackupFile>
  if (data.app !== BACKUP_APP) throw new Error('Это не бэкап этого приложения')
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error('Файл сделан более новой версией приложения')
  }
  return {
    app: BACKUP_APP,
    version: data.version,
    exportedAt: data.exportedAt ?? 0,
    faces: data.faces ?? [],
    setups: data.setups ?? [],
    setupVersions: data.setupVersions ?? [],
    sessions: data.sessions ?? [],
    stages: data.stages ?? [],
    ends: data.ends ?? [],
    shots: data.shots ?? [],
    settings: data.settings ?? null,
  }
}

export async function applyBackup(file: BackupFile): Promise<MergeReport> {
  const report: MergeReport = {}

  const step = async <T extends Identified>(
    name: string,
    table: { toArray: () => Promise<T[]>; bulkPut: (rows: T[]) => Promise<unknown> },
    incoming: T[],
  ) => {
    const { rows, stat } = mergeRows(await table.toArray(), incoming)
    if (rows.length > 0) await table.bulkPut(rows)
    report[name] = stat
  }

  await step('Фейсы', db.faces, file.faces)
  await step('Сетапы', db.setups, file.setups)
  await step('Версии сетапов', db.setupVersions, file.setupVersions)
  await step('Сессии', db.sessions, file.sessions)
  await step('Этапы', db.stages, file.stages)
  await step('Серии', db.ends, file.ends)
  await step('Выстрелы', db.shots, file.shots)

  if (file.settings) {
    const local = await db.settings.get('settings')
    if (!local || file.settings.updatedAt > local.updatedAt) {
      await db.settings.put({ ...file.settings, id: 'settings' })
      report['Настройки'] = { added: local ? 0 : 1, updated: local ? 1 : 0, kept: 0 }
    } else {
      report['Настройки'] = { added: 0, updated: 0, kept: 1 }
    }
  }

  return report
}

// ------------------------------------------------------------------ CSV

const CSV_HEADER = [
  'Дата',
  'Сессия',
  'Формат',
  'Этап',
  'Дистанция, м',
  'Фейс',
  'Спот',
  'Сетап',
  'Версия',
  'Серия',
  'Стрела',
  'Номинал',
  'X',
  'x, мм',
  'y, мм',
]

/** Разделитель полей — точка с запятой, десятичный — запятая: так открывает Excel. */
export function csvCell(v: string | number | null): string {
  if (v === null) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csvDate(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Плоская таблица выстрелов для Excel.
 * Координаты — в конвенции приложения: +x вправо, +y вверх, мм от центра фейса
 * или центра своего спота.
 */
export async function buildCsv(): Promise<string> {
  const b = await buildBackup()
  const alive = <T extends { deletedAt: number | null }>(rows: T[]) =>
    rows.filter((r) => r.deletedAt === null)

  const sessions = new Map(alive(b.sessions).map((s) => [s.id, s] as const))
  const stages = new Map(alive(b.stages).map((s) => [s.id, s] as const))
  const ends = new Map(alive(b.ends).map((e) => [e.id, e] as const))
  const faces = new Map(b.faces.map((f) => [f.id, f] as const))
  const setups = new Map(b.setups.map((s) => [s.id, s] as const))
  const versions = new Map(b.setupVersions.map((v) => [v.id, v] as const))

  const lines = [CSV_HEADER.join(';')]

  for (const shot of alive(b.shots).sort((a, x) => a.createdAt - x.createdAt)) {
    const session = sessions.get(shot.sessionId)
    const stage = stages.get(shot.stageId)
    const end = ends.get(shot.endId)
    if (!session || !stage || !end) continue
    const setup = session.setupId ? setups.get(session.setupId) : undefined
    const version = session.setupVersionId ? versions.get(session.setupVersionId) : undefined

    lines.push(
      [
        csvDate(session.startedAt),
        csvCell(session.id),
        csvCell(session.formatName),
        csvCell(stage.index + 1),
        csvCell(stage.distanceM),
        csvCell(faces.get(stage.faceId)?.name ?? ''),
        csvCell(shot.spotIndex === null ? '' : shot.spotIndex + 1),
        csvCell(setup?.name ?? ''),
        csvCell(version ? `v${version.versionNo}` : ''),
        csvCell(end.index + 1),
        csvCell(shot.index + 1),
        csvCell(shot.isMiss ? 'M' : String(shot.value)),
        csvCell(shot.isX ? 'X' : ''),
        csvCell(shot.x === null ? null : Number(shot.x.toFixed(2))),
        csvCell(shot.y === null ? null : Number(shot.y.toFixed(2))),
      ].join(';'),
    )
  }
  return lines.join('\r\n')
}

// ------------------------------------------------------------------ файлы

export function downloadText(filename: string, text: string, mime: string): void {
  // BOM нужен, чтобы Excel открыл кириллицу в UTF-8 без танцев.
  const blob = new Blob([mime.includes('csv') ? '﻿' + text : text], {
    type: `${mime};charset=utf-8`,
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
