/**
 * Сводный справочник древков: база Stu Miller плюс дособранное с сайтов производителей.
 *
 * Зачем отдельный модуль: оба списка генерируются скриптами и перезаписываются целиком,
 * поэтому склейка живёт здесь, а не внутри сгенерированных файлов.
 *
 * Источник у каждой записи проставлен явно — по нему в интерфейсе видно, откуда взялись
 * цифры, и понятно, какой скрипт запускать, если данные устарели.
 */

import { BLACK_EAGLE_SHAFTS } from './spineDataBlackEagle'
import { SHAFTS, type ShaftSpec } from './spineData'
import { RETAIL_SHAFTS } from './spineDataRetail'
import { SKYLON_SHAFTS } from './spineDataSkylon'

export type ShaftSource = 'stu' | 'skylon' | 'blackEagle' | 'retail'

export interface Shaft extends ShaftSpec {
  source: ShaftSource
  /**
   * Производитель называет древко бочкообразным, а процент не печатает —
   * см. `RetailShaftSpec`. У записей Стю этого поля нет: там переменное
   * сечение задано ненулевым `focComp` и в расчёт входит.
   */
  barreled?: boolean
}

export const SHAFT_SOURCES: Record<ShaftSource, { label: string; url: string }> = {
  stu: {
    label: "Stu Miller's Dynamic Spine Calculator, V3 (2012)",
    url: 'https://heilakka.com/stumiller/',
  },
  skylon: {
    label: 'Skylon Archery, сайт производителя',
    url: 'https://www.skylonarchery.com/',
  },
  blackEagle: {
    label: 'Black Eagle Arrows, сайт производителя',
    url: 'https://blackeaglearrows.com/',
  },
  retail: {
    label: 'Lancaster Archery Supply, карточка товара',
    url: 'https://lancasterarchery.com/',
  },
}

const tag = (rows: ShaftSpec[], source: ShaftSource): Shaft[] =>
  rows.map((r) => ({ ...r, source }))

/**
 * Источники идут от старого к новому, и при совпадении ключа
 * «производитель / серия / размер» побеждает более поздний.
 *
 * Совпадений мало и они трёх видов. Gold Tip Velocity 300 — то же древко, что
 * и в 2012-м, производитель за годы уточнил вес и диаметр на пару сотых:
 * свежая цифра лучше старой. Carbon Express Mach 5 250 — уже другое древко под
 * тем же именем: у Стю это старый размерный код со спайном .404, в нынешнем
 * каталоге — спайн .250. Easton «X 10» и «X10» — одна и та же серия, просто
 * записанная по-разному, и цифры разошлись всерьёз: у Стю на спайне 380 стоит
 * диаметр .263″, а в заводской таблице .215″ — X10 такой толстой не бывает.
 * Показывать обе строки нельзя, они неразличимы в списке; берём ту, которую
 * сегодня можно купить. Ни в одной серии при этом ничего не теряется:
 * у ритейлера все размеры старой записи есть, и сверх них ещё несколько.
 *
 * Ключ сравнивается без пробелов и знаков — иначе «X 10» и «X10» разъезжаются.
 * Слипания от этого не происходит: во всём справочнике так сходится ровно эта
 * пара, а Hunter и Hunter XT остаются разными, как и задумано.
 */
const plain = (series: string) => series.toLowerCase().replace(/[^a-z0-9]/g, '')
const key = (s: Shaft) => `${s.brand}|${plain(s.series)}|${s.size}`

/**
 * Одна серия под двумя именами в разных источниках.
 *
 * У Стю она называется «Rampage», у завода — «Rampage .204»; у ритейлера
 * «PS25 Dan McCarthy Premium Signature Series», у завода просто «PS25».
 * Что это одно древко, видно по числам: на общих размерах они совпадают
 * до знака. Оставляем имя того источника, который ближе к производителю.
 *
 * Условие намеренно узкое — имена в отношении «начало» и совпадающие числа,
 * причём источники обязательно разные. Внутри одного источника скрейпер уже
 * решил, что это разные товары, и лезть туда нельзя: Gold Tip Hunter,
 * Hunter XT и Hunter Pro — физически одна трубка разных допусков, но древко
 * ищут по имени, написанному на трубке, и все три должны остаться.
 */
const CLOSENESS: Record<ShaftSource, number> = { stu: 0, retail: 1, skylon: 2, blackEagle: 2 }

const canonicalNames = (rows: Shaft[]): Map<string, string> => {
  const groups = new Map<string, Shaft[]>()
  for (const s of rows) {
    const k = `${s.brand}|${plain(s.series)}`
    groups.set(k, [...(groups.get(k) ?? []), s])
  }
  const same = (a: Shaft[], b: Shaft[]) => {
    const shared = a.filter((x) => b.some((y) => y.size === x.size))
    return (
      shared.length > 0 &&
      shared.every((x) => {
        const y = b.find((z) => z.size === x.size)!
        return y.deflection === x.deflection && y.gpi === x.gpi && y.od === x.od
      })
    )
  }
  const renames = new Map<string, string>()
  for (const [ka, a] of groups) {
    for (const [kb, b] of groups) {
      const [brandA, nameA] = ka.split('|')
      const [brandB, nameB] = kb.split('|')
      if (ka === kb || brandA !== brandB || !nameA.startsWith(nameB)) continue
      if (CLOSENESS[a[0].source] === CLOSENESS[b[0].source] || !same(a, b)) continue
      const winner = CLOSENESS[a[0].source] > CLOSENESS[b[0].source] ? a : b
      renames.set(ka, winner[0].series)
      renames.set(kb, winner[0].series)
    }
  }
  return renames
}

const merge = (...lists: Shaft[][]): Shaft[] => {
  const all = lists.flat()
  const renames = canonicalNames(all)
  const byKey = new Map<string, Shaft>()
  for (const s of all) {
    const series = renames.get(`${s.brand}|${plain(s.series)}`) ?? s.series
    const row = { ...s, series }
    byKey.set(key(row), row)
  }
  return [...byKey.values()]
}

export const ALL_SHAFTS: Shaft[] = merge(
  tag(SHAFTS, 'stu'),
  tag(SKYLON_SHAFTS, 'skylon'),
  tag(RETAIL_SHAFTS, 'retail'),
  // Производитель идёт после ритейлера: у карточек магазина по этой марке
  // нет наружного диаметра, у завода есть.
  tag(BLACK_EAGLE_SHAFTS, 'blackEagle'),
)
