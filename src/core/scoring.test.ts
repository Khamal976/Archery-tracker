import { describe, expect, it } from 'vitest'
import { BUILTIN_FACES, FACE_IDS, concentricRings } from './faces'
import { resolveHit, ringAt, totals } from './scoring'
import type { TargetFace } from './types'

const face = (id: string): TargetFace => {
  const f = BUILTIN_FACES.find((x) => x.id === id)
  if (!f) throw new Error(`нет фейса ${id}`)
  return f
}

const wa40 = face(FACE_IDS.wa40)
const wa122 = face(FACE_IDS.wa122)
const compound40 = face(FACE_IDS.compound40)
const triVertical = face(FACE_IDS.triVertical)
const blank60 = face(FACE_IDS.blank60)

describe('геометрия колец', () => {
  it('номинал v имеет внешний радиус (11−v)·ширина кольца', () => {
    const rings = concentricRings(20)
    expect(rings[0]).toEqual({ value: 10, radiusMm: 20 })
    expect(rings[rings.length - 1]).toEqual({ value: 1, radiusMm: 200 })
  })

  it('WA 122 — десятка 61 мм, единица 610 мм', () => {
    expect(ringAt(wa122, 61)).toBe(10)
    expect(ringAt(wa122, 610)).toBe(1)
    expect(ringAt(wa122, 610.1)).toBeNull()
  })
})

describe('попадание точно на линию кольца', () => {
  it('идёт в пользу большего номинала', () => {
    // Граница десятки и девятки на WA 40 — ровно 20 мм.
    expect(resolveHit(wa40, { x: 20, y: 0 }).value).toBe(10)
    expect(resolveHit(wa40, { x: 20.0001, y: 0 }).value).toBe(9)
  })

  it('работает и на линии X', () => {
    const onLine = resolveHit(wa40, { x: 10, y: 0 })
    expect(onLine.isX).toBe(true)
    expect(onLine.value).toBe(10)

    const outside = resolveHit(wa40, { x: 10.0001, y: 0 })
    expect(outside.isX).toBe(false)
    expect(outside.value).toBe(10)
  })

  it('на внешней линии единицы это ещё не промах', () => {
    expect(resolveHit(wa40, { x: 200, y: 0 }).isMiss).toBe(false)
    expect(resolveHit(wa40, { x: 200, y: 0 }).value).toBe(1)
  })
})

describe('промах и стрела вне фейса', () => {
  it('за внешним кольцом — промах с нулём, но с координатами', () => {
    const hit = resolveHit(wa40, { x: 200.0001, y: 0 })
    expect(hit.isMiss).toBe(true)
    expect(hit.value).toBe(0)
    expect(hit.local).toEqual({ x: 200.0001, y: 0 })
  })

  it('далеко вне фейса — тоже промах, координаты сохраняются', () => {
    const hit = resolveHit(wa40, { x: -420, y: 380 })
    expect(hit.isMiss).toBe(true)
    expect(hit.value).toBe(0)
    expect(hit.isX).toBe(false)
    expect(hit.radiusMm).toBeCloseTo(Math.hypot(420, 380), 6)
  })
})

describe('компаунд-фейс с флагом «только внутренняя десятка»', () => {
  it('тап в зону внешней десятки даёт 9', () => {
    // 15 мм: внутри кольца 10 (радиус 20), но вне внутренней десятки (радиус 10).
    const hit = resolveHit(compound40, { x: 15, y: 0 })
    expect(hit.value).toBe(9)
    expect(hit.isX).toBe(false)
  })

  it('внутренняя десятка даёт 10 и считается за X', () => {
    const hit = resolveHit(compound40, { x: 5, y: 0 })
    expect(hit.value).toBe(10)
    expect(hit.isX).toBe(true)
  })

  it('ровно на линии внутренней десятки — 10', () => {
    const hit = resolveHit(compound40, { x: 0, y: 10 })
    expect(hit.value).toBe(10)
    expect(hit.isX).toBe(true)
  })

  it('девятка остаётся девяткой', () => {
    expect(resolveHit(compound40, { x: 30, y: 0 }).value).toBe(9)
  })
})

describe('трёхспот', () => {
  it('координаты хранятся относительно центра своего спота', () => {
    const hit = resolveHit(triVertical, { x: 5, y: 215 })
    expect(hit.spotIndex).toBe(0)
    expect(hit.local.x).toBeCloseTo(5, 9)
    expect(hit.local.y).toBeCloseTo(5, 9)
    expect(hit.value).toBe(10)
  })

  it('выстрел ровно на границе спота засчитывается в шестёрку', () => {
    // Зона спота 100 мм, внешнее кольцо спота — шестёрка радиусом 100 мм.
    const hit = resolveHit(triVertical, { x: 0, y: 210 + 100 })
    expect(hit.isMiss).toBe(false)
    expect(hit.value).toBe(6)
    expect(hit.spotIndex).toBe(0)
    expect(hit.local.y).toBeCloseTo(100, 9)
  })

  it('чуть дальше границы спота — промах', () => {
    const hit = resolveHit(triVertical, { x: 0, y: 210 + 100.0001 })
    expect(hit.isMiss).toBe(true)
    expect(hit.value).toBe(0)
  })

  it('кольцо считается от ближайшего спота', () => {
    const bottom = resolveHit(triVertical, { x: 0, y: -210 })
    expect(bottom.spotIndex).toBe(2)
    expect(bottom.isX).toBe(true)

    const middle = resolveHit(triVertical, { x: 0, y: -30 })
    expect(middle.spotIndex).toBe(1)
    expect(middle.value).toBe(9)
  })

  it('между спотами — промах', () => {
    const hit = resolveHit(triVertical, { x: 0, y: 105 })
    expect(hit.isMiss).toBe(true)
  })
})

describe('пустой фейс', () => {
  it('счёт не ведётся, координаты пишутся', () => {
    const hit = resolveHit(blank60, { x: -37.5, y: 120 })
    expect(hit.scored).toBe(false)
    expect(hit.value).toBe(0)
    expect(hit.isMiss).toBe(false)
    expect(hit.local).toEqual({ x: -37.5, y: 120 })
  })
})

describe('суммы по выстрелам', () => {
  it('X даёт 10 очков и отдельный счётчик', () => {
    const t = totals([
      { value: 10, isX: true, isMiss: false },
      { value: 10, isX: false, isMiss: false },
      { value: 9, isX: false, isMiss: false },
      { value: 0, isX: false, isMiss: true },
    ])
    expect(t.total).toBe(29)
    expect(t.xCount).toBe(1)
    expect(t.tenCount).toBe(2)
    expect(t.goldCount).toBe(3)
    expect(t.missCount).toBe(1)
    expect(t.avgPerArrow).toBeCloseTo(7.25, 9)
    expect(t.goldRatio).toBeCloseTo(0.75, 9)
  })

  it('пустой набор не делит на ноль', () => {
    const t = totals([])
    expect(t.total).toBe(0)
    expect(t.avgPerArrow).toBe(0)
    expect(t.xRatio).toBe(0)
  })
})
