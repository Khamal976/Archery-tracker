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
import { SKYLON_SHAFTS } from './spineDataSkylon'

export type ShaftSource = 'stu' | 'skylon'

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
}

const tag = (rows: ShaftSpec[], source: ShaftSource): Shaft[] =>
  rows.map((r) => ({ ...r, source }))

export const ALL_SHAFTS: Shaft[] = [...tag(SHAFTS, 'stu'), ...tag(SKYLON_SHAFTS, 'skylon')]
