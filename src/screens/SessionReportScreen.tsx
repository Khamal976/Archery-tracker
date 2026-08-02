import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
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
import { useSettings } from '../app/useSettings'
import { totals } from '../core/scoring'
import type { Shot } from '../core/types'
import { deleteSession, listFaces, loadAll, loadSession, patchSession } from '../db/repo'
import {
  activeMs,
  computeSessionStats,
  endTrend,
  formatDuration,
  ringHistogram,
} from '../lib/stats'
import { Button, Card, Empty, Note, Stat, Toggle } from '../ui/atoms'
import { CHART_AXIS as AXIS, CHART_TOOLTIP, chartValue } from '../ui/chartFormat'
import { PrecisionBlock, SightAdviceBlock } from '../ui/MetricsBlock'
import { TargetView, type ShotPoint } from '../ui/TargetView'

function toPoints(shots: Shot[], flyers: Set<string>): ShotPoint[] {
  return shots
    .filter((s) => s.x !== null && s.y !== null)
    .map((s) => ({
      id: s.id,
      x: s.x!,
      y: s.y!,
      spotIndex: s.spotIndex,
      value: s.value,
      isX: s.isX,
      isMiss: s.isMiss,
      flyer: flyers.has(s.id),
    }))
}

export function SessionReportScreen({ sessionId }: { sessionId: string }) {
  const settings = useSettings()
  const bundle = useLiveQuery(() => loadSession(sessionId), [sessionId], undefined)
  const faceList = useLiveQuery(() => listFaces(), [], undefined)
  const everything = useLiveQuery(() => loadAll(), [], undefined)
  const [excludeFlyers, setExcludeFlyers] = useState(settings.excludeFlyersDefault)
  const [debrief, setDebrief] = useState<string | null>(null)

  const faces = useMemo(() => new Map((faceList ?? []).map((f) => [f.id, f] as const)), [faceList])
  const stats = useMemo(
    () => (bundle ? computeSessionStats(bundle, faces, { excludeFlyers }) : null),
    [bundle, faces, excludeFlyers],
  )

  // Среднее по этому формату на прошлых сессиях — есть с чем сравнить сегодняшнюю.
  const formatAverage = useMemo(() => {
    if (!everything || !bundle) return null
    const others = everything.sessions.filter(
      (s) => s.formatId === bundle.session.formatId && s.id !== sessionId && s.status === 'finished',
    )
    if (others.length === 0) return null
    const ids = new Set(others.map((s) => s.id))
    const shots = everything.shots.filter((s) => ids.has(s.sessionId))
    if (shots.length === 0) return null
    return { avg: totals(shots).avgPerArrow, sessions: others.length }
  }, [everything, bundle, sessionId])

  if (!bundle || !stats) return <div className="p-6 text-muted">Загрузка…</div>
  const { session } = bundle
  const trend = endTrend(stats)
  const scored = session.scored

  return (
    <div className="grid gap-3">
      <Card
        title={session.formatName}
        action={
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => navigate(`/shoot/${sessionId}`)}>
              {session.status === 'finished' ? 'Править выстрелы' : 'Продолжить'}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm('Удалить сессию?')) void deleteSession(sessionId).then(() => navigate('/'))
              }}
            >
              Удалить
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {scored && (
            <>
              <Stat
                label="Счёт"
                value={stats.totals.total}
                sub={stats.arrowsPlanned ? `из ${stats.arrowsPlanned * 10}` : undefined}
              />
              <Stat label="Средний за стрелу" value={stats.totals.avgPerArrow.toFixed(2)} />
              <Stat label="X" value={stats.totals.xCount} sub={`${(stats.totals.xRatio * 100).toFixed(0)}%`} />
              <Stat
                label="Жёлтое"
                value={`${(stats.totals.goldRatio * 100).toFixed(0)}%`}
                sub={`10 и лучше — ${(stats.totals.tenRatio * 100).toFixed(0)}%`}
              />
            </>
          )}
          <Stat
            label="Стрел"
            value={stats.totals.arrows}
            sub={stats.arrowsPlanned ? `план ${stats.arrowsPlanned}` : 'без плана'}
          />
          <Stat label="Время" value={formatDuration(activeMs(session))} />
        </div>
        <div className="mt-3 text-xs text-muted">
          {new Date(session.startedAt).toLocaleString('ru-RU')} ·{' '}
          {session.place === 'indoor' ? 'зал' : 'улица'}
          {session.note && ` · ${session.note}`}
          {!session.complete && session.status === 'finished' && ' · сессия неполная'}
        </div>
        {formatAverage && scored && (
          <div className="mt-2 text-sm">
            Средний по формату за прошлые {formatAverage.sessions} сессий:{' '}
            <span className="num">{formatAverage.avg.toFixed(2)}</span>{' '}
            <span
              className={
                stats.totals.avgPerArrow >= formatAverage.avg ? 'text-ok' : 'text-danger'
              }
            >
              ({stats.totals.avgPerArrow >= formatAverage.avg ? '+' : ''}
              {(stats.totals.avgPerArrow - formatAverage.avg).toFixed(2)})
            </span>
          </div>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Разбор тренировки">
          <textarea
            rows={4}
            value={debrief ?? session.debrief ?? ''}
            placeholder="Как прошло: самочувствие, что не получилось, где были ошибки и ощущения"
            onChange={(e) => setDebrief(e.target.value)}
            onBlur={() => {
              if (debrief !== null && debrief !== (session.debrief ?? '')) {
                void patchSession(sessionId, { debrief })
              }
            }}
          />
          <p className="mt-1 text-xs text-muted">Сохраняется автоматически, можно дописать позже.</p>
        </Card>

        <Card title="Флаеры">
          {stats.flyerIds.size === 0 ? (
            <Note>
              Флаеров нет: ни один выстрел не ушёл дальше 2.5 радиальных СКО от остальных.
              {stats.withCoords < 5 && ' Для поиска выброса нужно хотя бы пять выстрелов с координатами.'}
            </Note>
          ) : (
            <Toggle
              checked={excludeFlyers}
              onChange={setExcludeFlyers}
              label={`Исключить флаеры из метрик (${stats.flyerIds.size})`}
              hint="На карте попаданий они красные. Счёт и рекорды не меняются, данные не трогаются"
            />
          )}
        </Card>
      </div>

      {scored && trend.length > 1 && (
        <Card title="Средний балл по сериям">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" />
                <XAxis dataKey="end" {...AXIS} />
                <YAxis domain={[0, 10]} {...AXIS} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  formatter={chartValue((v) => v.toFixed(2), 'средний')}
                  labelFormatter={(l) => `Серия ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="var(--c-accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {stats.stages.map((st) => (
        <Card
          key={st.stage.id}
          title={`Этап ${st.stage.index + 1}: ${st.stage.distanceM} м · ${st.face?.name ?? '—'}`}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              {st.face ? (
                <TargetView
                  face={st.face}
                  shots={toPoints(st.shots, stats.flyerIds)}
                  readOnly
                  className="h-72 w-full"
                  centroid={!st.precisionMm.insufficient ? st.precisionMm.centroid : null}
                  ellipse={!st.precisionMm.insufficient ? st.precisionMm.ellipse : null}
                />
              ) : (
                <Empty>Фейс не найден</Empty>
              )}
            </div>

            <div className="grid gap-3 lg:col-span-1">
              {scored && (
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Счёт" value={st.totals.total} />
                  <Stat label="Средний" value={st.totals.avgPerArrow.toFixed(2)} />
                  <Stat label="X" value={st.totals.xCount} />
                </div>
              )}
              <PrecisionBlock mm={st.precisionMm} mrad={st.precisionMrad} />
              <SightAdviceBlock advice={st.advice} distanceM={st.stage.distanceM} />
            </div>

            <div className="lg:col-span-1">
              {scored && (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={ringHistogram(st.shots, st.face)}
                      margin={{ top: 5, right: 5, bottom: 0, left: -25 }}
                    >
                      <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" />
                      <XAxis dataKey="key" {...AXIS} />
                      <YAxis allowDecimals={false} {...AXIS} />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP}
                        formatter={chartValue((v) => String(v), 'стрел')}
                      />
                      <Bar dataKey="count" fill="var(--c-accent)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-muted">Серии этапа</summary>
                <table className="mt-2 w-full text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="text-left font-normal">№</th>
                      <th className="text-left font-normal">Выстрелы</th>
                      <th className="text-right font-normal">Сумма</th>
                      <th className="text-right font-normal">Mean radius</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.ends.map((e) => (
                      <tr key={e.end.id} className="border-t border-line">
                        <td className="num py-1">{e.end.index + 1}</td>
                        <td className="num py-1">
                          {e.shots
                            .map((s) => (s.isMiss ? 'M' : s.isX ? 'X' : String(s.value)))
                            .join(' ') || '—'}
                        </td>
                        <td className="num py-1 text-right">{scored ? e.totals.total : '—'}</td>
                        <td className="num py-1 text-right text-muted">
                          {e.precisionMm.insufficient
                            ? e.withCoords === 0
                              ? 'нет координат'
                              : 'мало данных'
                            : `${e.precisionMm.meanRadius.toFixed(1)} мм`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          </div>
        </Card>
      ))}

      <Card title="Сессия целиком">
        {stats.stages.length > 1 && (
          <Note>
            Этапы на разных дистанциях: в миллиметрах метрики не смешиваются, сводка по сессии —
            только в mrad.
          </Note>
        )}
        <div className="mt-2">
          <PrecisionBlock mm={stats.precisionMm} mrad={stats.precisionMrad} />
        </div>
      </Card>
    </div>
  )
}
