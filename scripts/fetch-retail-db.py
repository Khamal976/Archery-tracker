#!/usr/bin/env python3
"""
Спецификации современных древков со страниц ритейлера в src/core/spineDataRetail.ts.

Зачем: база Стю собрана в 2012 году, современных таргетных серий в ней нет.
Сайт Easton из этой сети недоступен (отдаёт файлы по 25 КБ в минуту), поэтому
цифры берём у продавца, который печатает заводскую таблицу на странице товара.

Источник: Lancaster Archery Supply, https://lancasterarchery.com/
robots.txt страницы товаров разрешает; берём только текст спецификаций.

    python scripts/fetch-retail-db.py

Скрипт разовый, результат закоммичен. Запуск занимает минуты: страниц три сотни.

ГЛАВНОЕ ПРАВИЛО: запись принимается, только если на странице есть все три числа —
спайн, GPI и наружный диаметр. Часть карточек печатает лишь спайн и GPI; диаметр
там подставить неоткуда, а выдумывать его нельзя — он входит в расчёт напрямую.
Такие модели пропускаются и попадают в отчёт.
"""

import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SITEMAP = 'https://lancasterarchery.com/sitemap.xml'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
PAUSE = 0.35

sys.stdout.reconfigure(encoding='utf-8')


def get(url: str, tries: int = 3) -> str:
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode('utf-8', errors='ignore')
        except (urllib.error.URLError, TimeoutError):
            if attempt == tries - 1:
                return ''
            time.sleep(1.5 * (attempt + 1))
    return ''


def shaft_urls() -> list[str]:
    index = get(SITEMAP)
    maps = [m.replace('&amp;', '&')
            for m in re.findall(r'<loc>([^<]*sitemap_products[^<]*)</loc>', index)]
    urls: list[str] = []
    for m in maps:
        urls += re.findall(r'<loc>(https://lancasterarchery\.com/products/[^<]+)</loc>', get(m))
        time.sleep(PAUSE)
    return [u for u in urls if 'shaft' in u.lower()]


def plain(fragment: str) -> str:
    return html.unescape(re.sub(r'<[^>]+>', '\n', fragment))


# «340 (9.5 gpi) .267"» — спайн, вес на дюйм, наружный диаметр.
SPEC = re.compile(
    r'\b(\d{2,4})\s*\(\s*([\d.]+)\s*gpi\s*\)\s*[^\d\n]{0,6}(0?\.\d{3})\s*[""”]?',
    re.I,
)
TITLE = re.compile(r'<title>([^<]+)</title>', re.I)
# Производитель лежит и в аналитическом JSON, и в хлебных крошках. Первый вариант
# берём как основной: в крошках значение не в кавычках и легко обрывается.
BRAND_JSON = re.compile(r'\bBrand:\s*"([^"]+)"')
BRAND_CRUMB = re.compile(r'data-bread-crumbs="[^"]*?brand:\s*([^;"]+)', re.I)


def parse(page: str) -> tuple[str, str, list[dict]]:
    title = plain(TITLE.search(page).group(1)).strip() if TITLE.search(page) else ''
    title = re.sub(r'\s*[|–-]\s*Lancaster Archery.*$', '', title).strip()
    brand_m = BRAND_JSON.search(page) or BRAND_CRUMB.search(page)
    brand = plain(brand_m.group(1)).strip() if brand_m else ''
    brand = re.sub(r'\s+Archery$', '', brand)
    rows = []
    for m in SPEC.finditer(page):
        spine, gpi, od = int(m.group(1)), float(m.group(2)), float(m.group(3))
        rows.append({'size': str(spine), 'deflection': round(spine / 1000, 4),
                     'gpi': round(gpi, 3), 'od': round(od, 5)})
    return title, brand, rows


def sane(rows: list[dict]) -> list[str]:
    """Внутренняя непротиворечивость: жёстче спайн — больше GPI и диаметр."""
    problems = []
    if len(rows) < 2:
        return ['строк меньше двух']
    ordered = sorted(rows, key=lambda r: -r['deflection'])
    for i in range(1, len(ordered)):
        if ordered[i]['gpi'] < ordered[i - 1]['gpi']:
            problems.append(f'GPI падает {ordered[i-1]["gpi"]} → {ordered[i]["gpi"]}')
        if ordered[i]['od'] < ordered[i - 1]['od']:
            problems.append(f'диаметр падает {ordered[i-1]["od"]} → {ordered[i]["od"]}')
    for r in rows:
        if not 0.15 <= r['deflection'] <= 2.6:
            problems.append(f'спайн вне диапазона: {r["size"]}')
        if not 2.0 <= r['gpi'] <= 25.0:
            problems.append(f'GPI вне диапазона: {r["gpi"]}')
        if not 0.12 <= r['od'] <= 0.5:
            problems.append(f'диаметр вне диапазона: {r["od"]}')
    return problems


def material_of(title: str, brand: str) -> str:
    low = f'{title} {brand}'.lower()
    if 'fmj' in low or 'full metal jacket' in low or 'a/c/' in low or 'acc' in low:
        return 'hybrid'
    if 'aluminum' in low or re.search(r'\bxx7[58]\b', low):
        return 'aluminum'
    return 'carbon'


def clean_series(title: str, brand: str) -> str:
    s = title
    # Комплектация в названии — не свойство трубки: «w/Half-Outs» и
    # «w/HIT Inserts» это одно и то же древко в разной упаковке.
    s = re.sub(r'\s+w(?:ith|/)\s*.*$', '', s, flags=re.I)
    for word in [brand, 'Archery', 'Arrow Shafts', 'Arrow Shaft', 'Shafts', 'Shaft', '12-pack']:
        if word:
            s = re.sub(re.escape(word), '', s, flags=re.I)
    return re.sub(r'\s{2,}', ' ', s).strip(' ,-–—') or title


HEADER = '''/**
 * Древки современных серий — данные, не логика. Файл сгенерирован.
 *
 * Источник: карточки товаров Lancaster Archery Supply, https://lancasterarchery.com/
 * Пересборка: scripts/fetch-retail-db.py — руками не правим, правки затрутся.
 *
 * Зачем: база Стю собрана в 2012 году и современных таргетных серий не знает,
 * а сайт Easton из этой сети недоступен. Ритейлер печатает заводскую таблицу
 * на странице товара, оттуда и берём.
 *
 * Записаны только модели, у которых на странице есть все три числа: спайн, GPI
 * и наружный диаметр. Где диаметра нет — модель пропущена: подставить его
 * неоткуда, а в расчёт он входит напрямую.
 */

import type { ShaftSpec } from './spineData'
'''


def main():
    urls = shaft_urls()
    print(f'страниц древков в карте сайта: {len(urls)}\n')

    shafts, complete, partial, empty = [], [], [], []
    seen: set[tuple[str, str, str]] = set()
    # Одно и то же древко продаётся в нескольких комплектациях — числа совпадают
    # до знака, и в справочнике это была бы бессмысленная пара строк.
    seen_specs: set[tuple[float, float, float]] = set()

    for i, url in enumerate(urls, 1):
        page = get(url)
        time.sleep(PAUSE)
        if not page:
            empty.append(url)
            continue
        title, brand, rows = parse(page)
        if not rows:
            # Спайн и GPI без диаметра — считаем это неполной карточкой.
            partial.append(title or url)
            continue
        problems = sane(rows)
        if problems:
            partial.append(f'{title}: {problems[0]}')
            continue
        series = clean_series(title, brand)
        material = material_of(title, brand)
        added = 0
        for r in rows:
            key = (brand, series, r['size'])
            spec = (r['deflection'], r['gpi'], r['od'])
            if key in seen or spec in seen_specs:
                continue
            seen.add(key)
            seen_specs.add(spec)
            shafts.append({'material': material, 'brand': brand or '—', 'series': series,
                           'size': r['size'], 'deflection': r['deflection'], 'gpi': r['gpi'],
                           'od': r['od'], 'focComp': 0, 'stockLength': None,
                           'insert': None, 'insertGrains': None, 'nock': None})
            added += 1
        if added:
            complete.append(f'{brand} / {series}: {added}')
        if i % 25 == 0:
            print(f'  ...{i}/{len(urls)}, полных карточек {len(complete)}')

    body = ',\n'.join('  ' + json.dumps(s, ensure_ascii=False, separators=(', ', ': '))
                      for s in shafts)
    out = Path('src/core/spineDataRetail.ts')
    out.write_text(f'{HEADER}\nexport const RETAIL_SHAFTS: ShaftSpec[] = [\n{body},\n]\n',
                   encoding='utf-8')

    print(f'\nполных карточек: {len(complete)}, древков: {len(shafts)}')
    print(f'пропущено без диаметра или с противоречиями: {len(partial)}')
    print(f'страниц не открылось: {len(empty)}')
    print(f'\n{out} — {out.stat().st_size / 1024:.1f} КБ')
    Path('retail-report.txt').write_text(
        'ВЗЯТО\n' + '\n'.join(complete) + '\n\nПРОПУЩЕНО\n' + '\n'.join(partial),
        encoding='utf-8')


if __name__ == '__main__':
    main()
