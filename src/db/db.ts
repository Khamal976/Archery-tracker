import Dexie, { type Table } from 'dexie'
import { BUILTIN_FACES } from '../core/faces'
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

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'dark',
  lastBackupAt: null,
  wakeLockEnabled: true,
  idleDimSeconds: 60,
  excludeFlyersDefault: false,
  soundEnabled: true,
  vibrationEnabled: true,
  updatedAt: 0,
}

export class ArcheryDb extends Dexie {
  faces!: Table<TargetFace, string>
  setups!: Table<Setup, string>
  setupVersions!: Table<SetupVersion, string>
  sessions!: Table<Session, string>
  stages!: Table<Stage, string>
  ends!: Table<End, string>
  shots!: Table<Shot, string>
  settings!: Table<Settings, string>

  constructor() {
    super('archery-tracker')
    this.version(1).stores({
      faces: 'id, name, updatedAt',
      setups: 'id, name, updatedAt',
      setupVersions: 'id, setupId, versionNo, updatedAt',
      sessions: 'id, startedAt, status, formatId, setupId, updatedAt',
      stages: 'id, sessionId, index, updatedAt',
      ends: 'id, sessionId, stageId, index, updatedAt',
      shots: 'id, sessionId, stageId, endId, updatedAt',
      settings: 'id',
    })

    this.on('populate', async () => {
      await this.faces.bulkAdd(BUILTIN_FACES)
      await this.settings.add({ ...DEFAULT_SETTINGS })
    })
  }
}

export const db = new ArcheryDb()

/**
 * Досев встроенных фейсов: база могла быть создана раньше, чем появился новый фейс,
 * а также могла приехать импортом с другого устройства.
 */
export async function ensureSeed(): Promise<void> {
  const existing = new Set(await db.faces.toCollection().primaryKeys())
  const missing = BUILTIN_FACES.filter((f) => !existing.has(f.id))
  if (missing.length > 0) await db.faces.bulkPut(missing)
  const s = await db.settings.get('settings')
  if (!s) await db.settings.put({ ...DEFAULT_SETTINGS })
}
