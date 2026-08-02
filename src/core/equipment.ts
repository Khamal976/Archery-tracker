import type { BowType } from './types'

/**
 * Поля сетапа — данные. Версия сетапа хранит снимок значений всех полей своего типа лука,
 * поэтому добавление поля не ломает старые версии: у них его просто нет.
 */
export interface FieldDef {
  key: string
  label: string
  group: string
  kind: 'text' | 'number' | 'textarea'
  unit?: string
  hint?: string
}

export const BOW_TYPES: { value: BowType; label: string }[] = [
  { value: 'recurve', label: 'Классический' },
  { value: 'compound', label: 'Блочный' },
  { value: 'barebow', label: 'Барбоу' },
  { value: 'traditional', label: 'Традиционный' },
]

export function bowTypeLabel(t: BowType): string {
  return BOW_TYPES.find((b) => b.value === t)?.label ?? t
}

const COMMON: FieldDef[] = [
  { key: 'riser', label: 'Рукоятка', group: 'Лук', kind: 'text' },
  { key: 'bowLength', label: 'Длина лука', group: 'Лук', kind: 'text', unit: 'дюйм' },
  { key: 'drawWeight', label: 'Натяжение на пальцах', group: 'Лук', kind: 'number', unit: 'фунт' },

  { key: 'stringMaterial', label: 'Материал тетивы', group: 'Тетива', kind: 'text' },
  { key: 'stringStrands', label: 'Число нитей', group: 'Тетива', kind: 'number' },
  { key: 'braceHeight', label: 'Brace height', group: 'Тетива', kind: 'number', unit: 'мм' },

  { key: 'arrowModel', label: 'Модель стрел', group: 'Стрелы', kind: 'text' },
  { key: 'arrowSpine', label: 'Спайн', group: 'Стрелы', kind: 'text' },
  { key: 'arrowLength', label: 'Длина стрелы', group: 'Стрелы', kind: 'number', unit: 'дюйм' },
  { key: 'pointWeight', label: 'Вес наконечника', group: 'Стрелы', kind: 'number', unit: 'гран' },
  { key: 'fletching', label: 'Оперение', group: 'Стрелы', kind: 'text' },
  {
    key: 'shaftDiameter',
    label: 'Диаметр трубки',
    group: 'Стрелы',
    kind: 'number',
    unit: 'мм',
    hint: 'Справочно, в счёте не участвует',
  },

  { key: 'sightModel', label: 'Прицел', group: 'Прицел', kind: 'text' },
  {
    key: 'sightMarks',
    label: 'Текущие деления',
    group: 'Прицел',
    kind: 'textarea',
    hint: 'Например: 18 м — 12.5, 50 м — 34.0',
  },
]

const RECURVE: FieldDef[] = [
  { key: 'limbsModel', label: 'Плечи, модель', group: 'Плечи', kind: 'text' },
  { key: 'limbsLength', label: 'Плечи, длина', group: 'Плечи', kind: 'text' },
  { key: 'limbsMarked', label: 'Маркированные фунты', group: 'Плечи', kind: 'number', unit: 'фунт' },
  {
    key: 'limbBolts',
    label: 'Усиление/ослабление',
    group: 'Плечи',
    kind: 'text',
    hint: 'В оборотах болтов от упора',
  },
  { key: 'tillerTop', label: 'Тиллер верхний', group: 'Плечи', kind: 'number', unit: 'мм' },
  { key: 'tillerBottom', label: 'Тиллер нижний', group: 'Плечи', kind: 'number', unit: 'мм' },

  { key: 'plungerModel', label: 'Плунжер, модель', group: 'Плунжер', kind: 'text' },
  { key: 'plungerTension', label: 'Жёсткость', group: 'Плунжер', kind: 'text' },
  { key: 'plungerPosition', label: 'Положение', group: 'Плунжер', kind: 'text' },

  { key: 'stabLong', label: 'Длинный стабилизатор', group: 'Стабилизация', kind: 'text' },
  { key: 'stabSide', label: 'Боковые', group: 'Стабилизация', kind: 'text' },
  { key: 'stabExtender', label: 'Удлинитель', group: 'Стабилизация', kind: 'text' },
  { key: 'stabVbar', label: 'V-bar', group: 'Стабилизация', kind: 'text' },
  { key: 'stabWeights', label: 'Веса и углы', group: 'Стабилизация', kind: 'textarea' },

  { key: 'clicker', label: 'Кликер', group: 'Прочее', kind: 'text' },
]

const COMPOUND: FieldDef[] = [
  { key: 'peakWeight', label: 'Пиковая нагрузка', group: 'Блочная система', kind: 'number', unit: 'фунт' },
  { key: 'letOff', label: 'Лет-офф', group: 'Блочная система', kind: 'number', unit: '%' },
  { key: 'drawLength', label: 'Длина растяжки', group: 'Блочная система', kind: 'number', unit: 'дюйм' },
  { key: 'cams', label: 'Кулачки и модули', group: 'Блочная система', kind: 'text' },

  { key: 'release', label: 'Релиз', group: 'Прицельные', kind: 'text' },
  { key: 'peep', label: 'Пип', group: 'Прицельные', kind: 'text' },
  { key: 'scope', label: 'Скоуп', group: 'Прицельные', kind: 'text' },
  { key: 'lens', label: 'Линза', group: 'Прицельные', kind: 'text' },

  { key: 'stabLong', label: 'Длинный стабилизатор', group: 'Стабилизация', kind: 'text' },
  { key: 'stabSide', label: 'Боковые', group: 'Стабилизация', kind: 'text' },
  { key: 'stabWeights', label: 'Веса и углы', group: 'Стабилизация', kind: 'textarea' },
]

const BAREBOW: FieldDef[] = [
  { key: 'weightMass', label: 'Вес груза', group: 'Барбоу', kind: 'text' },
  { key: 'crawlGrip', label: 'Точка захвата', group: 'Барбоу', kind: 'text' },
  {
    key: 'stringwalkMarks',
    label: 'Метки стрингволкинга',
    group: 'Барбоу',
    kind: 'textarea',
    hint: 'Дистанция — метка на тэбе',
  },
]

const TRADITIONAL: FieldDef[] = [
  { key: 'tradType', label: 'Тип лука', group: 'Традиционный', kind: 'text' },
  { key: 'aimingMethod', label: 'Способ прицеливания', group: 'Традиционный', kind: 'text' },
]

const BY_BOW: Record<BowType, FieldDef[]> = {
  recurve: RECURVE,
  compound: COMPOUND,
  barebow: BAREBOW,
  traditional: TRADITIONAL,
}

/** Полный набор полей для типа лука: общие + специфичные. */
export function fieldsFor(bowType: BowType): FieldDef[] {
  return [...COMMON, ...BY_BOW[bowType]]
}

/** Поля, сгруппированные по разделам, в порядке появления. */
export function groupedFieldsFor(bowType: BowType): { group: string; fields: FieldDef[] }[] {
  const out: { group: string; fields: FieldDef[] }[] = []
  for (const f of fieldsFor(bowType)) {
    let bucket = out.find((g) => g.group === f.group)
    if (!bucket) {
      bucket = { group: f.group, fields: [] }
      out.push(bucket)
    }
    bucket.fields.push(f)
  }
  return out
}

/** Что изменилось между двумя снимками полей. */
export interface FieldChange {
  key: string
  label: string
  from: string
  to: string
}

export function diffFields(
  bowType: BowType,
  before: Record<string, string>,
  after: Record<string, string>,
): FieldChange[] {
  const defs = fieldsFor(bowType)
  const changes: FieldChange[] = []
  for (const d of defs) {
    const from = before[d.key] ?? ''
    const to = after[d.key] ?? ''
    if (from !== to) changes.push({ key: d.key, label: d.label, from, to })
  }
  return changes
}
