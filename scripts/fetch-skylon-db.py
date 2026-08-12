#!/usr/bin/env python3
"""
Спек-таблицы древков Skylon с сайта производителя в src/core/spineDataSkylon.ts.

Зачем отдельно от базы Стю: та собрана в 2012 году, Skylon в ней нет вовсе,
а это один из самых ходовых производителей таргетных древков в Европе.

Сайт отдаёт таблицы обычным HTML — распознавание не нужно. Каталог в PDF
(skylonarchery.com/images/catalog/) — картинка без текстового слоя, OCR по нему
теряет строки молча, поэтому источником взят именно сайт.

    python scripts/fetch-skylon-db.py

Скрипт разовый, результат закоммичен. Сеть нужна только при пересборке.

Единицы приводятся к тем же, что у Стю: диаметр из миллиметров в дюймы,
спайн у Skylon уже в дюймах и совпадает с прогибом по ASTM (1.94 фунта / база 28").
"""

import html
import json
import re
import sys
import urllib.request
from pathlib import Path

BASE = 'https://www.skylonarchery.com'
INDEX = f'{BASE}/arrows/2023-06-29-08-52-09/brixxon'
# Заголовки уходят в latin-1, поэтому строка только на латинице.
UA = 'Mozilla/5.0 (compatible; archery-tracker/1.0; one-off spec fetch)'

MM_PER_INCH = 25.4

sys.stdout.reconfigure(encoding='utf-8')


def get(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', errors='ignore')


def text_lines(page: str) -> list[str]:
    body = re.sub(r'<script.*?</script>|<style.*?</style>', '', page, flags=re.S)
    plain = html.unescape(re.sub(r'<[^>]+>', '\n', body))
    return [l.strip() for l in plain.split('\n') if l.strip()]


ROW = re.compile(
    r'^(\d+\.\d+)"$'                      # спайн в дюймах
)
OD = re.compile(r'^(\d+\.\d+)\s*mm$', re.I)
GPI = re.compile(r'^(\d+\.\d+)$')
LENGTH = re.compile(r'^(\d+(?:\.\d+)?)"$')


def parse_table(lines: list[str]) -> list[dict]:
    """Строка таблицы — четыре идущих подряд значения: спайн, диаметр, GPI, длина."""
    rows = []
    for i in range(len(lines) - 3):
        m_spine = ROW.match(lines[i])
        m_od = OD.match(lines[i + 1])
        m_gpi = GPI.match(lines[i + 2])
        m_len = LENGTH.match(lines[i + 3])
        if not (m_spine and m_od and m_gpi and m_len):
            continue
        rows.append(
            {
                'deflection': round(float(m_spine.group(1)), 4),
                'od': round(float(m_od.group(1)) / MM_PER_INCH, 5),
                'odMm': float(m_od.group(1)),
                'gpi': round(float(m_gpi.group(1)), 3),
                'stockLength': float(m_len.group(1)),
            }
        )
    return rows


def inner_diameter(lines: list[str]) -> str | None:
    for i, l in enumerate(lines):
        if l.lower().startswith('inner diameter') and i + 1 < len(lines):
            return lines[i + 1]
    return None


def has_spine_table(lines: list[str]) -> bool:
    """Часть моделей (Fast Wing) продаётся не по спайну, а по фунтам лука —
    таблицы со спайном, диаметром и GPI у них нет вовсе. Это не поломка разбора."""
    return not any('poundage' in l.lower() for l in lines)


def check(name: str, rows: list[dict]) -> list[str]:
    """Таблица должна быть внутренне непротиворечивой: жёстче спайн —
    толще трубка и больше вес. Нарушение значит, что разбор поехал."""
    problems = []
    if len(rows) < 3:
        problems.append(f'строк всего {len(rows)}')
    for i in range(1, len(rows)):
        if rows[i]['deflection'] >= rows[i - 1]['deflection']:
            problems.append(f'спайн не убывает: {rows[i-1]["deflection"]} → {rows[i]["deflection"]}')
        if rows[i]['gpi'] < rows[i - 1]['gpi']:
            problems.append(f'GPI падает: {rows[i-1]["gpi"]} → {rows[i]["gpi"]}')
    for r in rows:
        if not 0.15 <= r['deflection'] <= 2.6:
            problems.append(f'спайн вне диапазона: {r["deflection"]}')
        if not 0.12 <= r['od'] <= 0.5:
            problems.append(f'диаметр вне диапазона: {r["odMm"]} мм')
        if not 2.0 <= r['gpi'] <= 25.0:
            problems.append(f'GPI вне диапазона: {r["gpi"]}')
    return problems


def pretty(slug: str) -> str:
    return ' '.join(w.capitalize() for w in slug.split('-'))


HEADER = '''/**
 * Древки Skylon — данные, не логика. Файл сгенерирован.
 *
 * Источник: сайт производителя, https://www.skylonarchery.com/ (раздел Arrows).
 * Пересборка: scripts/fetch-skylon-db.py — руками не правим, правки затрутся.
 *
 * Зачем отдельно от spineData.ts: та база собрана Stu Miller в 2012 году,
 * Skylon в ней нет вовсе. Формат записи тот же, чтобы списки просто складывались.
 *
 * Спайн Skylon публикует в дюймах — это и есть прогиб по ASTM (1.94 фунта на базе 28").
 * Диаметр переведён из миллиметров в дюймы.
 *
 * ВНИМАНИЕ: серии id 3.2 и id 4.2 — это трубки 5–6 мм по наружному диаметру,
 * то есть у нижней границы применимости модели Стю и за ней. См. README.
 */

import type { ShaftSpec } from './spineData'
'''


def main():
    index = text_lines(get(INDEX))
    links = sorted(set(re.findall(r'href="(/arrows/[^"]+)"', get(INDEX))))
    if not links:
        sys.exit('не нашёл ссылок на модели — вёрстка сайта изменилась')

    shafts, report, skipped = [], [], []
    for path in links:
        slug = path.rsplit('/', 1)[-1]
        lines = text_lines(get(BASE + path))
        if not has_spine_table(lines):
            skipped.append(slug)
            continue
        rows = parse_table(lines)
        problems = check(slug, rows)
        report.append((slug, len(rows), inner_diameter(lines), problems))
        if problems:
            continue
        for r in rows:
            shafts.append(
                {
                    'material': 'carbon',
                    'brand': 'Skylon',
                    'series': pretty(slug),
                    # В магазинах древко заказывают по числу спайна (700, 500),
                    # а не по прогибу в дюймах: 0.500" — это размер 500.
                    'size': str(round(r['deflection'] * 1000)),
                    'deflection': r['deflection'],
                    'gpi': r['gpi'],
                    'od': r['od'],
                    # Древки Skylon параллельные, поправки на бочкообразность нет.
                    'focComp': 0,
                    'stockLength': r['stockLength'],
                    'insert': None,
                    'insertGrains': None,
                    'nock': None,
                }
            )

    body = ',\n'.join(
        '  ' + json.dumps(s, ensure_ascii=False, separators=(', ', ': ')) for s in shafts
    )
    out = Path('src/core/spineDataSkylon.ts')
    out.write_text(
        f'{HEADER}\nexport const SKYLON_SHAFTS: ShaftSpec[] = [\n{body},\n]\n',
        encoding='utf-8',
    )

    ok = sum(1 for _, _, _, p in report if not p)
    for slug, n, idia, problems in report:
        mark = 'ok   ' if not problems else 'МИМО '
        print(f'{mark} {slug:12s} строк {n:2d}  внутр. диаметр {idia or "—"}')
        for p in problems[:3]:
            print(f'        → {p}')
    for slug in skipped:
        print(f'мимо  {slug:12s} продаётся по фунтам лука, таблицы спайнов нет')
    print(f'\nмоделей: {ok} из {len(report)}, древков: {len(shafts)}')
    print(f'{out} — {out.stat().st_size / 1024:.1f} КБ')
    if ok != len(report):
        sys.exit(1)
    _ = index


if __name__ == '__main__':
    main()
