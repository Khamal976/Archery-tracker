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
  it('все четыре источника на месте', () => {
    expect(bySource('stu').length).toBeGreaterThan(400)
    expect(bySource('skylon').length).toBeGreaterThan(100)
    expect(bySource('retail').length).toBeGreaterThan(300)
    expect(bySource('blackEagle').length).toBeGreaterThan(70)
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
    // Нижняя граница прогиба — 0.09, а не 0.15: толстые 3D-древки Gold Tip
    // жёстче всего, что знала база 2012 года (самое жёсткое там — .175).
    // У Triple X при диаметре .421″ заявлен спайн .100, и на проверку
    // «жёсткость по диаметру и весу» ниже он ложится нормально.
    const bad = ALL_SHAFTS.filter(
      (s) =>
        !(s.deflection >= 0.09 && s.deflection < 2.6) ||
        !(s.gpi > 2 && s.gpi < 25) ||
        !(s.od > 0.12 && s.od < 0.5),
    )
    expect(bad.map((s) => `${s.brand} ${s.series} ${s.size}`)).toEqual([])
  })

  it('спайн сходится с диаметром и весом трубки', () => {
    // У тонкостенной трубы жёсткость на изгиб растёт как D³·стенка, а вес на
    // дюйм — как D·стенка, поэтому произведение «прогиб × D² × GPI» почти не
    // зависит от модели. По всем 1097 записям справочника оно держится внутри
    // 0.10…0.90; выход за коридор означает не экзотическое древко, а неверно
    // прочитанную колонку — коды алюминиевых трубок дают 2.9…4.2,
    // миллиметры вместо дюймов — за сотню.
    const bad = ALL_SHAFTS.filter((s) => {
      const k = s.deflection * s.od ** 2 * s.gpi
      return !(k >= 0.1 && k <= 0.9)
    })
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
  // Проверки «внутри серии более жёсткий спайн означает большие GPI и диаметр»
  // здесь нет намеренно. У Skylon она держится и живёт ниже, в своём разделе:
  // там серия — это одна трубка, вытянутая на разные спайны. На заводских
  // таблицах ритейлера она ложная. У X10 спайн 350 весит 8.8 гран, а более
  // слабый 380 — 8.9. У X10 Parallel Pro самый слабый 1150 толще, чем 1000:
  // это уже другая трубка того же семейства. У алюминия размер задаёт диаметр
  // и стенку независимо, и 2016 честно тяжелее более жёсткого 2114. Роль
  // сторожа вместо неё играет проверка «спайн сходится с диаметром и весом».

  it('бочкообразность у ритейлера размечена по словам страницы', () => {
    // Флаг ставится по фразам о самой трубке, и легко промахнуться: у Victory
    // «Taper Lock» — это вставка, у XX75 Tribute «nock swage» — обжим под
    // хвостовик. Проверяем обе стороны: что помечено нужное и что не помечено
    // лишнее. X10 Parallel Pro для того здесь и стоит — он одноимённый
    // с бочкообразным X10, но параллельный, о чём сказано прямо в названии.
    const series = (name: string) => bySource('retail').filter((s) => s.series === name)
    for (const name of ['X10', 'X10 ProTour', 'A/C/E', 'Maxima RED']) {
      expect(series(name).length).toBeGreaterThan(0)
      expect(series(name).every((s) => s.barreled)).toBe(true)
    }
    for (const name of ['X10 Parallel Pro 4mm', 'X10 3.2mm Parallel Pro', 'VAP TKO Elite V1']) {
      expect(series(name).length).toBeGreaterThan(0)
      expect(series(name).some((s) => s.barreled)).toBe(false)
    }
  })

  it('у бочкообразных записей ритейлера поправка нулевая — иначе предупреждение лишнее', () => {
    // Экран показывает предупреждение при `barreled && !focComp`. Если бы
    // источник вдруг начал давать процент, предупреждение стало бы враньём.
    const bad = bySource('retail').filter((s) => s.barreled && s.focComp !== 0)
    expect(bad.map((s) => `${s.series} ${s.size}`)).toEqual([])
  })

  it('одна серия под двумя именами сведена к имени ближайшего к заводу источника', () => {
    // У Стю древко зовётся «Rampage», у завода — «Rampage .204»; у ритейлера
    // «PS25 Dan McCarthy Premium Signature Series», у завода просто «PS25».
    // Числа на общих размерах совпадают до знака, значит это одно древко,
    // и в списке оно должно быть одной строкой.
    const names = new Set(ALL_SHAFTS.filter((s) => s.brand === 'Black Eagle').map((s) => s.series))
    expect(names.has('Rampage .204')).toBe(true)
    expect(names.has('Rampage')).toBe(false)
    expect(names.has('PS25')).toBe(true)
    expect(names.has('PS25 Dan McCarthy Premium Signature Series')).toBe(false)
    // Размеры обеих записей на месте: у завода их больше, чем было у Стю.
    const rampage = ALL_SHAFTS.filter((s) => s.series === 'Rampage .204')
    expect(rampage.map((s) => s.size).sort()).toEqual(['150', '200', '250', '300', '350', '400'])
  })

  it('серии одного источника не слипаются, даже если числа совпадают', () => {
    // Gold Tip Hunter, Hunter XT и Hunter Pro — физически одна трубка разных
    // допусков, имена в отношении «начало», но древко ищут по имени на трубке.
    const names = new Set(ALL_SHAFTS.map((s) => s.series))
    for (const name of ['Hunter', 'Hunter XT', 'Hunter Pro']) {
      expect(names.has(name)).toBe(true)
    }
  })

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
