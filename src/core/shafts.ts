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
 * Совпадений мало и они двух видов. Gold Tip Velocity 300 — то же древко, что
 * и в 2012-м, производитель за годы уточнил вес и диаметр на пару сотых:
 * свежая цифра лучше старой. Carbon Express Mach 5 250 — уже другое древко под
 * тем же именем: у Стю это старый размерный код со спайном .404, в нынешнем
 * каталоге — спайн .250. Показывать обе строки нельзя, они неразличимы в
 * списке; берём ту, которую сегодня можно купить. Ни в одной серии при этом
 * ничего не теряется: у ритейлера все размеры старой записи есть, и сверх них
 * ещё несколько.
 */
const merge = (...lists: Shaft[][]): Shaft[] => {
  const byKey = new Map<string, Shaft>()
  for (const list of lists) {
    for (const s of list) byKey.set(`${s.brand}|${s.series}|${s.size}`, s)
  }
  return [...byKey.values()]
}

export const ALL_SHAFTS: Shaft[] = merge(
  tag(SHAFTS, 'stu'),
  tag(SKYLON_SHAFTS, 'skylon'),
  tag(RETAIL_SHAFTS, 'retail'),
)
