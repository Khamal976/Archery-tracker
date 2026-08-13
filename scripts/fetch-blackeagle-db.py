#!/usr/bin/env python3
"""
Спек-таблицы древков Black Eagle с сайта производителя в src/core/spineDataBlackEagle.ts.

Зачем отдельно: база Стю собрана в 2012 году и этой марки почти не знает,
а карточки ритейлера по Black Eagle дают спайн и GPI без наружного диаметра —
в расчёт он входит напрямую, и такие модели скрейпер ритейлера пропускает.
Производитель же печатает полную таблицу: спайн, внутренний и наружный диаметр, GPI.

    python scripts/fetch-blackeagle-db.py

Скрипт разовый, результат закоммичен. Сеть нужна только при пересборке.

Соседние марки проверены и источниками не стали: Gold Tip печатает только
внутренний диаметр («Diameter (in): 0.166 ID») и не печатает GPI, Altra
не даёт наружный диаметр ни на одной из 83 страниц, а Victory древками
на своём сайте не торгует вовсе — там 23 товара, и те одежда.
"""

import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

SITEMAP = 'https://blackeaglearrows.com/sitemap.xml'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
PAUSE = 0.4

sys.stdout.reconfigure(encoding='utf-8')


def get(url: str, tries: int = 3) -> str:
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode('utf-8', errors='ignore')
        except Exception:
            if attempt == tries - 1:
                return ''
            time.sleep(1.5 * (attempt + 1))
    return ''


def product_urls() -> list[str]:
    maps = [html.unescape(m) for m in re.findall(r'<loc>([^<]+)</loc>', get(SITEMAP))]
    urls: list[str] = []
    for m in maps:
        if 'product' in m.lower() and '.xml' in m:
            urls += [html.unescape(u) for u in re.findall(r'<loc>([^<]+)</loc>', get(m))]
            time.sleep(PAUSE)
    return [u for u in urls if '/products/' in u and '.xml' not in u]


# --- таблица ---------------------------------------------------------------
# Спецификация лежит обычной HTML-таблицей с шапкой
# «Spine | Inner Diameter | Outer Diameter | GPI». Смысл колонок берём из шапки,
# а не из их порядка: вёрстка сайта нам не подконтрольна.

TABLE = re.compile(r'<table[^>]*>(.*?)</table>', re.S | re.I)
ROW = re.compile(r'<tr[^>]*>(.*?)</tr>', re.S | re.I)
CELL = re.compile(r'<t([hd])[^>]*>(.*?)</t\1>', re.S | re.I)
TITLE = re.compile(r'<title>([^<]+)</title>', re.I)
NUM = re.compile(r'\d*\.\d+|\d+')

COLUMNS = [
    (re.compile(r'spine|deflection', re.I), 'spine'),
    (re.compile(r'\bgpi\b|grains?\s*per\s*inch', re.I), 'gpi'),
    (re.compile(r'out(?:er|side)\s*diameter|\bO\.?D\.?\b', re.I), 'od'),
    (re.compile(r'inn?er\s*diameter|inside\s*diameter|\bI\.?D\.?\b', re.I), 'id'),
]


def text_of(fragment: str) -> str:
    s = html.unescape(re.sub(r'<[^>]+>', ' ', fragment))
    return re.sub(r'\s+', ' ', s).strip()


def number(cell: str) -> float | None:
    m = NUM.search(cell)
    return float(m.group()) if m else None


def spec_rows(page: str) -> list[dict]:
    for table in TABLE.finditer(page):
        rows = [[text_of(c[1]) for c in CELL.findall(r)] for r in ROW.findall(table.group(1))]
        if not rows:
            continue
        head: dict[str, int] = {}
        for i, cell in enumerate(rows[0]):
            for pattern, name in COLUMNS:
                if pattern.search(cell):
                    head.setdefault(name, i)
                    break
        if not {'spine', 'gpi', 'od'} <= head.keys():
            continue
        out = []
        for cells in rows[1:]:
            if len(cells) <= max(head.values()) or not re.fullmatch(r'\d{2,4}', cells[head['spine']]):
                continue
            spine, gpi, od = (number(cells[head[k]]) for k in ('spine', 'gpi', 'od'))
            if None in (spine, gpi, od):
                continue
            out.append({'size': cells[head['spine']], 'deflection': round(spine / 1000, 5),
                        'gpi': round(gpi, 3), 'od': round(od, 5)})
        if out:
            return out
    return []


# --- название серии --------------------------------------------------------
# Заголовок страницы — рекламный: «Carnivore Arrows - The best Lightweight shaft
# in the industry». Серия — это то, что стоит до первого служебного слова.

NOISE = {
    'arrows', 'arrow', 'shafts', 'shaft', 'fletched', 'crested', 'feathers', 'feather',
    'hunting', 'target', 'carbon', 'micro', 'premium', 'signature', 'traditional',
    'competition', '3d', 'elite', 'indoor', 'pack', 'box', 'the', 'best', 'with',
}


def series_of(title: str) -> str:
    name = re.split(r'\s[|–—]\s|:\s|\s-\s', title)[0].strip()
    name = re.sub(r'^Black\s+Eagle\s+', '', name, flags=re.I)
    words = []
    for w in name.split():
        if w.lower().strip('.,') in NOISE or re.fullmatch(r'\d+', w):
            break
        words.append(w)
    return ' '.join(words) or name


def collapse(shafts: list[dict]) -> list[dict]:
    """Одна трубка под двумя заголовками.

    Renegade продаётся страницей «Renegade .204 Hunting Arrows» и страницей
    «Renegade Shafts | 5MM Hunting Arrow Shafts» — числа в таблицах совпадают
    до знака, потому что это буквально одно древко. Оставляем короткое имя.

    Условие намеренно узкое: не просто одинаковые числа, а ещё и одно имя
    началом другого. Одинаковые числа у разных серий — обычное дело
    (у Skylon так три серии подряд), и схлопывать их нельзя: древко ищут
    по имени, написанному на трубке.
    """
    numbers: dict[str, tuple] = {}
    for s in shafts:
        numbers.setdefault(s['series'], ())
    for name in numbers:
        rows = sorted((s['size'], s['deflection'], s['gpi'], s['od'])
                      for s in shafts if s['series'] == name)
        numbers[name] = tuple(rows)
    rename: dict[str, str] = {}
    for long in numbers:
        for short in numbers:
            if long != short and long.startswith(short) and numbers[long] == numbers[short]:
                rename[long] = short
    out, seen = [], set()
    for s in shafts:
        row = s | {'series': rename.get(s['series'], s['series'])}
        if (row['series'], row['size']) in seen:
            continue
        seen.add((row['series'], row['size']))
        out.append(row)
    return out


def sane(rows: list[dict]) -> list[str]:
    """Те же пределы, что и у остальных источников: см. shafts.test.ts.

    Главная проверка — жёсткость трубки. У тонкостенной трубы жёсткость
    на изгиб растёт как D³·стенка, а вес на дюйм как D·стенка, поэтому
    произведение «прогиб × D² × GPI» почти не зависит от модели и по всему
    справочнику держится внутри 0.10…0.90. Съехавшая колонка выпадает из
    коридора в разы.
    """
    problems = []
    for r in rows:
        if not 0.09 <= r['deflection'] <= 2.6:
            problems.append(f'спайн вне диапазона: {r["size"]}')
        if not 2.0 <= r['gpi'] <= 25.0:
            problems.append(f'GPI вне диапазона: {r["gpi"]}')
        if not 0.12 <= r['od'] <= 0.5:
            problems.append(f'диаметр вне диапазона: {r["od"]}')
        k = r['deflection'] * r['od'] ** 2 * r['gpi']
        if not 0.10 <= k <= 0.90:
            problems.append(f'спайн {r["deflection"]} не сходится с диаметром {r["od"]} '
                            f'и весом {r["gpi"]}')
    return problems


HEADER = '''/**
 * Древки Black Eagle — данные, не логика. Файл сгенерирован.
 *
 * Источник: сайт производителя, https://blackeaglearrows.com/
 * Пересборка: scripts/fetch-blackeagle-db.py — руками не правим, правки затрутся.
 *
 * Зачем отдельно от spineDataRetail.ts: карточки ритейлера по этой марке дают
 * спайн и GPI без наружного диаметра, и скрейпер их пропускает. Производитель
 * печатает полную таблицу, включая наружный диаметр.
 *
 * Формат записи тот же, чтобы списки просто складывались.
 */

import type { ShaftSpec } from './spineData'
'''


def main():
    urls = product_urls()
    print(f'страниц товаров в карте сайта: {len(urls)}\n')

    shafts, taken, empty = [], [], 0
    seen: set[tuple[str, str]] = set()
    for i, url in enumerate(urls, 1):
        page = get(url)
        time.sleep(PAUSE)
        if not page:
            continue
        rows = spec_rows(page)
        if not rows:
            empty += 1
            continue
        title = text_of(TITLE.search(page).group(1)) if TITLE.search(page) else url
        series = series_of(title)
        problems = sane(rows)
        if problems:
            print(f'МИМО  {series}: {problems[0]}')
            continue
        added = 0
        for r in rows:
            if (series, r['size']) in seen:
                continue
            seen.add((series, r['size']))
            shafts.append({'material': 'carbon', 'brand': 'Black Eagle', 'series': series,
                           'size': r['size'], 'deflection': r['deflection'], 'gpi': r['gpi'],
                           'od': r['od'], 'focComp': 0, 'stockLength': None,
                           'insert': None, 'insertGrains': None, 'nock': None})
            added += 1
        if added:
            taken.append(f'{series}: {added}')
        if i % 25 == 0:
            print(f'  ...{i}/{len(urls)}, серий {len(taken)}')

    shafts = collapse(shafts)
    body = ',\n'.join('  ' + json.dumps(s, ensure_ascii=False, separators=(', ', ': '))
                      for s in shafts)
    out = Path('src/core/spineDataBlackEagle.ts')
    out.write_text(f'{HEADER}\nexport const BLACK_EAGLE_SHAFTS: ShaftSpec[] = [\n{body},\n]\n',
                   encoding='utf-8')

    print()
    for line in taken:
        print(f'  {line}')
    print(f'\nсерий: {len(taken)}, древков: {len(shafts)}')
    print(f'страниц без таблицы спецификаций: {empty}')
    print(f'{out} — {out.stat().st_size / 1024:.1f} КБ')


if __name__ == '__main__':
    main()
