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

Заводская таблица напечатана в трёх видах, и все три разбираются:

    Spine | GPI | OD | Length:          ← шапка задаёт смысл колонок
    340 | 9.5 | .267" | 32"
    340 (9.5 gpi) .267"                 ← то же строкой
    250 (8.1 gpi/OD .295") 400 spine    ← размер и спайн различаются

Смысл колонок берётся ИЗ ШАПКИ, а не из порядка: у алюминиевых серий первая
колонка называется «Size» и содержит код трубки (2712 — это 27/64″ на 12 тысячных
стенки), а не прогиб. Где такой таблице нечего дать, кроме кода, модель
пропускается; где рядом есть колонка «Deflection @ 28”» — берётся она.
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


# --- текст страницы -------------------------------------------------------
# Спецификация лежит списком <li> в аккордеоне и продублирована для мобильной
# вёрстки. Скрипты выкидываем целиком: в них полно строк с «||», которые иначе
# читаются как строки таблицы.

NOISE = re.compile(r'<(script|style|noscript)\b[^>]*>.*?</\1>', re.S | re.I)
BULLET = re.compile(r'<(li|p)\b[^>]*>(.*?)</\1>', re.S | re.I)
TITLE = re.compile(r'<title>([^<]+)</title>', re.I)
# Производитель лежит и в аналитическом JSON, и в хлебных крошках. Первый вариант
# берём как основной: в крошках значение не в кавычках и легко обрывается.
BRAND_JSON = re.compile(r'\bBrand:\s*"([^"]+)"')
BRAND_CRUMB = re.compile(r'data-bread-crumbs="[^"]*?brand:\s*([^;"]+)', re.I)


def text_of(fragment: str) -> str:
    s = re.sub(r'<br\s*/?>', ' ', fragment, flags=re.I)
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s)).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', s).strip()


CANONICAL = re.compile(r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"', re.I)
# Карточки последних лет не выводят спецификацию в разметку: она лежит
# HTML-эскейпом в атрибуте виджета отзывов. Берём её только у того тега,
# чей data-url совпадает с канонической ссылкой самой страницы, иначе можно
# втянуть описание соседнего товара из блока рекомендаций.
DESCRIPTION = re.compile(r'<[^>]*\bdata-url="([^"]*)"[^>]*\bdata-description="([^"]*)"', re.I)


def bullets(page: str) -> list[str]:
    """Строки описания в порядке появления, без повторов."""
    body = NOISE.sub(' ', page)
    canonical = CANONICAL.search(page)
    chunks = [body]
    if canonical:
        handle = canonical.group(1).rstrip('/').rsplit('/', 1)[-1]
        chunks += [html.unescape(m.group(2)) for m in DESCRIPTION.finditer(body)
                   if m.group(1).rstrip('/').rsplit('/', 1)[-1] == handle]
    out, seen = [], set()
    for chunk in chunks:
        for m in BULLET.finditer(chunk):
            t = text_of(m.group(2))
            if t and t not in seen and len(t) < 400:
                seen.add(t)
                out.append(t)
    return out


# --- числа ----------------------------------------------------------------

NUM = re.compile(r'\d*\.\d+|\d+')


def number(cell: str) -> float | None:
    """Первое число в ячейке.

    Хвост ячейки бывает мусорным: у последней строки таблицы к ней иногда
    приклеен следующий абзац («28” No LimitConstruction: ...»).
    """
    m = NUM.search(cell)
    return float(m.group()) if m else None


def spine_number(cell: str) -> float | None:
    """Прогиб из ячейки размера.

    У RX-7 размер записан как «23-420»: первое число — диаметр в 64-х долях
    дюйма (23/64″ = .359″ при заявленных .365″), второе — собственно спайн.
    Берём второе; одиночное число берётся как есть.
    """
    m = re.match(r'\s*(\d+)\s*-\s*(\d{3})\b', cell)
    return float(m.group(2)) if m else number(cell)


def inches(cell: str) -> float | None:
    """Диаметр в дюймах. Одна карточка печатает миллиметры — переводим."""
    v = number(cell)
    if v is None:
        return None
    return round(v / 25.4, 5) if re.search(r'\d\s*mm\b', cell, re.I) else v


def deflection_of(value: float | None) -> float | None:
    """Прогиб в дюймах: «400» — это .400″, «0.464» — уже дюймы."""
    if value is None:
        return None
    return round(value / 1000, 5) if value >= 10 else value


# --- таблица через | ------------------------------------------------------

COLUMNS = [
    (re.compile(r'deflection|spine', re.I), 'spine'),
    (re.compile(r'\bgpi\b|grains?\s*per\s*inch', re.I), 'gpi'),
    (re.compile(r'outside\s*diameter|outer\s*diameter|\bo\.?\s?d\.?\b', re.I), 'od'),
    (re.compile(r'inside\s*diameter|\bi\.?\s?d\.?\b', re.I), 'id'),
    (re.compile(r'length', re.I), 'length'),
    (re.compile(r'\bsize\b|\bmodel\b', re.I), 'size'),
]


def header_map(line: str) -> dict[str, int] | None:
    """Шапка таблицы → какая колонка что значит."""
    cells = [c.strip() for c in line.split('|')]
    if len(cells) < 2:
        return None
    got: dict[str, int] = {}
    for i, c in enumerate(cells):
        if NUM.search(c) and not re.search(r'[a-z]{2}', c, re.I):
            return None  # голое число в шапке — значит, это строка данных
        for pattern, name in COLUMNS:
            if pattern.search(c):
                got.setdefault(name, i)
                break
    # Двух подписей достаточно: строку всё равно возьмут, только если в ней
    # нашлись все три нужные колонки, а неполная шапка помогает отчёту —
    # видно, что таблица есть, просто в ней нет диаметра.
    return got if len(got) >= 2 else None


def row_from(cells: list[str], head: dict[str, int]) -> dict | None:
    def col(name: str) -> str | None:
        k = head.get(name)
        return cells[k] if k is not None and k < len(cells) else None

    spine, gpi, od = col('spine'), col('gpi'), col('od')
    if spine is None or gpi is None or od is None:
        return None
    size = col('size') or spine
    length = col('length')
    return {
        'size': re.sub(r'[^\w./-]+', '', size.split()[0]) if size.split() else '',
        'deflection': deflection_of(spine_number(spine)),
        'gpi': number(gpi),
        'od': inches(od),
        'length': number(length) if length else None,
        # Отдельная колонка размера рядом с прогибом бывает только у алюминия:
        # 2213 — это 22/64″ трубка со стенкой 13 тысячных, а не спайн.
        'coded': 'size' in head,
    }


def table_rows(lines: list[str]) -> list[dict]:
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        head = header_map(lines[i]) if '|' in lines[i] else None
        if not head:
            i += 1
            continue
        # Шапка бывает подписью внутри самих ячеек: «250 spine | 11.1 gpi | OD
        # 6.41mm». Тогда первая строка — и шапка, и данные разом.
        first = row_from([c.strip() for c in lines[i].split('|')], head)
        if first and None not in (first['deflection'], first['gpi'], first['od']):
            rows.append(first)
        i += 1
        while i < len(lines) and '|' in lines[i]:
            cells = [c.strip() for c in lines[i].split('|')]
            if number(cells[0]) is None:
                break
            i += 1
            row = row_from(cells, head)
            if row:
                rows.append(row)
    return rows


# --- та же таблица, но строкой --------------------------------------------
# «340 (9.5 gpi) .267"», «250 (8.1 gpi/OD .295") 400 spine». Во втором случае
# первое число — торговый размер (так написано на трубке), а прогиб указан
# отдельно: у Carbon Express размер 250 означает спайн .400.

INLINE = re.compile(
    r'\b(\d{2,4})\s*\(\s*([\d.]+)\s*gpi\s*(?:[/,]\s*O\.?D\.?\s*(0?\.\d{3})\s*["”″]?)?\s*\)'
    r'(?:\s*[^\d\n]{0,6}(0?\.\d{3})\s*["”″]?)?'
    r'(?:\s*(\d{2,4})\s*spine)?',
    re.I,
)


def inline_rows(lines: list[str]) -> list[dict]:
    rows = []
    for line in lines:
        for m in INLINE.finditer(line):
            size, gpi, od_in, od_after, spine = m.groups()
            od = od_in or od_after
            if not od:
                continue
            rows.append({
                'size': size,
                'deflection': deflection_of(float(spine if spine else size)),
                'gpi': float(gpi),
                'od': float(od),
                'length': None,
                'coded': False,
            })
    return rows


def diagnose(lines: list[str]) -> str:
    """Почему со страницы нечего взять — одной строкой для отчёта."""
    for line in lines:
        head = header_map(line) if '|' in line else None
        if not head:
            continue
        if 'spine' not in head:
            return 'в таблице только код трубки, прогиба нет'
        if 'od' not in head:
            return 'в таблице спайн и вес, колонки диаметра нет'
    if any(re.search(r'\d\s*\(\s*[\d.]+\s*gpi', l, re.I) for l in lines):
        return 'спайн и GPI есть, диаметра нет'
    if any(re.search(r'inside diameter|\bID:', l, re.I) for l in lines):
        return 'напечатан только внутренний диаметр'
    return 'спецификации на странице нет'


def parse(page: str) -> tuple[str, str, list[dict]]:
    title = text_of(TITLE.search(page).group(1)) if TITLE.search(page) else ''
    title = re.sub(r'\s*[|–-]\s*Lancaster Archery.*$', '', title).strip()
    brand_m = BRAND_JSON.search(page) or BRAND_CRUMB.search(page)
    brand = text_of(brand_m.group(1)) if brand_m else ''
    brand = re.sub(r'\s+Archery$', '', brand)
    lines = bullets(page)
    rows = table_rows(lines) or inline_rows(lines)
    keep, seen = [], set()
    for r in rows:
        if None in (r['deflection'], r['gpi'], r['od']) or r['size'] in seen:
            continue
        seen.add(r['size'])
        r['deflection'] = round(r['deflection'], 5)
        r['gpi'] = round(r['gpi'], 3)
        r['od'] = round(r['od'], 5)
        if r['length'] is not None and not 24 <= r['length'] <= 36:
            r['length'] = None
        keep.append(r)
    return title, brand, keep


def tube_code(size: str, od: float) -> bool:
    """Похож ли размер на код алюминиевой трубки, а не на спайн.

    Код 2312 — это 23/64″ наружного диаметра при стенке 12 тысячных: первые две
    цифры обязаны сойтись с напечатанным рядом диаметром, последние две — лечь
    в реальную толщину стенки. Проверка нужна потому, что ритейлер иногда
    подписывает такую колонку словом Spine: у X23 Two-Tone и XX75 Tribute
    шапка обещает спайн, а под ней стоят 2312 и 1413.

    Обе половины проверки обязательны. Тонкие мишенные древки доходят до спайна
    1250 и 2000, и по одному только диаметру спайн 1250 не отличить от кода
    трубки 12/64″ — спасают последние цифры: стенки 50 и 00 не бывает.
    """
    return (bool(re.fullmatch(r'\d{4}', size))
            and 9 <= int(size[2:]) <= 20
            and abs(int(size[:2]) / 64 - od) < 0.02)


def sane(rows: list[dict]) -> list[str]:
    """Проверки, которые ловят съехавший разбор, а не свойства трубки.

    Монотонности «жёстче спайн — больше GPI и диаметр» здесь сознательно нет:
    на реальных заводских таблицах она не выполняется. У X10 спайн 350 весит
    8.8 гран, а более слабый 380 — 8.9; у X10 Parallel Pro самый слабый 1150
    толще, чем 1000, потому что это уже другая трубка семейства; у алюминия
    размер задаёт диаметр и стенку независимо, и 2016 честно тяжелее более
    жёсткого 2114. Отбраковывать такое — значит выбрасывать напечатанные
    производителем числа ради красивого правила.

    Вместо неё — жёсткость самой трубки. У тонкостенной трубы жёсткость на
    изгиб растёт как D³·стенка, а вес на дюйм — как D·стенка, поэтому
    произведение «прогиб × D² × GPI» почти не зависит от модели: по 627
    записям проверенных справочников (Стю и Skylon) оно лежит в 0.127…0.714
    у карбона, 0.502…0.588 у алюминия и 0.232…0.441 у гибрида. Коридор
    0.10…0.90 пропускает их все с запасом, а неверно прочитанная колонка
    промахивается мимо него в разы: коды трубок X23 дают 2.9…4.2,
    миллиметры вместо дюймов — 114.
    """
    problems = []
    for r in rows:
        if not 0.09 <= r['deflection'] <= 2.6:
            problems.append(f'спайн вне диапазона: {r["size"]} → {r["deflection"]}')
        if not 2.0 <= r['gpi'] <= 25.0:
            problems.append(f'GPI вне диапазона: {r["gpi"]}')
        if not 0.12 <= r['od'] <= 0.5:
            problems.append(f'диаметр вне диапазона: {r["od"]}')
        if tube_code(r['size'], r['od']) and abs(r['deflection'] * 1000 - float(r['size'])) < 1:
            problems.append(f'{r["size"]} — код трубки, а не спайн')
        elif not 0.10 <= r['deflection'] * r['od'] ** 2 * r['gpi'] <= 0.90:
            problems.append(f'спайн {r["deflection"]} не сходится с диаметром {r["od"]} '
                            f'и весом {r["gpi"]}')
    steps = [b['deflection'] - a['deflection'] for a, b in zip(rows, rows[1:])]
    if any(s > 0 for s in steps) and any(s < 0 for s in steps):
        problems.append('прогиб по строкам скачет — строка съехала')
    return problems


# Переменное сечение производитель называет словами, а процент не печатает.
# Слово ловим, число не выдумываем: в расчёте поправка остаётся нулевой,
# а экран подбора предупреждает, что у результата известная сторона ошибки.
#
# Фразы именно про трубку. Просто «taper» не годится: у Victory так называется
# вставка («Taper Lock Aluminum Insert»), у XX75 Tribute — обжим под хвостовик
# («Precision-ground nock swage»), и обе трубки при этом параллельные.
BARRELED = re.compile(r'barrel+ed|tapered design|rear[- ]tapered|stiffer ends', re.I)


def barreled_by(title: str, lines: list[str]) -> bool:
    return bool(BARRELED.search(title) or any(BARRELED.search(l) for l in lines))


CONSTRUCTION = re.compile(r'^Construction:\s*(.{0,80})', re.I)
METAL = re.compile(r'alloy|aluminum|\b7\d{3}\b|metal jacket', re.I)


def material_of(title: str, brand: str, rows: list[dict], lines: list[str]) -> str:
    """Материал трубки.

    В первую очередь по строке «Construction:» с самой страницы — она честнее
    названия. У X10 там «carbon fiber/7075 precision alloy», то есть гибрид,
    хотя по имени его не отличить от карбона; у RX-7 — «7178 Aluminum», хотя
    имя не намекает на металл вовсе. Заодно это сходится с базой Стю, где X10
    записан гибридом.
    """
    for line in lines:
        m = CONSTRUCTION.match(line)
        if not m:
            continue
        metal, carbon = bool(METAL.search(m.group(1))), bool(re.search(r'carbon', m.group(1), re.I))
        if metal and carbon:
            return 'hybrid'
        if metal:
            return 'aluminum'
        if carbon:
            return 'carbon'
    low = f'{title} {brand}'.lower()
    if 'fmj' in low or 'full metal jacket' in low or 'a/c/' in low or 'acc' in low:
        return 'hybrid'
    # Отдельная колонка размера рядом с прогибом — подпись алюминиевой трубки
    # (2613, 1514). Это надёжнее слова в названии: у X7 Eclipse и X23 металла
    # в имени нет вовсе.
    if 'aluminum' in low or re.search(r'\bxx7[58]\b', low) or any(r['coded'] for r in rows):
        return 'aluminum'
    return 'carbon'


def clean_series(title: str, brand: str, sizes: list[str]) -> str:
    s = title
    # Комплектация в названии — не свойство трубки: «w/Half-Outs» и
    # «w/HIT Inserts» это одно и то же древко в разной упаковке.
    s = re.sub(r'\s+w(?:ith|/)\s*.*$', '', s, flags=re.I)
    for word in [brand, 'Archery', 'Arrow Shafts', 'Arrow Shaft', 'Shafts', 'Shaft', '12-pack']:
        if word:
            s = re.sub(re.escape(word), '', s, flags=re.I)
    s = s.replace('™', '').replace('®', '')
    # Часть моделей продаётся по одному спайну на страницу, и спайн попадает
    # в заголовок: «Gold Tip Hunter XT 250», «Pierce Tour (250 Spine)».
    # В названии серии ему не место — иначе одна серия рассыпается на строки.
    for size in sizes:
        s = re.sub(rf'\(?\s*{re.escape(size)}\s*(spine)?\s*\)?\s*$', '', s, flags=re.I)
    return re.sub(r'\s{2,}', ' ', s).strip(' ,-–—') or title


def series_key(brand: str, series: str) -> tuple:
    """Ключ «то же древко под другим заголовком».

    «Easton 5mm FMJ» и «Easton FMJ 5mm» — одна трубка, у ритейлера просто две
    карточки, и в справочнике они должны слиться. А вот Gold Tip Hunter и
    Hunter XT слиться не должны, хотя трубка та же: это разные допуски, и
    древко ищут по имени, написанному на самой трубке.
    """
    return (brand, tuple(sorted(re.findall(r'\w+', series.lower()))))


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

export interface RetailShaftSpec extends ShaftSpec {
  /**
   * Производитель называет древко бочкообразным или конусным: X10, A/C/E,
   * Maxima RED. Процент, на который у таких древков снимается статический
   * спайн, нигде не печатается, поэтому focComp у них остаётся нулевым,
   * а экран подбора об этом предупреждает. Отсутствие флага не означает,
   * что трубка параллельная: значит, на странице об этом не сказано.
   */
  barreled: boolean
}
'''


def main():
    urls = shaft_urls()
    print(f'страниц древков в карте сайта: {len(urls)}\n')

    shafts, complete, partial, empty = [], [], [], []
    seen: set[tuple[str, str, str]] = set()
    # Одно и то же древко продаётся в нескольких комплектациях и под слегка
    # переставленным заголовком — в справочнике это была бы пара одинаковых
    # серий. Первое встреченное написание становится общим.
    naming: dict[tuple, str] = {}

    for i, url in enumerate(urls, 1):
        page = get(url)
        time.sleep(PAUSE)
        if not page:
            empty.append(url)
            continue
        title, brand, rows = parse(page)
        if re.search(r'open box|blem\b|clearance', title, re.I):
            continue  # уценка поштучно, не позиция каталога
        if not rows:
            partial.append(f'{title or url}: {diagnose(bullets(page))}')
            continue
        problems = sane(rows)
        if problems:
            partial.append(f'{title}: {problems[0]}')
            continue
        lines = bullets(page)
        material = material_of(title, brand, rows, lines)
        series = clean_series(title, brand, [r['size'] for r in rows])
        series = naming.setdefault(series_key(brand, series), series)
        barreled = barreled_by(title, lines)
        added = 0
        for r in rows:
            key = (brand, series, r['size'])
            if key in seen:
                continue
            seen.add(key)
            shafts.append({'material': material, 'brand': brand or '—', 'series': series,
                           'size': r['size'], 'deflection': r['deflection'], 'gpi': r['gpi'],
                           'od': r['od'], 'focComp': 0, 'stockLength': r['length'],
                           'insert': None, 'insertGrains': None, 'nock': None,
                           'barreled': barreled})
            added += 1
        if added:
            complete.append(f'{brand} / {series}: {added}')
        if i % 25 == 0:
            print(f'  ...{i}/{len(urls)}, полных карточек {len(complete)}')

    body = ',\n'.join('  ' + json.dumps(s, ensure_ascii=False, separators=(', ', ': '))
                      for s in shafts)
    out = Path('src/core/spineDataRetail.ts')
    out.write_text(f'{HEADER}\nexport const RETAIL_SHAFTS: RetailShaftSpec[] = [\n{body},\n]\n',
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
