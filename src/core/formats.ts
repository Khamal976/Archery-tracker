import { FACE_IDS } from './faces'
import type { Place } from './types'

/**
 * Стандартные форматы — данные, а не код.
 * Формат задаёт этапы; фейс приходит из формата, но там, где по правилам возможны
 * варианты (18 м на одиночном фейсе или на трёхспоте), формат даёт список
 * допустимых альтернатив и выбор делается на старте сессии.
 */
export interface FormatStage {
  distanceM: number
  defaultFaceId: string
  /** Допустимые фейсы для этого этапа; первый — умолчание. */
  faceOptions: string[]
  /** Число серий; null — не ограничено (свободная тренировка). */
  ends: number | null
  arrowsPerEnd: number
}

export interface ShootingFormat {
  id: string
  name: string
  short: string
  place: Place | null
  /** Ведётся ли счёт. */
  scored: boolean
  /** Участвует ли в личных рекордах. */
  ranked: boolean
  /** Пользователь задаёт этапы сам. */
  customStages: boolean
  stages: FormatStage[]
}

const opts = (...ids: string[]) => ids

export const FORMATS: ShootingFormat[] = [
  {
    id: 'wa18',
    name: 'WA 18 м',
    short: '60 стрел, 20×3',
    place: 'indoor',
    scored: true,
    ranked: true,
    customStages: false,
    stages: [
      {
        distanceM: 18,
        defaultFaceId: FACE_IDS.wa40,
        faceOptions: opts(
          FACE_IDS.wa40,
          FACE_IDS.triVertical,
          FACE_IDS.triTriangle,
          FACE_IDS.compound40,
        ),
        ends: 20,
        arrowsPerEnd: 3,
      },
    ],
  },
  {
    id: 'indoor25',
    name: '25 м в зале',
    short: '60 стрел, 20×3',
    place: 'indoor',
    scored: true,
    ranked: true,
    customStages: false,
    stages: [
      {
        distanceM: 25,
        defaultFaceId: FACE_IDS.wa60,
        faceOptions: opts(FACE_IDS.wa60, FACE_IDS.wa80),
        ends: 20,
        arrowsPerEnd: 3,
      },
    ],
  },
  {
    id: 'wa70',
    name: 'WA 70 м',
    short: '72 стрелы, 12×6, фейс 122',
    place: 'outdoor',
    scored: true,
    ranked: true,
    customStages: false,
    stages: [
      {
        distanceM: 70,
        defaultFaceId: FACE_IDS.wa122,
        faceOptions: opts(FACE_IDS.wa122),
        ends: 12,
        arrowsPerEnd: 6,
      },
    ],
  },
  {
    id: 'wa50compound',
    name: 'WA 50 м компаунд',
    short: '72 стрелы, 12×6, фейс 80 (6 колец)',
    place: 'outdoor',
    scored: true,
    ranked: true,
    customStages: false,
    stages: [
      {
        distanceM: 50,
        defaultFaceId: FACE_IDS.compound80,
        faceOptions: opts(FACE_IDS.compound80, FACE_IDS.wa80),
        ends: 12,
        arrowsPerEnd: 6,
      },
    ],
  },
  {
    id: 'fita900',
    name: 'FITA 900',
    short: '3 этапа по 30 стрел: 60 / 50 / 40 м',
    place: 'outdoor',
    scored: true,
    ranked: true,
    customStages: false,
    stages: [60, 50, 40].map((distanceM) => ({
      distanceM,
      defaultFaceId: FACE_IDS.wa122,
      faceOptions: opts(FACE_IDS.wa122),
      ends: 5,
      arrowsPerEnd: 6,
    })),
  },
  {
    id: 'fita1440',
    name: 'FITA 1440',
    short: '4 этапа по 36 стрел: 90 / 70 / 50 / 30 м',
    place: 'outdoor',
    scored: true,
    ranked: true,
    customStages: false,
    stages: [
      {
        distanceM: 90,
        defaultFaceId: FACE_IDS.wa122,
        faceOptions: opts(FACE_IDS.wa122),
        ends: 6,
        arrowsPerEnd: 6,
      },
      {
        distanceM: 70,
        defaultFaceId: FACE_IDS.wa122,
        faceOptions: opts(FACE_IDS.wa122),
        ends: 6,
        arrowsPerEnd: 6,
      },
      {
        distanceM: 50,
        defaultFaceId: FACE_IDS.wa80,
        faceOptions: opts(FACE_IDS.wa80),
        ends: 12,
        arrowsPerEnd: 3,
      },
      {
        distanceM: 30,
        defaultFaceId: FACE_IDS.wa80,
        faceOptions: opts(FACE_IDS.wa80),
        ends: 12,
        arrowsPerEnd: 3,
      },
    ],
  },
  {
    id: 'free',
    name: 'Свободная тренировка',
    short: 'Со счётом, серий сколько захочется',
    place: null,
    scored: true,
    ranked: false,
    customStages: true,
    stages: [
      {
        distanceM: 18,
        defaultFaceId: FACE_IDS.wa40,
        faceOptions: [],
        ends: null,
        arrowsPerEnd: 3,
      },
    ],
  },
  {
    id: 'blank',
    name: 'Отстрел без счёта',
    short: 'Blank bale: пустой фейс, только координаты и заметки',
    place: null,
    scored: false,
    ranked: false,
    customStages: true,
    stages: [
      {
        distanceM: 5,
        defaultFaceId: FACE_IDS.blank60,
        faceOptions: [],
        ends: null,
        arrowsPerEnd: 6,
      },
    ],
  },
  {
    id: 'custom',
    name: 'Кастомная сессия',
    short: 'Этапы задаю сам',
    place: null,
    scored: true,
    ranked: false,
    customStages: true,
    stages: [
      {
        distanceM: 18,
        defaultFaceId: FACE_IDS.wa40,
        faceOptions: [],
        ends: 10,
        arrowsPerEnd: 6,
      },
    ],
  },
]

export function findFormat(id: string): ShootingFormat | undefined {
  return FORMATS.find((f) => f.id === id)
}

export function formatArrowCount(f: ShootingFormat): number | null {
  let sum = 0
  for (const s of f.stages) {
    if (s.ends === null) return null
    sum += s.ends * s.arrowsPerEnd
  }
  return sum
}
