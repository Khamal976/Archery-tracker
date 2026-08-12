import { describe, expect, it } from 'vitest'
import { ALL_SHAFTS, SHAFT_SOURCES, type Shaft } from './shafts'

/**
 * Справочники собраны скриптами — один разбирает чужую таблицу Excel, другой тянет
 * страницы с сайта производителя. Оба могут поехать молча при пересборке, поэтому
 * данные проверяются здесь так же, как код.
 */

const bySource = (source: Shaft['source']) => ALL_SHAFTS.filter((s) => s.source === source)

const groups = (rows: Shaft[]): Map<string, Shaft[]> => {
  const map = new Map<string, Shaft[]>()
  for (const r of rows) {
    const key = `${r.brand} / ${r.series}`
    map.set(key, [...(map.get(key) ?? []), r])
  }
  return map
}

describe('состав справочника', () => {
  it('все три источника на месте', () => {
    expect(bySource('stu').length).toBeGreaterThan(400)
    expect(bySource('skylon').length).toBeGreaterThan(100)
    expect(bySource('retail').length).toBeGreaterThan(20)
  })

  it('у каждой записи известен источник со ссылкой', () => {
    for (const s of ALL_SHAFTS) {
      expect(SHAFT_SOURCES[s.source]).toBeDefined()
      expect(SHAFT_SOURCES[s.source].url).toMatch(/^https:\/\//)
    }
  })

  it('нет двух записей с одним ключом «производитель / серия / размер»', () => {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const s of ALL_SHAFTS) {
      const key = `${s.brand}|${s.series}|${s.size}`
      if (seen.has(key)) dupes.push(key)
      seen.add(key)
    }
    expect(dupes).toEqual([])
  })
})

describe('значения в физически осмысленных пределах', () => {
  it('прогиб, GPI и диаметр', () => {
    const bad = ALL_SHAFTS.filter(
      (s) =>
        !(s.deflection > 0.15 && s.deflection < 2.6) ||
        !(s.gpi > 2 && s.gpi < 25) ||
        !(s.od > 0.12 && s.od < 0.5),
    )
    expect(bad.map((s) => `${s.brand} ${s.series} ${s.size}`)).toEqual([])
  })

  it('заводская длина, если указана, правдоподобна', () => {
    const bad = ALL_SHAFTS.filter(
      (s) => s.stockLength !== null && !(s.stockLength >= 24 && s.stockLength <= 36),
    )
    expect(bad.map((s) => `${s.brand} ${s.series} ${s.size} = ${s.stockLength}`)).toEqual([])
  })
})

describe('собранное скрейпингом: разбор страниц не поехал', () => {
  it.each(['skylon', 'retail'] as const)(
    '%s — внутри серии более жёсткий спайн означает большие GPI и диаметр',
    (source) => {
      const problems: string[] = []
      for (const [name, rows] of groups(bySource(source))) {
        const sorted = [...rows].sort((a, b) => b.deflection - a.deflection)
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].gpi < sorted[i - 1].gpi) {
            problems.push(`${name}: GPI падает ${sorted[i - 1].gpi} → ${sorted[i].gpi}`)
          }
          if (sorted[i].od < sorted[i - 1].od) {
            problems.push(`${name}: диаметр падает ${sorted[i - 1].od} → ${sorted[i].od}`)
          }
        }
      }
      expect(problems).toEqual([])
    },
  )

  it('внутри одной серии нет двух строк с одинаковыми числами', () => {
    // Именно внутри серии: между сериями совпадение — норма, а не ошибка.
    // У Skylon Brixxon, Novice и Radius это физически одна трубка id 4.2,
    // отличаются допуском на прямизну и графикой. Схлопывать их нельзя:
    // человек ищет древко по тому имени, что написано на трубке.
    const dupes: string[] = []
    for (const [name, rows] of groups(ALL_SHAFTS.filter((x) => x.source !== 'stu'))) {
      const seen = new Set<string>()
      for (const s of rows) {
        const key = `${s.deflection}|${s.gpi}|${s.od}`
        if (seen.has(key)) dupes.push(`${name} ${s.size}`)
        seen.add(key)
      }
    }
    expect(dupes).toEqual([])
  })
})

describe('Skylon: серии по внутреннему диаметру', () => {
  it('внутри серии более жёсткий спайн означает большие GPI и диаметр', () => {
    const problems: string[] = []
    for (const [name, rows] of groups(bySource('skylon'))) {
      const sorted = [...rows].sort((a, b) => b.deflection - a.deflection)
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].gpi < sorted[i - 1].gpi) {
          problems.push(`${name}: GPI падает ${sorted[i - 1].gpi} → ${sorted[i].gpi}`)
        }
        if (sorted[i].od < sorted[i - 1].od) {
          problems.push(`${name}: диаметр падает ${sorted[i - 1].od} → ${sorted[i].od}`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('размер — это спайн, умноженный на тысячу', () => {
    for (const s of bySource('skylon')) {
      expect(Number(s.size)).toBe(Math.round(s.deflection * 1000))
    }
  })

  it('наружный диаметр больше внутреннего для своей серии', () => {
    // Тонкие серии id 3.2 и 4.2 не могут оказаться толще, чем id 6.2 и 8.0.
    const od = (series: string) =>
      bySource('skylon').filter((s) => s.series === series)[0]?.od ?? 0
    expect(od('Paragon')).toBeLessThan(od('Brixxon'))
    expect(od('Brixxon')).toBeLessThan(od('Instec'))
    expect(od('Instec')).toBeLessThan(od('Bruxx'))
  })
})
