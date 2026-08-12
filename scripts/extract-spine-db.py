#!/usr/bin/env python3
"""
Извлечение справочников из Stu Miller's Dynamic Spine Calculator в src/core/spineData.ts.

Источник: «Dynamic Spine Calculator Rev 5-12» (V3, май 2012), автор Stu Miller.
Официальная страница отдаёт только V2 (Rev 12-25-10): https://heilakka.com/stumiller/
V3 расходился по форумам напрямую от автора и содержит базу втрое больше.

Скрипт разовый: результат закоммичен, при сборке приложения не запускается.
Нужен, только если базу надо пересобрать или расширить.

    pip install xlrd
    python scripts/extract-spine-db.py "Spine calculator/Dynamic Spine Calculator Rev 5-12  2007-kh-pc.xls"

Устройство листа «New DSC» — данные лежат в скрытых колонках правее видимой формы:
    AB..AR   древки: материал, производитель, серия, размер, прогиб, GPI, диаметр, вставка, хвостовик
    BB..BE   луки: полное имя, КПД, вырез рукоятки
    BG..BI   оперение, тетивы, таблица поправок на положение полки (+ допуск лука)
    AI..AO   хвостовики: имя, вес, диаметр
    BN..BW   породы дерева: плотность и расчётный GPI
"""

import sys
import json
from pathlib import Path

try:
    import xlrd
except ImportError:
    sys.exit('нужен xlrd: pip install xlrd')


def col_index(letters: str) -> int:
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


class Sheet:
    def __init__(self, sheet):
        self.s = sheet

    def get(self, row: int, letters: str):
        """row — 1-based, как в Excel."""
        c = col_index(letters)
        if row - 1 >= self.s.nrows or c >= self.s.ncols:
            return None
        v = self.s.cell_value(row - 1, c)
        return None if v == '' else v

    def num(self, row: int, letters: str, lo: float, hi: float):
        """Число в разумных пределах, иначе None: в колонках вперемешку лежат
        служебные списки выпадающих меню, их надо отсеять."""
        v = self.get(row, letters)
        return v if isinstance(v, float) and lo <= v <= hi else None

    def text(self, row: int, letters: str):
        v = self.get(row, letters)
        if v is None:
            return None
        if isinstance(v, float):
            return str(int(v)) if v == int(v) else str(v)
        return str(v).strip() or None


def pretty(name: str) -> str:
    """В таблицах имена — идентификаторы выпадающих списков: Black_Widow, A_and_H."""
    return name.replace('_and_', ' & ').replace('_', ' ').strip()


def r(x, digits=5):
    return None if x is None else round(x, digits)


# Материалы древков; всё остальное в колонке AB — мусор из служебных списков.
MATERIALS = {
    'Aluminum': 'aluminum',
    'Carbon': 'carbon',
    'Hybrid': 'hybrid',
    'Fiberglass': 'fiberglass',
    'FiberGlass': 'fiberglass',
    'Wood': 'wood',
}


def fixup_shaft(item: dict) -> dict | None:
    """Правки очевидных огрехов исходника. Всё остальное берём как есть.

    - «Wood Shaft» — не запись справочника, а ячейка ручного ввода: в ней застыли
      значения из последнего расчёта владельца файла. Дерево считаем через WOODS.
    - AC Injexion — это Easton, у Стю в колонке производителя оказался материал.
    - «Unknown / Generic» — обобщённый карбон, читается как «Generic / Carbon».
    """
    if item['brand'] == 'Wood Shaft':
        return None
    if item['brand'] == 'Hybrid':
        item['brand'] = 'Easton Hybrid'
        item['material'] = 'hybrid'
    if item['brand'] == 'Unknown' and item['series'] == 'Generic':
        item['brand'] = 'Generic'
        item['series'] = 'Carbon'
    return item


def read_shafts(sh: Sheet, nrows: int):
    out, skipped = [], 0
    for row in range(189, nrows + 1):
        material = sh.text(row, 'AB')
        if material not in MATERIALS:
            continue
        deflection = sh.num(row, 'AG', 0.1, 3.0)   # прогиб ASTM: 1.94 фунта на базе 28"
        gpi = sh.num(row, 'AL', 1.0, 40.0)
        od = sh.num(row, 'AM', 0.1, 0.6)           # наружный диаметр, дюймы
        if deflection is None or gpi is None or od is None:
            skipped += 1
            continue
        brand = sh.text(row, 'AC')
        series = sh.text(row, 'AD')
        size = sh.text(row, 'AE')
        insert_grains = sh.num(row, 'AP', 0.0, 300.0)
        item = fixup_shaft(
            {
                'material': MATERIALS[material],
                'brand': pretty(brand) if brand else '—',
                'series': pretty(series) if series else '',
                'size': size or '',
                'deflection': r(deflection),
                'gpi': r(gpi, 3),
                'od': r(od),
                'stockLength': sh.num(row, 'AN', 20.0, 40.0),
                'insert': sh.text(row, 'AO'),
                'insertGrains': r(insert_grains, 1),
                'nock': sh.text(row, 'AQ'),
            }
        )
        if item is not None:
            out.append(item)
    return out, skipped


def read_bows(sh: Sheet, nrows: int):
    out = []
    for row in range(189, nrows + 1):
        name = sh.text(row, 'BB')
        efficiency = sh.num(row, 'BC', 0.5, 1.5)
        if not name or efficiency is None:
            continue
        riser_cut = sh.get(row, 'BD')
        riser_cut = riser_cut if isinstance(riser_cut, float) and -1.0 <= riser_cut <= 1.0 else None
        # Имя собрано как «производитель модель»; производители пишутся без пробелов.
        brand, _, model = name.partition(' ')
        out.append(
            {
                'brand': pretty(brand),
                'model': pretty(model) or pretty(brand),
                'efficiency': r(efficiency, 3),
                'riserCut': r(riser_cut),
            }
        )
    return out


def read_pairs(sh: Sheet, first: int, last: int, key: str, val: str, lo: float, hi: float):
    out = []
    for row in range(first, last + 1):
        name = sh.text(row, key)
        v = sh.num(row, val, lo, hi)
        if name and v is not None:
            out.append({'name': name, 'value': r(v, 4)})
    return out


def find_row(sh: Sheet, letters: str, needle: str, first: int, last: int):
    for row in range(first, last + 1):
        if sh.text(row, letters) == needle:
            return row
    raise SystemExit(f'не нашёл «{needle}» в колонке {letters}')


def read_strike_table(sh: Sheet, first: int, last: int):
    """Положение полки → поправка к требуемому спайну и допуск лука.

    Допуск («Tol») зависит от того, насколько глубоко вырезана рукоятка:
    у лука, прорезанного за центр, окно подходящих спайнов заметно шире."""
    out = []
    for row in range(first, last + 1):
        pos = sh.get(row, 'BG')
        adj = sh.get(row, 'BH')
        tol = sh.num(row, 'BI', 0.0, 10.0)
        if not isinstance(pos, float) or not isinstance(adj, float) or tol is None:
            continue
        out.append([r(pos), r(adj, 2), r(tol, 4)])
    out.sort(key=lambda t: t[0])
    return out


def read_woods(sh: Sheet, first: int, last: int):
    out = []
    for row in range(first, last + 1):
        name = sh.text(row, 'BN')
        gpi = sh.num(row, 'BW', 3.0, 30.0)
        if name and gpi is not None:
            out.append({'name': name, 'gpi': r(gpi, 2)})
    return out


def read_nocks(sh: Sheet, first: int, last: int):
    # В исходнике есть тёзки с разным весом (Easton 420 UNI Bushing записан дважды,
    # 24 и 23 грана) — оставляем первую строку и сообщаем, чтобы это не потерялось.
    out, seen, dupes = [], set(), []
    for row in range(first, last + 1):
        name = sh.text(row, 'AI')
        grains = sh.num(row, 'AM', 0.5, 60.0)
        if not name or name == 'N/A' or grains is None:
            continue
        if name in seen:
            dupes.append(name)
            continue
        seen.add(name)
        out.append({'name': name, 'grains': r(grains, 1)})
    out.sort(key=lambda x: x['name'])
    return out, dupes


def ts_array(name: str, type_name: str, rows, one_line=True) -> str:
    body = ',\n'.join(
        '  ' + json.dumps(x, ensure_ascii=False, separators=(', ', ': ')) for x in rows
    )
    return f'export const {name}: {type_name}[] = [\n{body},\n]\n'


HEADER = '''/**
 * Справочники динамического расчёта спайна — данные, не логика. Файл сгенерирован.
 *
 * Источник: Stu Miller's Dynamic Spine Calculator, версия V3 (Rev 5-12, май 2012).
 * Страница автора: https://heilakka.com/stumiller/
 * Пересборка: scripts/extract-spine-db.py — руками не правим, правки затрутся.
 *
 * Единицы имперские, как в оригинале: дюймы, граны, фунты.
 * Прогиб (deflection) — по ASTM: 1.94 фунта на базе 28". Формулы работают
 * со стандартом AMO (2 фунта на базе 26"), перевод живёт в core/spine.ts.
 */

export interface ShaftSpec {
  material: 'aluminum' | 'carbon' | 'hybrid' | 'fiberglass' | 'wood'
  brand: string
  series: string
  size: string
  /** Прогиб по ASTM (1.94 фунта / база 28"), дюймы. */
  deflection: number
  /** Вес трубки, гран на дюйм. */
  gpi: number
  /** Наружный диаметр, дюймы. */
  od: number
  /** Заводская длина некроя, дюймы; null — производитель не указал. */
  stockLength: number | null
  /** Рекомендованная вставка и её вес — справочно, в расчёт не идёт. */
  insert: string | null
  insertGrains: number | null
  nock: string | null
}

export interface BowSpec {
  brand: string
  model: string
  /** КПД конструкции: множитель к паспортным фунтам. */
  efficiency: number
  /** Вырез рукоятки относительно центра, дюймы; null — у обобщённых типов. */
  riserCut: number | null
}

export interface NamedValue {
  name: string
  value: number
}

/** Положение полки (дюймы) → [поправка к спайну лука (#), допуск лука (±#)]. */
export type StrikeRow = [position: number, adjustment: number, tolerance: number]
'''


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    if not src.exists():
        sys.exit(f'нет файла: {src}')

    book = xlrd.open_workbook(str(src))
    sh = Sheet(book.sheet_by_name('New DSC'))
    nrows = book.sheet_by_name('New DSC').nrows

    shafts, skipped = read_shafts(sh, nrows)
    bows = read_bows(sh, nrows)

    fletch_head = find_row(sh, 'BG', 'Fletching', 150, 260)
    string_head = find_row(sh, 'BG', 'String types', 150, 280)
    # Между тетивами и подробной таблицей полки лежит её же грубая версия — обрезаем по заголовку.
    coarse_head = find_row(sh, 'BG', 'Strike Position', string_head + 1, 320)
    strike_head = find_row(sh, 'BH', 'Spn Adj', coarse_head + 1, 340)

    fletchings = read_pairs(sh, fletch_head + 1, string_head - 1, 'BG', 'BH', 0.0, 100.0)
    strings = read_pairs(sh, string_head + 1, coarse_head - 1, 'BG', 'BH', 0.5, 2.0)
    strike = read_strike_table(sh, strike_head + 1, strike_head + 120)
    woods = read_woods(sh, 220, 260)
    nocks, nock_dupes = read_nocks(sh, 780, nrows)

    # «Other» задаётся вручную, в справочнике ему делать нечего.
    fletchings = [f for f in fletchings if f['name'] != 'Other']

    parts = [
        HEADER,
        ts_array('SHAFTS', 'ShaftSpec', shafts),
        ts_array('BOWS', 'BowSpec', bows),
        '/** Тип оперения → суммарный вес, граны. */\n'
        + ts_array('FLETCHINGS', 'NamedValue', fletchings),
        '/** Материал и число нитей тетивы → множитель к требуемому спайну. */\n'
        + ts_array('STRINGS', 'NamedValue', strings),
        '/** Порода дерева → средний GPI для трубки 11/32"; для 5/16" умножаем на 0.826. */\n'
        + ts_array('WOODS', 'NamedValue', [{'name': w['name'], 'value': w['gpi']} for w in woods]),
        '/** Хвостовики с весом — справочник для подстановки в поле «вес хвостовика». */\n'
        + ts_array('NOCKS', 'NamedValue', [{'name': n['name'], 'value': n['grains']} for n in nocks]),
        'export const STRIKE_TABLE: StrikeRow[] = [\n'
        + ',\n'.join('  ' + json.dumps(row) for row in strike)
        + ',\n]\n',
    ]

    out = Path('src/core/spineData.ts')
    out.write_text('\n'.join(parts), encoding='utf-8')

    print(f'древки       {len(shafts):5d}  (отброшено неполных: {skipped})')
    print(f'луки         {len(bows):5d}')
    print(f'оперение     {len(fletchings):5d}')
    print(f'тетивы       {len(strings):5d}')
    print(f'породы       {len(woods):5d}')
    print(f'хвостовики   {len(nocks):5d}' + (f'  (отброшено тёзок: {len(nock_dupes)})' if nock_dupes else ''))
    for name in nock_dupes:
        print(f'             тёзка в исходнике: {name}')
    print(f'полка        {len(strike):5d} строк, положение {strike[0][0]}..{strike[-1][0]}"')
    print(f'\n{out} — {out.stat().st_size / 1024:.1f} КБ')


if __name__ == '__main__':
    main()
