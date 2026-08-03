/**
 * Доменные типы приложения.
 *
 * КОНВЕНЦИЯ КООРДИНАТ (единая для хранения, метрик, CSV и подсказки по прицелу):
 *   +x — вправо, +y — вверх, с точки зрения стрелка, смотрящего на мишень.
 *   Начало координат — центр фейса; для многоспотовых фейсов — центр своего спота.
 *   Единица — миллиметры. Диаметр стрелы не учитывается: точка тапа это точка.
 *
 * SVG рисует y вниз — перевод живёт ровно в одном месте, см. core/viewbox.ts.
 */

export interface Point {
  x: number
  y: number
}

// ---------------------------------------------------------------- мишени

export interface Ring {
  /** Номинал кольца, 1..10. */
  value: number
  /** Внешний радиус кольца в мм от центра счёта. */
  radiusMm: number
}

export interface SpotGeometry {
  /** Центры спотов в координатах фейса, мм. */
  centers: Point[]
  /** Радиус зоны спота: дальше — промах мимо всех спотов. */
  zoneRadiusMm: number
}

export type FaceKind = 'scored' | 'blank'

export interface TargetFace {
  id: string
  name: string
  builtIn: boolean
  kind: FaceKind
  /** Габариты листа для отрисовки, мм. */
  widthMm: number
  heightMm: number
  /** Кольца по возрастанию радиуса; для многоспотовых — относительно центра спота. */
  rings: Ring[]
  hasX: boolean
  xRadiusMm: number | null
  /** Компаунд-фейс: внешняя десятка засчитывается как 9. */
  innerTenOnly: boolean
  spots: SpotGeometry | null
  /** Шаг координатной сетки для пустого фейса, мм. */
  gridStepMm: number | null
  updatedAt: number
  deletedAt: number | null
}

/** Результат разбора тапа по фейсу. */
export interface HitResolution {
  /** Индекс спота для многоцелевых фейсов, иначе null. */
  spotIndex: number | null
  /** Координаты относительно своего центра счёта, мм. */
  local: Point
  /** Расстояние от центра счёта, мм. */
  radiusMm: number
  /** Очки: 0 для промаха и для фейса без счёта. */
  value: number
  isX: boolean
  isMiss: boolean
  /** false для пустого фейса — счёт не ведётся. */
  scored: boolean
}

// ---------------------------------------------------------------- снаряжение

export type BowType = 'recurve' | 'compound' | 'barebow' | 'traditional'

export interface Setup {
  id: string
  name: string
  bowType: BowType
  /** id текущей (последней) версии. */
  currentVersionId: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface SetupVersion {
  id: string
  setupId: string
  versionNo: number
  createdAt: number
  /** Причина изменения — почему завели новую версию. */
  reason: string
  /** Снимок всех полей сетапа: ключ поля -> значение. */
  fields: Record<string, string>
  updatedAt: number
  deletedAt: number | null
}

// ---------------------------------------------------------------- сессии

export type SessionStatus = 'active' | 'paused' | 'finished'
export type Place = 'indoor' | 'outdoor'
export type InputMode = 'target' | 'numbers'
export type SpotMode = 'onePerSpot' | 'free'

export interface TimerConfig {
  enabled: boolean
  /** Длительность серии, с. Обычно 120 или 240. */
  seconds: number
  /** Режим AB/CD: после своей серии идёт равная по времени чужая. */
  abcd: boolean
  /** Подготовка перед серией, с. */
  prepSeconds: number
}

export interface Session {
  id: string
  /** id формата из core/formats.ts или 'custom' / 'free' / 'blank'. */
  formatId: string
  /** Снимок названия формата на момент старта. */
  formatName: string
  setupId: string | null
  setupVersionId: string | null
  place: Place
  /** Заметка перед стартом: погода, ветер, самочувствие. */
  note: string
  /** Разбор после сессии: как себя чувствовал, что не получилось, где были ошибки. */
  debrief: string
  startedAt: number
  finishedAt: number | null
  status: SessionStatus
  /** Накопленное активное время, мс (пауза не считается). */
  activeMs: number
  /** Момент последнего возобновления, мс; null если на паузе. */
  lastResumedAt: number | null
  timer: TimerConfig | null
  /** Ведётся ли счёт: false для отстрела без счёта. */
  scored: boolean
  /** Полная ли сессия: false если завершена досрочно или это свободная тренировка. */
  complete: boolean
  updatedAt: number
  deletedAt: number | null
}

export interface Stage {
  id: string
  sessionId: string
  index: number
  distanceM: number
  faceId: string
  /** Число серий; null — свободная тренировка, стреляем пока не надоест. */
  endsPlanned: number | null
  arrowsPerEnd: number
  updatedAt: number
  deletedAt: number | null
}

export interface End {
  id: string
  sessionId: string
  stageId: string
  index: number
  inputMode: InputMode
  spotMode: SpotMode
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface Shot {
  id: string
  sessionId: string
  stageId: string
  endId: string
  /** Номер стрелы в серии, с нуля. */
  index: number
  /** Координаты от центра счёта, мм. null — серия введена числами. */
  x: number | null
  y: number | null
  spotIndex: number | null
  /** Очки. 0 для промаха и для фейса без счёта. */
  value: number
  isX: boolean
  isMiss: boolean
  /** Трёхспот в режиме «по одной в спот»: спот уже был занят. */
  repeatedSpot: boolean
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

// ---------------------------------------------------------------- обратная связь

export type FeedbackKind = 'bug' | 'idea' | 'note'
export type FeedbackStatus = 'open' | 'done'

/**
 * Заметка о самом приложении: что сломалось, чего не хватает, что мешает.
 * Пишется офлайн и хранится рядом с остальными данными, поэтому попадает
 * в бэкап и переезжает между устройствами вместе с тренировками.
 */
export interface Feedback {
  id: string
  kind: FeedbackKind
  text: string
  status: FeedbackStatus
  /** Где это случилось: экран или сценарий, если пользователь указал. */
  context: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

// ---------------------------------------------------------------- настройки

export type ThemeName = 'dark' | 'light'

export interface Settings {
  id: 'settings'
  theme: ThemeName
  lastBackupAt: number | null
  wakeLockEnabled: boolean
  /** Через сколько секунд без ввода гасить экран дежурным слоем. 0 — никогда. */
  idleDimSeconds: number
  excludeFlyersDefault: boolean
  soundEnabled: boolean
  vibrationEnabled: boolean
  updatedAt: number
}
