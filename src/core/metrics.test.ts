import { describe, expect, it } from 'vitest'
import { percentile, toMrad } from './geometry'
import {
  computePrecision,
  flyerFlags,
  samplesFromShots,
  samplesToMrad,
  scalePrecision,
  sightAdvice,
} from './metrics'
import type { Point } from './types'

const ok = (r: ReturnType<typeof computePrecision>) => {
  if (r.insufficient) throw new Error('ожидались посчитанные метрики')
  return r
}

describe('порог данных', () => {
  it('серия без координат: метрик нет, нулей не подставляем', () => {
    const samples = samplesFromShots([
      { x: null, y: null },
      { x: null, y: null },
      { x: null, y: null },
    ])
    expect(samples).toHaveLength(0)
    const r = computePrecision(samples)
    expect(r.insufficient).toBe(true)
    expect(r.n).toBe(0)
  })

  it('серия из одного выстрела — мало данных', () => {
    const r = computePrecision([{ x: 12, y: -3 }])
    expect(r.insufficient).toBe(true)
    expect(r.n).toBe(1)
  })

  it('серия из двух выстрелов — всё ещё мало данных', () => {
    const r = computePrecision([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ])
    expect(r.insufficient).toBe(true)
    expect(r.n).toBe(2)
  })

  it('три выстрела — уже группа', () => {
    const r = computePrecision([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ])
    expect(r.insufficient).toBe(false)
    expect(r.n).toBe(3)
  })

  it('смешанная серия: считаются только выстрелы с координатами', () => {
    const samples = samplesFromShots([
      { x: 1, y: 2 },
      { x: null, y: null },
      { x: 3, y: 4 },
    ])
    expect(samples).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ])
  })
})

describe('кучность', () => {
  const square: Point[] = [
    { x: -10, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 },
    { x: 0, y: -10 },
  ]

  it('центроид, mean radius и extreme spread', () => {
    const r = ok(computePrecision(square))
    expect(r.centroid.x).toBeCloseTo(0, 9)
    expect(r.centroid.y).toBeCloseTo(0, 9)
    expect(r.meanRadius).toBeCloseTo(10, 9)
    expect(r.extremeSpread).toBeCloseTo(20, 9)
  })

  it('mean radius считается от центроида, а не от центра мишени', () => {
    // Та же группа, сдвинутая на 100 мм вправо: разброс не изменился.
    const shifted = square.map((p) => ({ x: p.x + 100, y: p.y }))
    const r = ok(computePrecision(shifted))
    expect(r.meanRadius).toBeCloseTo(10, 9)
    expect(r.centroid.x).toBeCloseTo(100, 9)
  })

  it('СКО по осям — выборочное, делитель n−1', () => {
    const r = ok(computePrecision(square))
    expect(r.sdX).toBeCloseTo(Math.sqrt(200 / 3), 9)
    expect(r.sdY).toBeCloseTo(Math.sqrt(200 / 3), 9)
    expect(r.sdR).toBeCloseTo(Math.hypot(Math.sqrt(200 / 3), Math.sqrt(200 / 3)), 9)
  })

  it('эллипс рассеивания разворачивается вдоль вытянутой группы', () => {
    const vertical: Point[] = [
      { x: 0, y: -40 },
      { x: 1, y: 0 },
      { x: -1, y: 20 },
      { x: 0, y: 40 },
    ]
    const r = ok(computePrecision(vertical))
    expect(r.ellipse).not.toBeNull()
    expect(r.ellipse!.rx).toBeGreaterThan(r.ellipse!.ry)
    expect(Math.abs(r.ellipse!.angleDeg)).toBeGreaterThan(45)
  })
})

describe('CEP — эмпирический перцентиль', () => {
  it('перцентиль с линейной интерполяцией (тип 7)', () => {
    expect(percentile([0, 10], 0.5)).toBeCloseTo(5, 9)
    expect(percentile([0, 10, 20], 0.5)).toBeCloseTo(10, 9)
    expect(percentile([0, 10, 20], 0.95)).toBeCloseTo(19, 9)
    expect(percentile([7], 0.95)).toBe(7)
  })

  it('на трёх точках CEP95 почти упирается в максимум', () => {
    const r = ok(
      computePrecision([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 10 },
      ]),
    )
    // Радиусы от центроида (0; 3.333): 3.333, 3.333, 6.667.
    expect(r.cep50).toBeCloseTo(10 / 3, 9)
    expect(r.cep95).toBeCloseTo(10 / 3 + 0.9 * (10 / 3), 9)
    expect(r.cep95).toBeLessThan(20 / 3)
    expect(r.cep95Approx).toBe(true)
  })

  it('на выборке от десяти пометка «ориентировочно» снимается', () => {
    const many: Point[] = Array.from({ length: 10 }, (_, i) => ({ x: i, y: -i }))
    expect(ok(computePrecision(many)).cep95Approx).toBe(false)
  })

  it('половина точек не дальше CEP50', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: -5, y: 0 },
      { x: 0, y: 30 },
      { x: 0, y: -30 },
    ]
    const r = ok(computePrecision(pts))
    const within = pts.filter((p) => Math.hypot(p.x - r.centroid.x, p.y - r.centroid.y) <= r.cep50)
    expect(within.length).toBeGreaterThanOrEqual(Math.floor(pts.length / 2))
  })
})

describe('флаеры', () => {
  const cluster: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 },
    { x: 10, y: 10 },
    { x: 5, y: 5 },
  ]

  it('на выборке меньше пяти точек пометок нет', () => {
    expect(flyerFlags(cluster.slice(0, 4))).toEqual([false, false, false, false])
  })

  it('одинокий далёкий выстрел помечается', () => {
    const flags = flyerFlags([...cluster, { x: 150, y: 0 }])
    expect(flags).toEqual([false, false, false, false, false, true])
  })

  it('ровная группа без выбросов пометок не даёт', () => {
    expect(flyerFlags(cluster)).toEqual([false, false, false, false, false])
  })

  it('совпадающие точки не ломают деление на ноль', () => {
    const same: Point[] = Array.from({ length: 6 }, () => ({ x: 4, y: 4 }))
    expect(flyerFlags(same).some(Boolean)).toBe(false)
  })
})

describe('угловые единицы', () => {
  it('mrad = мм на мишени / дистанция в метрах', () => {
    expect(toMrad(10, 18)).toBeCloseTo(10 / 18, 9)
    expect(toMrad(100, 70)).toBeCloseTo(100 / 70, 9)
    expect(toMrad(18, 18)).toBeCloseTo(1, 9)
  })

  it('одна и та же группа на 18 и 70 м сравнима в mrad', () => {
    const at18: Point[] = [
      { x: 0, y: 0 },
      { x: 18, y: 0 },
      { x: 0, y: 18 },
    ]
    const at70 = at18.map((p) => ({ x: (p.x / 18) * 70, y: (p.y / 18) * 70 }))
    const m18 = ok(computePrecision(samplesToMrad(at18, 18)))
    const m70 = ok(computePrecision(samplesToMrad(at70, 70)))
    expect(m18.meanRadius).toBeCloseTo(m70.meanRadius, 9)
    expect(m18.cep50).toBeCloseTo(m70.cep50, 9)
  })

  it('пересчёт готовых метрик множителем совпадает с пересчётом выборки', () => {
    const mm: Point[] = [
      { x: 12, y: -4 },
      { x: -8, y: 20 },
      { x: 3, y: 3 },
      { x: -15, y: -9 },
    ]
    const direct = ok(computePrecision(samplesToMrad(mm, 50)))
    const scaled = ok(scalePrecision(computePrecision(mm), 1 / 50))
    expect(scaled.meanRadius).toBeCloseTo(direct.meanRadius, 9)
    expect(scaled.cep95).toBeCloseTo(direct.cep95, 9)
    expect(scaled.extremeSpread).toBeCloseTo(direct.extremeSpread, 9)
    expect(scaled.centroid.x).toBeCloseTo(direct.centroid.x, 9)
  })
})

describe('подсказка по прицелу', () => {
  it('на малой выборке подсказки нет', () => {
    const a = sightAdvice([
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    ])
    expect(a.enough).toBe(false)
    expect(a.any).toBe(false)
  })

  it('центрированная группа подсказки не даёт', () => {
    const a = sightAdvice([
      { x: -10, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: 0, y: -10 },
    ])
    expect(a.any).toBe(false)
    expect(a.horizontal.significant).toBe(false)
    expect(a.vertical.significant).toBe(false)
  })

  it('группа ушла вправо — прицел вправо, вслед за группой', () => {
    const a = sightAdvice([
      { x: 30, y: 0 },
      { x: 35, y: 0 },
      { x: 25, y: 0 },
      { x: 30, y: 5 },
      { x: 30, y: -5 },
    ])
    expect(a.horizontal.significant).toBe(true)
    expect(a.horizontal.direction).toBe('right')
    expect(a.horizontal.offset).toBeCloseTo(30, 9)
    expect(a.vertical.significant).toBe(false)
  })

  it('группа ушла вниз — прицел вниз', () => {
    const a = sightAdvice([
      { x: 0, y: -40 },
      { x: 5, y: -45 },
      { x: -5, y: -35 },
      { x: 0, y: -42 },
      { x: 0, y: -38 },
    ])
    expect(a.vertical.direction).toBe('down')
    expect(a.horizontal.significant).toBe(false)
  })

  it('шумная группа с небольшим смещением значимой не считается', () => {
    const a = sightAdvice([
      { x: 60, y: 0 },
      { x: -50, y: 0 },
      { x: 5, y: 0 },
      { x: -10, y: 0 },
    ])
    expect(a.horizontal.significant).toBe(false)
  })
})
