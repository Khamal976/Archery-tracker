import type { Ring, TargetFace } from './types'

/**
 * Фейсы — это данные, а не хардкод: новый можно завести из интерфейса без правки кода.
 * У встроенных фейсов фиксированные id, чтобы при мерже бэкапов с двух устройств
 * они совпадали и не размножались.
 */
const BUILTIN = (n: string) => `00000000-0000-4000-8000-0000000000${n}`

/**
 * Концентрические кольца классического фейса: номинал v имеет внешний радиус (11−v)·w.
 * Возвращает массив по возрастанию радиуса.
 */
export function concentricRings(ringWidthMm: number, highest = 10, lowest = 1): Ring[] {
  const rings: Ring[] = []
  for (let v = highest; v >= lowest; v--) {
    rings.push({ value: v, radiusMm: (11 - v) * ringWidthMm })
  }
  return rings
}

function scoredFace(
  id: string,
  name: string,
  ringWidthMm: number,
  opts: Partial<TargetFace> & { highest?: number; lowest?: number } = {},
): TargetFace {
  const { highest = 10, lowest = 1, ...rest } = opts
  const rings = concentricRings(ringWidthMm, highest, lowest)
  const outer = rings[rings.length - 1].radiusMm
  return {
    id,
    name,
    builtIn: true,
    kind: 'scored',
    widthMm: outer * 2,
    heightMm: outer * 2,
    rings,
    hasX: true,
    xRadiusMm: ringWidthMm / 2,
    innerTenOnly: false,
    spots: null,
    gridStepMm: null,
    updatedAt: 0,
    deletedAt: null,
    ...rest,
  }
}

function blankFace(id: string, name: string, sizeMm: number): TargetFace {
  return {
    id,
    name,
    builtIn: true,
    kind: 'blank',
    widthMm: sizeMm,
    heightMm: sizeMm,
    rings: [],
    hasX: false,
    xRadiusMm: null,
    innerTenOnly: false,
    spots: null,
    gridStepMm: sizeMm >= 800 ? 100 : 50,
    updatedAt: 0,
    deletedAt: null,
  }
}

/** Кольца одного спота трёхспота 40 см: только 6..10, шаг кольца 20 мм. */
const SPOT_RINGS = concentricRings(20, 10, 6)
const SPOT_OUTER = SPOT_RINGS[SPOT_RINGS.length - 1].radiusMm // 100 мм
/** Расстояние между центрами спотов: споты 200 мм в диаметре, зазор 10 мм. */
const SPOT_PITCH = 210

export const FACE_IDS = {
  wa122: BUILTIN('f1'),
  wa80: BUILTIN('f2'),
  wa60: BUILTIN('f3'),
  wa40: BUILTIN('f4'),
  triVertical: BUILTIN('f5'),
  triTriangle: BUILTIN('f6'),
  compound40: BUILTIN('f7'),
  compound80: BUILTIN('f8'),
  blank40: BUILTIN('e1'),
  blank60: BUILTIN('e2'),
  blank80: BUILTIN('e3'),
} as const

export const BUILTIN_FACES: TargetFace[] = [
  scoredFace(FACE_IDS.wa122, 'WA 122 см', 61),
  scoredFace(FACE_IDS.wa80, 'WA 80 см', 40),
  scoredFace(FACE_IDS.wa60, 'WA 60 см', 30),
  scoredFace(FACE_IDS.wa40, 'WA 40 см', 20),

  {
    ...scoredFace(FACE_IDS.triVertical, 'Трёхспот 40 см вертикальный', 20, {
      highest: 10,
      lowest: 6,
    }),
    widthMm: SPOT_OUTER * 2,
    heightMm: SPOT_PITCH * 2 + SPOT_OUTER * 2,
    spots: {
      centers: [
        { x: 0, y: SPOT_PITCH },
        { x: 0, y: 0 },
        { x: 0, y: -SPOT_PITCH },
      ],
      zoneRadiusMm: SPOT_OUTER,
    },
  },

  {
    ...scoredFace(FACE_IDS.triTriangle, 'Трёхспот 40 см треугольный', 20, {
      highest: 10,
      lowest: 6,
    }),
    // Равносторонний треугольник со стороной 210 мм, центр тяжести в начале координат.
    widthMm: 210 + SPOT_OUTER * 2,
    heightMm: 210 / Math.sqrt(3) + 210 / (2 * Math.sqrt(3)) + SPOT_OUTER * 2,
    spots: {
      centers: [
        { x: -105, y: 210 / (2 * Math.sqrt(3)) },
        { x: 105, y: 210 / (2 * Math.sqrt(3)) },
        { x: 0, y: -210 / Math.sqrt(3) },
      ],
      zoneRadiusMm: SPOT_OUTER,
    },
  },

  scoredFace(FACE_IDS.compound40, 'Компаунд 40 см (только внутренняя 10)', 20, {
    innerTenOnly: true,
  }),
  scoredFace(FACE_IDS.compound80, 'Компаунд 80 см, 6 колец (только внутренняя 10)', 40, {
    highest: 10,
    lowest: 5,
    innerTenOnly: true,
    // Внешний край фейса остаётся 80 см, хотя кольца ниже 5 не размечены.
    widthMm: 800,
    heightMm: 800,
  }),

  blankFace(FACE_IDS.blank40, 'Пустой фейс 40 см', 400),
  blankFace(FACE_IDS.blank60, 'Пустой фейс 60 см', 600),
  blankFace(FACE_IDS.blank80, 'Пустой фейс 80 см', 800),
]

export function faceOuterRadiusMm(face: TargetFace): number {
  if (face.rings.length === 0) return Math.max(face.widthMm, face.heightMm) / 2
  return face.rings[face.rings.length - 1].radiusMm
}

/** Номиналы колец по убыванию — для числовой клавиатуры и гистограмм. */
export function faceRingValues(face: TargetFace): number[] {
  return face.rings.map((r) => r.value).sort((a, b) => b - a)
}
