import { db } from './db'
import type { ShootingFormat } from '../core/formats'
import type {
  BowType,
  End,
  Feedback,
  FeedbackKind,
  InputMode,
  Place,
  Session,
  Settings,
  Setup,
  SetupVersion,
  Shot,
  SpotMode,
  Stage,
  TargetFace,
  TimerConfig,
} from '../core/types'

export const newId = (): string => crypto.randomUUID()
export const now = (): number => Date.now()

/** Живые (не удалённые) записи. Удаление мягкое: тумбстоуны нужны мержу импорта. */
const alive = <T extends { deletedAt: number | null }>(rows: T[]): T[] =>
  rows.filter((r) => r.deletedAt === null)

// ------------------------------------------------------------------ настройки

export async function getSettings(): Promise<Settings | undefined> {
  return db.settings.get('settings')
}

export async function patchSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await db.settings.get('settings')
  if (!cur) return
  await db.settings.put({ ...cur, ...patch, id: 'settings', updatedAt: now() })
}

// ------------------------------------------------------------------ фейсы

export async function listFaces(): Promise<TargetFace[]> {
  return alive(await db.faces.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

export async function getFace(id: string): Promise<TargetFace | undefined> {
  return db.faces.get(id)
}

export async function saveFace(face: TargetFace): Promise<void> {
  await db.faces.put({ ...face, updatedAt: now() })
}

export async function deleteFace(id: string): Promise<void> {
  const f = await db.faces.get(id)
  if (!f || f.builtIn) return
  await db.faces.put({ ...f, deletedAt: now(), updatedAt: now() })
}

// ------------------------------------------------------------------ сетапы

export async function listSetups(): Promise<Setup[]> {
  return alive(await db.setups.toArray()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function listVersions(setupId: string): Promise<SetupVersion[]> {
  const rows = alive(await db.setupVersions.where('setupId').equals(setupId).toArray())
  return rows.sort((a, b) => b.versionNo - a.versionNo)
}

export async function getVersion(id: string): Promise<SetupVersion | undefined> {
  return db.setupVersions.get(id)
}

export async function createSetup(
  name: string,
  bowType: BowType,
  fields: Record<string, string>,
): Promise<Setup> {
  const t = now()
  const setupId = newId()
  const versionId = newId()
  const version: SetupVersion = {
    id: versionId,
    setupId,
    versionNo: 1,
    createdAt: t,
    reason: 'Первая версия',
    fields,
    updatedAt: t,
    deletedAt: null,
  }
  const setup: Setup = {
    id: setupId,
    name,
    bowType,
    currentVersionId: versionId,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
  }
  await db.transaction('rw', db.setups, db.setupVersions, async () => {
    await db.setupVersions.add(version)
    await db.setups.add(setup)
  })
  return setup
}

/**
 * Любое изменение параметров создаёт НОВУЮ версию со снимком всех полей.
 * Старые сессии продолжают ссылаться на свою версию — иначе сравнение «до и после»
 * настройки теряет смысл.
 */
export async function commitSetupVersion(
  setupId: string,
  fields: Record<string, string>,
  reason: string,
): Promise<SetupVersion> {
  const setup = await db.setups.get(setupId)
  if (!setup) throw new Error('сетап не найден')
  const versions = await listVersions(setupId)
  const t = now()
  const version: SetupVersion = {
    id: newId(),
    setupId,
    versionNo: (versions[0]?.versionNo ?? 0) + 1,
    createdAt: t,
    reason,
    fields,
    updatedAt: t,
    deletedAt: null,
  }
  await db.transaction('rw', db.setups, db.setupVersions, async () => {
    await db.setupVersions.add(version)
    await db.setups.put({ ...setup, currentVersionId: version.id, updatedAt: t })
  })
  return version
}

export async function renameSetup(setupId: string, name: string): Promise<void> {
  const setup = await db.setups.get(setupId)
  if (!setup) return
  await db.setups.put({ ...setup, name, updatedAt: now() })
}

export async function deleteSetup(setupId: string): Promise<void> {
  const t = now()
  const setup = await db.setups.get(setupId)
  if (!setup) return
  const versions = await db.setupVersions.where('setupId').equals(setupId).toArray()
  await db.transaction('rw', db.setups, db.setupVersions, async () => {
    await db.setups.put({ ...setup, deletedAt: t, updatedAt: t })
    await db.setupVersions.bulkPut(versions.map((v) => ({ ...v, deletedAt: t, updatedAt: t })))
  })
}

// ------------------------------------------------------------------ сессии

export interface StageSpec {
  distanceM: number
  faceId: string
  ends: number | null
  arrowsPerEnd: number
}

export interface NewSessionSpec {
  format: ShootingFormat
  stages: StageSpec[]
  setupId: string | null
  setupVersionId: string | null
  place: Place
  note: string
  timer: TimerConfig | null
  spotMode: SpotMode
}

export async function createSession(spec: NewSessionSpec): Promise<string> {
  const t = now()
  const sessionId = newId()
  const session: Session = {
    id: sessionId,
    formatId: spec.format.id,
    formatName: spec.format.name,
    setupId: spec.setupId,
    setupVersionId: spec.setupVersionId,
    place: spec.place,
    note: spec.note,
    debrief: '',
    startedAt: t,
    finishedAt: null,
    status: 'active',
    activeMs: 0,
    lastResumedAt: t,
    timer: spec.timer,
    scored: spec.format.scored,
    complete: false,
    updatedAt: t,
    deletedAt: null,
  }
  const stages: Stage[] = spec.stages.map((s, i) => ({
    id: newId(),
    sessionId,
    index: i,
    distanceM: s.distanceM,
    faceId: s.faceId,
    endsPlanned: s.ends,
    arrowsPerEnd: s.arrowsPerEnd,
    updatedAt: t,
    deletedAt: null,
  }))
  const firstEnd: End = {
    id: newId(),
    sessionId,
    stageId: stages[0].id,
    index: 0,
    inputMode: 'target',
    spotMode: spec.spotMode,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
  }

  await db.transaction('rw', db.sessions, db.stages, db.ends, async () => {
    await db.sessions.add(session)
    await db.stages.bulkAdd(stages)
    await db.ends.add(firstEnd)
  })
  return sessionId
}

/** Новый этап в существующей сессии — смена дистанции внутри свободной тренировки. */
export async function addStage(sessionId: string, spec: StageSpec): Promise<Stage> {
  const t = now()
  const stages = alive(await db.stages.where('sessionId').equals(sessionId).toArray())
  const stage: Stage = {
    id: newId(),
    sessionId,
    index: stages.length,
    distanceM: spec.distanceM,
    faceId: spec.faceId,
    endsPlanned: spec.ends,
    arrowsPerEnd: spec.arrowsPerEnd,
    updatedAt: t,
    deletedAt: null,
  }
  await db.stages.add(stage)
  await ensureEnd(sessionId, stage.id, 0)
  return stage
}

export async function ensureEnd(
  sessionId: string,
  stageId: string,
  index: number,
  inputMode: InputMode = 'target',
  spotMode: SpotMode = 'onePerSpot',
): Promise<End> {
  const existing = alive(await db.ends.where('stageId').equals(stageId).toArray()).find(
    (e) => e.index === index,
  )
  if (existing) return existing
  const t = now()
  const end: End = {
    id: newId(),
    sessionId,
    stageId,
    index,
    inputMode,
    spotMode,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
  }
  await db.ends.add(end)
  return end
}

export async function patchEnd(endId: string, patch: Partial<End>): Promise<void> {
  const e = await db.ends.get(endId)
  if (!e) return
  await db.ends.put({ ...e, ...patch, updatedAt: now() })
}

export async function pauseSession(sessionId: string): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s || s.status !== 'active') return
  const t = now()
  const add = s.lastResumedAt ? t - s.lastResumedAt : 0
  await db.sessions.put({
    ...s,
    status: 'paused',
    activeMs: s.activeMs + add,
    lastResumedAt: null,
    updatedAt: t,
  })
}

export async function resumeSession(sessionId: string): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s || s.status === 'finished') return
  const t = now()
  await db.sessions.put({ ...s, status: 'active', lastResumedAt: t, updatedAt: t })
}

export async function finishSession(
  sessionId: string,
  complete: boolean,
  debrief?: string,
): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s) return
  const t = now()
  const add = s.lastResumedAt ? t - s.lastResumedAt : 0
  await db.sessions.put({
    ...s,
    status: 'finished',
    finishedAt: t,
    activeMs: s.activeMs + add,
    lastResumedAt: null,
    complete,
    debrief: debrief ?? s.debrief ?? '',
    updatedAt: t,
  })
}

export async function patchSession(sessionId: string, patch: Partial<Session>): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s) return
  await db.sessions.put({ ...s, ...patch, updatedAt: now() })
}

export async function deleteSession(sessionId: string): Promise<void> {
  const t = now()
  const [stages, ends, shots, session] = await Promise.all([
    db.stages.where('sessionId').equals(sessionId).toArray(),
    db.ends.where('sessionId').equals(sessionId).toArray(),
    db.shots.where('sessionId').equals(sessionId).toArray(),
    db.sessions.get(sessionId),
  ])
  if (!session) return
  await db.transaction('rw', db.sessions, db.stages, db.ends, db.shots, async () => {
    await db.sessions.put({ ...session, deletedAt: t, updatedAt: t })
    await db.stages.bulkPut(stages.map((r) => ({ ...r, deletedAt: t, updatedAt: t })))
    await db.ends.bulkPut(ends.map((r) => ({ ...r, deletedAt: t, updatedAt: t })))
    await db.shots.bulkPut(shots.map((r) => ({ ...r, deletedAt: t, updatedAt: t })))
  })
}

// ------------------------------------------------------------------ выстрелы

export interface NewShot {
  sessionId: string
  stageId: string
  endId: string
  x: number | null
  y: number | null
  spotIndex: number | null
  value: number
  isX: boolean
  isMiss: boolean
  repeatedSpot: boolean
}

export async function addShot(input: NewShot): Promise<Shot> {
  const t = now()
  const existing = alive(await db.shots.where('endId').equals(input.endId).toArray())
  const shot: Shot = {
    id: newId(),
    index: existing.length,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    ...input,
  }
  await db.shots.add(shot)
  return shot
}

export async function patchShot(shotId: string, patch: Partial<Shot>): Promise<void> {
  const s = await db.shots.get(shotId)
  if (!s) return
  await db.shots.put({ ...s, ...patch, updatedAt: now() })
}

export async function deleteShot(shotId: string): Promise<void> {
  const s = await db.shots.get(shotId)
  if (!s) return
  const t = now()
  await db.shots.put({ ...s, deletedAt: t, updatedAt: t })
  // Перенумеровать оставшиеся выстрелы серии, чтобы индексы шли подряд.
  const rest = alive(await db.shots.where('endId').equals(s.endId).toArray()).sort(
    (a, b) => a.index - b.index,
  )
  await db.shots.bulkPut(rest.map((r, i) => (r.index === i ? r : { ...r, index: i, updatedAt: t })))
}

export async function undoLastShot(endId: string): Promise<void> {
  const shots = alive(await db.shots.where('endId').equals(endId).toArray())
  if (shots.length === 0) return
  const last = shots.reduce((a, b) => (a.index >= b.index ? a : b))
  await deleteShot(last.id)
}

// ------------------------------------------------------------------ обратная связь

export async function listFeedback(): Promise<Feedback[]> {
  return alive(await db.feedback.toArray()).sort((a, b) => b.createdAt - a.createdAt)
}

export async function addFeedback(
  kind: FeedbackKind,
  text: string,
  context: string,
): Promise<Feedback> {
  const t = now()
  const row: Feedback = {
    id: newId(),
    kind,
    text: text.trim(),
    context: context.trim(),
    status: 'open',
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
  }
  await db.feedback.add(row)
  return row
}

export async function patchFeedback(id: string, patch: Partial<Feedback>): Promise<void> {
  const row = await db.feedback.get(id)
  if (!row) return
  await db.feedback.put({ ...row, ...patch, updatedAt: now() })
}

export async function deleteFeedback(id: string): Promise<void> {
  const row = await db.feedback.get(id)
  if (!row) return
  const t = now()
  await db.feedback.put({ ...row, deletedAt: t, updatedAt: t })
}

// ------------------------------------------------------------------ чтение

export interface SessionBundle {
  session: Session
  stages: Stage[]
  ends: End[]
  shots: Shot[]
}

export async function loadSession(sessionId: string): Promise<SessionBundle | null> {
  const session = await db.sessions.get(sessionId)
  if (!session || session.deletedAt !== null) return null
  const [stages, ends, shots] = await Promise.all([
    db.stages.where('sessionId').equals(sessionId).toArray(),
    db.ends.where('sessionId').equals(sessionId).toArray(),
    db.shots.where('sessionId').equals(sessionId).toArray(),
  ])
  return {
    session,
    stages: alive(stages).sort((a, b) => a.index - b.index),
    ends: alive(ends).sort((a, b) => a.index - b.index),
    shots: alive(shots).sort((a, b) => a.index - b.index),
  }
}

export async function listSessions(): Promise<Session[]> {
  return alive(await db.sessions.toArray()).sort((a, b) => b.startedAt - a.startedAt)
}

export async function activeSession(): Promise<Session | null> {
  const rows = alive(await db.sessions.toArray()).filter((s) => s.status !== 'finished')
  if (rows.length === 0) return null
  return rows.sort((a, b) => b.startedAt - a.startedAt)[0]
}

/** Все выстрелы всех живых сессий — для общей статистики. */
export async function loadAll(): Promise<{
  sessions: Session[]
  stages: Stage[]
  ends: End[]
  shots: Shot[]
  faces: TargetFace[]
  setups: Setup[]
  versions: SetupVersion[]
}> {
  const [sessions, stages, ends, shots, faces, setups, versions] = await Promise.all([
    db.sessions.toArray(),
    db.stages.toArray(),
    db.ends.toArray(),
    db.shots.toArray(),
    db.faces.toArray(),
    db.setups.toArray(),
    db.setupVersions.toArray(),
  ])
  return {
    sessions: alive(sessions),
    stages: alive(stages),
    ends: alive(ends),
    shots: alive(shots),
    faces: alive(faces),
    setups: alive(setups),
    versions: alive(versions),
  }
}
