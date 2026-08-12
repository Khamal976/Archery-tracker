import { describe, expect, it } from 'vitest'
import {
  computeArrow,
  computeBow,
  computeSetup,
  parseInches,
  strikeLookup,
  totalWeight,
  type ArrowInput,
  type BowInput,
} from './spine'

/**
 * Эталоны взяты не с потолка: это значения, посчитанные самим калькулятором Стю
 * и сохранённые внутри его файлов. Если правка формул разойдётся с ними — тест упадёт.
 *
 * Источник 1 — рабочие ячейки листа «New DSC» версии V3 (Rev 5-12):
 *   BK220 требуемый спайн лука, BK222 база, BK223 поправка на диаметр,
 *   BK224 поправка на массу, BK227 динамический спайн, BK209 баланс, BK210 FOC.
 * Источник 2 — лист «Data Library» версии V2 (Rev 12-25-10), сохранённый сетап №1.
 */

const XX75_1916 = {
  deflection: 0.62,
  gpi: 291 / 29,
  od: 0.296875,
} as const

const arrow = (patch: Partial<ArrowInput> = {}): ArrowInput => ({
  ...XX75_1916,
  bop: 30,
  pointGrains: 90,
  insertGrains: 0,
  nockGrains: 16,
  fletchGrains: 18.3,
  footingLength: 0,
  footingGrains: 0,
  isWood: false,
  ...patch,
})

const bow = (patch: Partial<BowInput> = {}): BowInput => ({
  efficiency: 1.07, // Generic Performance Recurve
  ratedWeight: 38,
  ratedDraw: 28,
  drawLength: 28,
  strikePosition: -0.1875,
  stringFactor: 1.03, // FastFlight 16 strand
  formFactor: 0,
  ...patch,
})

describe('стрела, эталон V3', () => {
  it('вес собранной стрелы', () => {
    expect(totalWeight(arrow())).toBeCloseTo(425.3345, 3)
  })

  it('слагаемые динамического спайна', () => {
    const r = computeArrow(arrow())
    expect(r.parts.base).toBeCloseTo(57.2117, 3)
    expect(r.parts.diameter).toBeCloseTo(-1.40625, 5)
    expect(r.parts.mass).toBeCloseTo(2.9544, 3)
    expect(r.parts.gpiFactor).toBeCloseTo(1.0096552, 6)
  })

  it('динамический спайн', () => {
    expect(computeArrow(arrow()).dynamicSpine).toBeCloseTo(59.3272, 3)
  })

  it('баланс и FOC', () => {
    const r = computeArrow(arrow())
    expect(r.balancePoint).toBeCloseTo(12.9281, 3)
    expect(r.foc).toBeCloseTo(6.9063, 3)
  })

  it('статический спайн по AMO', () => {
    expect(computeArrow(arrow()).amoStaticSpine).toBeCloseTo(50.8309, 3)
  })
})

describe('лук, эталон V3', () => {
  it('требуемый спайн', () => {
    expect(computeBow(bow()).requiredSpine).toBeCloseTo(59.8798, 4)
  })

  it('допуск берётся из таблицы положения полки, а не из фунтов', () => {
    const r = computeBow(bow())
    expect(r.tolerance).toBeCloseTo(3.04, 4)
    expect(r.min).toBeCloseTo(56.8398, 4)
    expect(r.max).toBeCloseTo(62.9198, 4)

    // Полка снаружи центра — окно подходящих спайнов заметно уже.
    expect(computeBow(bow({ strikePosition: 0.25 })).tolerance).toBeCloseTo(0.912, 4)
  })

  it('своя растяжка длиннее паспортной поднимает требование', () => {
    const short = computeBow(bow({ drawLength: 28 })).requiredSpine
    const long = computeBow(bow({ drawLength: 30 })).requiredSpine
    expect(long).toBeGreaterThan(short)
  })

  it('персональная поправка сдвигает требование на 1.5% за единицу', () => {
    const base = computeBow(bow({ strikePosition: 0.0945 })) // поправка полки здесь 0
    const shifted = computeBow(bow({ strikePosition: 0.0945, formFactor: 10 }))
    expect(shifted.requiredSpine / base.requiredSpine).toBeCloseTo(1.15, 6)
  })
})

describe('эталон V2: сохранённый сетап из Data Library', () => {
  // 1916, 30", наконечник 75 гран, хвостовик 15.5, Generic Vanes 32 гран.
  const v2Arrow = arrow({ pointGrains: 75, nockGrains: 15.5, fletchGrains: 32 })

  it('вес и FOC', () => {
    const r = computeArrow(v2Arrow)
    expect(r.totalWeight).toBeCloseTo(423.5345, 3)
    expect(r.foc).toBeCloseTo(3.8761, 3)
  })

  it('база и поправки совпадают с V2 (там ещё не было множителя по GPI)', () => {
    const r = computeArrow(v2Arrow)
    const v2Dynamic = r.parts.base + r.parts.diameter + r.parts.mass
    expect(v2Dynamic).toBeCloseTo(67.6784, 3)
  })

  it('требуемый спайн лука на константах V2', () => {
    // Generic Recurve 1.04, 28 фунтов, FastFlight 16 в V2 весил 1.025, полка −0.125.
    const r = computeBow(
      bow({
        efficiency: 1.04,
        ratedWeight: 28,
        stringFactor: 1.025,
        strikePosition: -0.125,
      }),
    )
    expect(r.requiredSpine).toBeCloseTo(44.848, 3)
  })
})

describe('таблица положения полки', () => {
  it('ступенька, как VLOOKUP с приблизительным совпадением', () => {
    expect(strikeLookup(-0.1875).adjustment).toBe(18)
    expect(strikeLookup(0).adjustment).toBe(5)
    // Промежуточное значение округляется вниз до предыдущей строки таблицы.
    expect(strikeLookup(-0.005).adjustment).toBe(5.5)
  })

  it('за пределами таблицы берётся край и поднимается флаг', () => {
    expect(strikeLookup(-0.5)).toMatchObject({ adjustment: 18, clamped: true })
    expect(strikeLookup(2)).toMatchObject({ adjustment: -27, clamped: true })
    expect(strikeLookup(0).clamped).toBe(false)
  })

  it('чем глубже прорезана рукоятка, тем шире допуск', () => {
    expect(strikeLookup(-0.1875).tolerance).toBeGreaterThan(strikeLookup(0).tolerance)
    expect(strikeLookup(0).tolerance).toBeGreaterThan(strikeLookup(0.25).tolerance)
  })
})

describe('направление поправок', () => {
  it('длинная стрела слабее короткой', () => {
    expect(computeArrow(arrow({ bop: 32 })).dynamicSpine).toBeLessThan(
      computeArrow(arrow({ bop: 28 })).dynamicSpine,
    )
  })

  it('тяжёлый наконечник ослабляет стрелу', () => {
    expect(computeArrow(arrow({ pointGrains: 150 })).dynamicSpine).toBeLessThan(
      computeArrow(arrow({ pointGrains: 90 })).dynamicSpine,
    )
  })

  it('футинг: длина делает жёстче, вес — слабее, и вес перевешивает', () => {
    const plain = computeArrow(arrow()).dynamicSpine
    // Сама по себе длина укорачивает рабочую часть древка.
    const lengthOnly = computeArrow(arrow({ footingLength: 1.5, footingGrains: 0 })).dynamicSpine
    expect(lengthOnly).toBeGreaterThan(plain)

    // На практике футинг тяжёлый (латунная вставка 100 гран, HIT), и масса берёт своё:
    // ровно поэтому инструкция требует заводить его отдельно, а не в вес вставки.
    const real = computeArrow(arrow({ footingLength: 1.5, footingGrains: 40 })).dynamicSpine
    expect(real).toBeLessThan(plain)
  })

  it('у деревянного древка вставка в расчёт не идёт', () => {
    const withInsert = arrow({ insertGrains: 30, isWood: true })
    const withoutInsert = arrow({ insertGrains: 0, isWood: true })
    expect(computeArrow(withInsert).dynamicSpine).toBeCloseTo(
      computeArrow(withoutInsert).dynamicSpine,
      10,
    )
    expect(totalWeight(withInsert)).toBe(totalWeight(withoutInsert))
  })
})

describe('связка целиком', () => {
  it('считает расхождение и попадание в допуск', () => {
    const r = computeSetup(arrow(), bow())
    expect(r.delta).toBeCloseTo(59.3272 - 59.8798, 3)
    expect(r.inTolerance).toBe(true)
  })

  it('стрела далеко за окном лука не проходит по допуску', () => {
    const r = computeSetup(arrow({ pointGrains: 300 }), bow())
    expect(r.inTolerance).toBe(false)
    expect(r.delta).toBeLessThan(0)
  })

  it('скорость, энергия и вес на фунт считаются', () => {
    const r = computeSetup(arrow(), bow())
    expect(r.gpp).toBeCloseTo(11.193, 2)
    expect(r.speed).toBeGreaterThan(120)
    expect(r.speed).toBeLessThan(220)
    expect(r.energy).toBeGreaterThan(0)
  })

  it('тонкое таргетное древко получает предупреждение об экстраполяции', () => {
    const r = computeSetup(arrow({ od: 0.204 }), bow())
    expect(r.warnings.some((w) => w.includes('тоньше 6 мм'))).toBe(true)
  })

  it('на разумных данных предупреждений нет', () => {
    expect(computeSetup(arrow(), bow()).warnings).toEqual([])
  })
})

describe('ввод дюймов', () => {
  it('десятичная запись, в том числе с запятой', () => {
    expect(parseInches('0.344')).toBeCloseTo(0.344, 6)
    expect(parseInches('0,063')).toBeCloseTo(0.063, 6)
  })

  it('дробь', () => {
    expect(parseInches('11/32')).toBeCloseTo(11 / 32, 6)
    expect(parseInches('1 / 16')).toBeCloseTo(0.0625, 6)
    expect(parseInches('-3/16')).toBeCloseTo(-0.1875, 6)
  })

  it('мусор и пустая строка дают null', () => {
    expect(parseInches('')).toBeNull()
    expect(parseInches('  ')).toBeNull()
    expect(parseInches('11/0')).toBeNull()
    expect(parseInches('толщина')).toBeNull()
  })
})
