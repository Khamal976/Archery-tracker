import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { navigate } from '../app/router'
import { FORMATS } from '../core/formats'
import { listFaces, listSetups, loadAll } from '../db/repo'
import {
  applyFilters,
  denormalize,
  DEFAULT_FILTERS,
  distinctDistances,
  mradPoints,
  personalRecords,
  sessionSeries,
  summarize,
  volume,
  type Filters,
} from '../lib/overall'
import { Button, Card, Empty, Field, Note, Segmented, Stat } from '../ui/atoms'
import { CHART_AXIS as AXIS, CHART_TOOLTIP as TOOLTIP, chartValue } from '../ui/chartFormat'
import { Heatmap } from '../ui/Heatmap'

const RANKED = new Set(FORMATS.filter((f) => f.ranked).map((f) => f.id))

export function StatsScreen() {
  const all = useLiveQuery(() => loadAll(), [], undefined)
  const faces = useLiveQuery(() => listFaces(), [], undefined)
  const setups = useLiveQuery(() => listSetups(), [], undefined)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [volumeBy, setVolumeBy] = useState<'week' | 'month'>('week')
  const [aKey, setAKey] = useState<string>('')
  const [bKey, setBKey] = useState<string>('')

  const rows = useMemo(() => (all ? denormalize(all) : []), [all])
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters])
  const series = useMemo(() => sessionSeries(filtered), [filtered])
  const heat = useMemo(() => mradPoints(filtered), [filtered])
  const records = useMemo(() => (all ? personalRecords(all, RANKED) : []), [all])
  const buckets = useMemo(() => volume(filtered, volumeBy, 12), [filtered, volumeBy])
  const distances = useMemo(() => distinctDistances(rows), [rows])
  const blankSessions = useMemo(
    () => new Set(filtered.filter((r) => !r.session.scored).map((r) => r.session.id)).size,
    [filtered],
  )

  // Сравнение: ключ — сетап целиком (s:id) или конкретная версия (v:id).
  const compareOptions = useMemo(() => {
    const out: { key: string; label: string }[] = []
    for (const s of setups ?? []) {
      out.push({ key: `s:${s.id}`, label: s.name })
      const vs = (all?.versions ?? [])
        .filter((v) => v.setupId === s.id)
        .sort((a, b) => b.versionNo - a.versionNo)
      for (const v of vs) out.push({ key: `v:${v.id}`, label: `${s.name} · v${v.versionNo}` })
    }
    return out
  }, [setups, all])

  const pick = (key: string) => {
    if (!key) return null
    const [kind, id] = key.split(':')
    const label = compareOptions.find((o) => o.key === key)?.label ?? ''
    const subset = rows.filter((r) => (kind === 's' ? r.setupId === id : r.versionId === id))
    return summarize(subset, label)
  }
  const a = pick(aKey)
  const b = pick(bKey)
  const sharedDistances =
    a && b
      ? a.rows.map((r) => r.distanceM).filter((d) => b.rows.some((x) => x.distanceM === d))
      : []

  if (!all) return <div className="p-6 text-muted">Загрузка…</div>
  if (rows.length === 0) return <Empty>Данных пока нет. Отстреляй первую сессию.</Empty>

  const singleDistance = filters.distanceM !== 'all'

  return (
    <div className="grid gap-3">
      <Card title="Фильтры">
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label="Дистанция">
            <select
              value={String(filters.distanceM)}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  distanceM: e.target.value === 'all' ? 'all' : Number(e.target.value),
                })
              }
            >
              <option value="all">все</option>
              {distances.map((d) => (
                <option key={d} value={d}>
                  {d} м
                </option>
              ))}
            </select>
          </Field>
          <Field label="Фейс">
            <select
              value={filters.faceId}
              onChange={(e) => setFilters({ ...filters, faceId: e.target.value })}
            >
              <option value="all">все</option>
              {faces?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Сетап">
            <select
              value={filters.setupId}
              onChange={(e) => setFilters({ ...filters, setupId: e.target.value })}
            >
              <option value="all">все</option>
              {setups?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Период">
            <select
              value={String(filters.days)}
              onChange={(e) => setFilters({ ...filters, days: Number(e.target.value) })}
            >
              <option value="0">за всё время</option>
              <option value="30">30 дней</option>
              <option value="90">90 дней</option>
              <option value="365">год</option>
            </select>
          </Field>
        </div>
        <div className="num mt-2 text-xs text-muted">
          В выборке {filtered.length} стрел, сессий {new Set(filtered.map((r) => r.session.id)).size}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Средний балл по сессиям">
          {series.length < 2 ? (
            <Empty>Нужно хотя бы две сессии.</Empty>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis domain={[0, 10]} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP} formatter={chartValue((v) => v.toFixed(2))} />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="var(--c-accent)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {blankSessions > 0 && (
            <Note>
              Отстрел без счёта в этот график не входит — там баллов нет ({blankSessions}{' '}
              {blankSessions === 1 ? 'сессия' : 'сессий'} в выборке). В кучность, тепловую карту и
              объём он входит.
            </Note>
          )}
        </Card>

        <Card title={`Mean radius по сессиям, ${singleDistance ? 'мм' : 'mrad'}`}>
          {series.length < 2 ? (
            <Empty>Нужно хотя бы две сессии.</Empty>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP} formatter={chartValue((v) => v.toFixed(2))} />
                  <Line
                    type="monotone"
                    dataKey={singleDistance ? 'meanRadiusMm' : 'meanRadiusMrad'}
                    stroke="var(--c-ok)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {!singleDistance ? (
            <Note>
              Mean radius — средний радиус разброса группы вокруг её же центра. В выборке разные
              дистанции, поэтому он показан в mrad: это угол, размер группы делится на дистанцию.
              Группа 10 см на 18 м и та же 10 см на 70 м — это 5.6 и 1.4 mrad, то есть совсем
              разное качество, хотя миллиметры одинаковые. Ориентир: 1 mrad — это 1.8 см на 18 м,
              5 см на 50 м и 7 см на 70 м. Меньше — лучше. Выбери одну дистанцию в фильтре, чтобы
              увидеть миллиметры.
            </Note>
          ) : (
            <Note>
              Средний радиус разброса группы вокруг её же центра, в миллиметрах на мишени. Меньше —
              лучше. Это кучность: смещение всей группы от центра мишени сюда не входит.
            </Note>
          )}
        </Card>

        <Card title="Тепловая карта">
          <Heatmap points={heat} className="mx-auto w-full max-w-sm" />
          <Note>
            Куда чаще всего ложатся стрелы относительно центра мишени — а на трёхспоте
            относительно центра своего спота. Все дистанции сложены вместе в угловых единицах
            (mrad), поэтому 18 м на 40 см и 70 м на 122 см попадают в одну картинку. Окружности —
            1, 2, 3 и 4 mrad; на 18 м это 1.8, 3.6, 5.4 и 7.2 см. Пятно смещено от центра — значит,
            прицел просит поправки; пятно размазано — вопрос к технике. Стрел с координатами:{' '}
            {heat.length}.
          </Note>
        </Card>

        <Card
          title="Объём"
          action={
            <Segmented<'week' | 'month'>
              value={volumeBy}
              onChange={setVolumeBy}
              options={[
                { value: 'week', label: 'Недели' },
                { value: 'month', label: 'Месяцы' },
              ]}
            />
          }
        >
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Stat
              label={volumeBy === 'week' ? 'Стрел за неделю' : 'Стрел за месяц'}
              value={buckets.at(-1)?.arrows ?? 0}
            />
            <Stat
              label={volumeBy === 'week' ? 'Часов за неделю' : 'Часов за месяц'}
              value={buckets.at(-1)?.hours ?? 0}
            />
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
                <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" />
                <XAxis dataKey="key" {...AXIS} />
                <YAxis allowDecimals={false} {...AXIS} />
                <Tooltip contentStyle={TOOLTIP} />
                <Bar dataKey="arrows" fill="var(--c-accent)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Сравнение сетапов и версий">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="A">
            <select value={aKey} onChange={(e) => setAKey(e.target.value)}>
              <option value="">—</option>
              {compareOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="B">
            <select value={bKey} onChange={(e) => setBKey(e.target.value)}>
              <option value="">—</option>
              {compareOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {a && b ? (
          sharedDistances.length === 0 ? (
            <Note tone="warn">
              У этих двух нет общих дистанций — сравнивать нечего. Сравнение идёт только по
              одинаковым дистанциям.
            </Note>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="text-left font-normal">Дистанция</th>
                  <th className="text-right font-normal">{a.label}</th>
                  <th className="text-right font-normal">{b.label}</th>
                  <th className="text-right font-normal">Разница</th>
                </tr>
              </thead>
              <tbody>
                {sharedDistances.map((d) => {
                  const ra = a.rows.find((r) => r.distanceM === d)!
                  const rb = b.rows.find((r) => r.distanceM === d)!
                  return (
                    <Fragment key={d}>
                      <tr className="border-t border-line">
                        <td className="py-1">{d} м · средний</td>
                        <td className="num py-1 text-right">{ra.avg?.toFixed(2) ?? '—'}</td>
                        <td className="num py-1 text-right">{rb.avg?.toFixed(2) ?? '—'}</td>
                        <td
                          className={`num py-1 text-right ${
                            ra.avg === null || rb.avg === null
                              ? ''
                              : rb.avg >= ra.avg
                                ? 'text-ok'
                                : 'text-danger'
                          }`}
                        >
                          {ra.avg !== null && rb.avg !== null ? (rb.avg - ra.avg).toFixed(2) : '—'}
                        </td>
                      </tr>
                      <tr className="border-t border-line/50">
                        <td className="py-1 text-muted">{d} м · mean radius</td>
                        <td className="num py-1 text-right">
                          {ra.meanRadiusMm?.toFixed(1) ?? '—'}
                        </td>
                        <td className="num py-1 text-right">
                          {rb.meanRadiusMm?.toFixed(1) ?? '—'}
                        </td>
                        <td
                          className={`num py-1 text-right ${
                            (rb.meanRadiusMm ?? 0) <= (ra.meanRadiusMm ?? 0) ? 'text-ok' : 'text-danger'
                          }`}
                        >
                          {ra.meanRadiusMm !== null && rb.meanRadiusMm !== null
                            ? (rb.meanRadiusMm - ra.meanRadiusMm).toFixed(1)
                            : '—'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 text-xs text-muted">стрел</td>
                        <td className="num py-1 text-right text-xs text-muted">{ra.arrows}</td>
                        <td className="num py-1 text-right text-xs text-muted">{rb.arrows}</td>
                        <td />
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )
        ) : (
          <Empty>Выбери два сетапа или две версии одного сетапа.</Empty>
        )}
      </Card>

      <Card title="Личные рекорды">
        {records.length === 0 ? (
          <Empty>
            Рекордов пока нет: в зачёт идут только завершённые полные сессии стандартных форматов.
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {records.map((r) => (
              <li key={r.formatId}>
                <button
                  onClick={() => navigate(`/session/${r.sessionId}`)}
                  className="tap flex w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span>
                    <span className="block">{r.formatName}</span>
                    <span className="num block text-xs text-muted">
                      {new Date(r.date).toLocaleDateString('ru-RU')}
                    </span>
                  </span>
                  <span className="num text-right">
                    <span className="block text-lg font-semibold">{r.total}</span>
                    <span className="block text-xs text-muted">{r.xCount}X</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-center pb-4">
        <Button variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
          Сбросить фильтры
        </Button>
      </div>
    </div>
  )
}
