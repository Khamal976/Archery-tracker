/**
 * Сводный справочник древков: база Stu Miller плюс дособранное с сайтов производителей.
 *
 * Зачем отдельный модуль: оба списка генерируются скриптами и перезаписываются целиком,
 * поэтому склейка живёт здесь, а не внутри сгенерированных файлов.
 *
 * Источник у каждой записи проставлен явно — по нему в интерфейсе видно, откуда взялись
 * цифры, и понятно, какой скрипт запускать, если данные устарели.
 */

import { SHAFTS, type ShaftSpec } from './spineData'
import { RETAIL_SHAFTS } from './spineDataRetail'
import { SKYLON_SHAFTS } from './spineDataSkylon'

export type ShaftSource = 'stu' | 'skylon' | 'retail'

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
const key = (s: Shaft) =>
  `${s.brand}|${s.series.toLowerCase().replace(/[^a-z0-9]/g, '')}|${s.size}`

const merge = (...lists: Shaft[][]): Shaft[] => {
  const byKey = new Map<string, Shaft>()
  for (const list of lists) {
    for (const s of list) byKey.set(key(s), s)
  }
  return [...byKey.values()]
}

export const ALL_SHAFTS: Shaft[] = merge(
  tag(SHAFTS, 'stu'),
  tag(SKYLON_SHAFTS, 'skylon'),
  tag(RETAIL_SHAFTS, 'retail'),
)
