import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../app/router'
import { useSettings } from '../app/useSettings'
import { resolveHit } from '../core/scoring'
import { totals } from '../core/scoring'
import type { End, InputMode, Point, Shot, SpotMode, Stage } from '../core/types'
import {
  addShot,
  ensureEnd,
  finishSession,
  listFaces,
  loadSession,
  patchEnd,
  patchShot,
  pauseSession,
  resumeSession,
  undoLastShot,
  type SessionBundle,
} from '../db/repo'
import { mmss, useEndTimer } from '../lib/useTimer'
import { useWakeLock } from '../lib/useWakeLock'
import { Button, Modal, Segmented } from '../ui/atoms'
import { IdleDim } from '../ui/IdleDim'
import { NumberPad, type NumberKey } from '../ui/NumberPad'
import { TargetView, type ShotPoint } from '../ui/TargetView'
import { ThemeToggle } from '../ui/ThemeToggle'
import { AddStageForm } from './AddStageForm'

interface Position {
  stage: Stage
  end: End | null
  endIndex: number
}

/** Где мы сейчас: первая недобитая серия первого недобитого этапа. */
function locate(b: SessionBundle): Position | null {
  const last = b.stages.at(-1)
  for (const stage of b.stages) {
    // Этап без ограничения по сериям не заканчивается сам. Если после него завели
    // новый этап — значит, дистанцию сменили, и мы стреляем уже там.
    if (stage.endsPlanned === null && stage !== last) continue

    const ends = b.ends.filter((e) => e.stageId === stage.id).sort((a, x) => a.index - x.index)
    for (const end of ends) {
      const n = b.shots.filter((s) => s.endId === end.id).length
      if (n < stage.arrowsPerEnd) return { stage, end, endIndex: end.index }
    }
    if (stage.endsPlanned === null || ends.length < stage.endsPlanned) {
      return { stage, end: null, endIndex: ends.length }
    }
  }
  return null
}

/**
 * Полная ли сессия. Этапы без ограничения по сериям неполноты не создают — там
 * нечего недостреливать. Полнота нужна личным рекордам: недобитый формат в зачёт не идёт.
 */
function isSessionComplete(b: SessionBundle): boolean {
  for (const stage of b.stages) {
    if (stage.endsPlanned === null) continue
    const ends = b.ends.filter((e) => e.stageId === stage.id)
    if (ends.length < stage.endsPlanned) return false
    for (const end of ends) {
      if (b.shots.filter((s) => s.endId === end.id).length < stage.arrowsPerEnd) return false
    }
  }
  return true
}

function shotLabel(s: Shot): string {
  if (s.isMiss) return 'M'
  if (s.isX) return 'X'
  return String(s.value)
}

export function ShootScreen({ sessionId }: { sessionId: string }) {
  const bundle = useLiveQuery(() => loadSession(sessionId), [sessionId], undefined)
  const faceList = useLiveQuery(() => listFaces(), [], undefined)
  const settings = useSettings()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [stageFormOpen, setStageFormOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [debrief, setDebrief] = useState('')
  /** Просмотр прошлой серии для правки задним числом; null — текущая. */
  const [viewEndId, setViewEndId] = useState<string | null>(null)

  useWakeLock(settings.wakeLockEnabled)

  // Время сессии копится, пока мы на экране ввода.
  useEffect(() => {
    void resumeSession(sessionId)
    return () => void pauseSession(sessionId)
  }, [sessionId])

  const faces = useMemo(
    () => new Map((faceList ?? []).map((f) => [f.id, f] as const)),
    [faceList],
  )

  const pos = bundle ? locate(bundle) : null
  const lastEnd = bundle?.ends.at(-1)

  // Серия заканчивается — сразу открываем следующую, без подтверждений.
  useEffect(() => {
    if (!bundle || !pos || pos.end) return
    void ensureEnd(
      sessionId,
      pos.stage.id,
      pos.endIndex,
      lastEnd?.inputMode ?? 'target',
      lastEnd?.spotMode ?? 'onePerSpot',
    )
  }, [bundle, pos, sessionId, lastEnd])

  const timer = useEndTimer(bundle?.session.timer ?? null, {
    sound: settings.soundEnabled,
    haptic: settings.vibrationEnabled,
  })

  if (!bundle) return <div className="p-6 text-muted">Загрузка…</div>

  const { session } = bundle
  const done = pos === null

  // Серии в порядке отстрела — по ним можно ходить назад и править что угодно.
  const order = bundle.stages.flatMap((st) =>
    bundle.ends.filter((e) => e.stageId === st.id).sort((a, b) => a.index - b.index),
  )
  const currentEnd = pos?.end ?? order.at(-1) ?? null
  const end = (viewEndId ? order.find((e) => e.id === viewEndId) : null) ?? currentEnd
  const viewingPast = !!end && !!currentEnd && end.id !== currentEnd.id
  const orderIndex = end ? order.findIndex((e) => e.id === end.id) : -1

  const stage = (end ? bundle.stages.find((s) => s.id === end.stageId) : null) ?? bundle.stages.at(-1)!
  const face = faces.get(stage.faceId)
  const endShots = end ? bundle.shots.filter((s) => s.endId === end.id) : []
  // Дострелять можно только незавершённую сессию; править — любую.
  const canAdd = !!end && session.status !== 'finished' && endShots.length < stage.arrowsPerEnd

  const all = totals(bundle.shots)
  const plannedArrows = bundle.stages.reduce<number | null>(
    (acc, s) => (acc === null || s.endsPlanned === null ? null : acc + s.endsPlanned * s.arrowsPerEnd),
    0,
  )

  const spotCount = face?.spots?.centers.length ?? 0
  const occupied = new Set(endShots.map((s) => s.spotIndex).filter((v): v is number => v !== null))
  const highlightSpot =
    end?.spotMode === 'onePerSpot' && spotCount > 0
      ? (() => {
          for (let i = 0; i < spotCount; i++) if (!occupied.has(i)) return i
          return null
        })()
      : null

  const points: ShotPoint[] = endShots
    .filter((s) => s.x !== null && s.y !== null)
    .map((s) => ({
      id: s.id,
      x: s.x!,
      y: s.y!,
      spotIndex: s.spotIndex,
      value: s.value,
      isX: s.isX,
      isMiss: s.isMiss,
    }))

  const commit = async (p: Point) => {
    if (!face || !end || !canAdd) return
    const hit = resolveHit(face, p)
    const repeated =
      end.spotMode === 'onePerSpot' && hit.spotIndex !== null && occupied.has(hit.spotIndex)
    await addShot({
      sessionId,
      stageId: stage.id,
      endId: end.id,
      x: hit.local.x,
      y: hit.local.y,
      spotIndex: hit.spotIndex,
      value: session.scored ? hit.value : 0,
      isX: session.scored && hit.isX,
      isMiss: session.scored && hit.isMiss,
      repeatedSpot: repeated,
    })
  }

  const move = async (id: string, p: Point) => {
    if (!face) return
    const hit = resolveHit(face, p)
    await patchShot(id, {
      x: hit.local.x,
      y: hit.local.y,
      spotIndex: hit.spotIndex,
      value: session.scored ? hit.value : 0,
      isX: session.scored && hit.isX,
      isMiss: session.scored && hit.isMiss,
    })
    setSelectedId(null)
  }

  const pickNumber = async (k: NumberKey) => {
    if (!end || !canAdd) return
    await addShot({
      sessionId,
      stageId: stage.id,
      endId: end.id,
      x: null,
      y: null,
      spotIndex: null,
      value: k.value,
      isX: k.isX,
      isMiss: k.isMiss,
      repeatedSpot: false,
    })
  }

  const finish = async () => {
    await finishSession(sessionId, isSessionComplete(bundle), debrief.trim())
    navigate(`/session/${sessionId}`)
  }

  const endsLabel =
    stage.endsPlanned === null
      ? `серия ${(end?.index ?? 0) + 1}`
      : `серия ${(end?.index ?? 0) + 1} из ${stage.endsPlanned}`

  const goEnd = (delta: number) => {
    const next = order[orderIndex + delta]
    if (!next) return
    setSelectedId(null)
    setViewEndId(next.id === currentEnd?.id ? null : next.id)
  }

  return (
    <div className="flex h-dvh flex-col bg-bg text-ink">
      <header className="safe-top flex items-center gap-2 border-b border-line px-2 py-2">
        <Button variant="plain" onClick={() => setMenuOpen(true)} aria-label="Меню сессии">
          ☰
        </Button>
        <div className="min-w-0 flex-1 text-center leading-tight">
          <div className="truncate text-xs text-muted">
            {stage.distanceM} м · {face?.name ?? '—'}
            {bundle.stages.length > 1 && ` · этап ${stage.index + 1}/${bundle.stages.length}`}
          </div>
          <div className="num flex items-center justify-center gap-1 text-sm">
            <button
              className="px-2 text-muted disabled:opacity-30"
              onClick={() => goEnd(-1)}
              disabled={orderIndex <= 0}
              aria-label="Предыдущая серия"
            >
              ‹
            </button>
            <span className={viewingPast ? 'text-accent' : ''}>
              {endsLabel} · {all.arrows}
              {plannedArrows !== null && `/${plannedArrows}`} стрел
            </span>
            <button
              className="px-2 text-muted disabled:opacity-30"
              onClick={() => goEnd(1)}
              disabled={orderIndex < 0 || orderIndex >= order.length - 1}
              aria-label="Следующая серия"
            >
              ›
            </button>
          </div>
        </div>
        {session.scored ? (
          <div className="text-right leading-tight">
            <div className="num text-xl font-semibold">{all.total}</div>
            <div className="num text-xs text-muted">
              {all.avgPerArrow.toFixed(2)} · {all.xCount}X
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted">без счёта</div>
        )}
      </header>

      {timer.running && (
        <div
          className={`num flex items-center justify-center gap-3 py-1 text-lg font-semibold ${
            timer.phase === 'shoot' ? 'bg-accent text-bg' : 'bg-surface2 text-muted'
          }`}
        >
          <span className="text-sm font-normal">{timer.label}</span>
          {mmss(timer.remaining)}
          <button className="text-sm font-normal underline" onClick={timer.stop}>
            стоп
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 items-center justify-center p-1">
          {face && end?.inputMode === 'target' && (
            <TargetView
              face={face}
              shots={points}
              onAdd={commit}
              onMove={move}
              selectedId={selectedId}
              highlightSpot={canAdd ? highlightSpot : null}
              className="h-full w-full"
              canAdd={canAdd}
            />
          )}
          {face && end?.inputMode === 'numbers' && (
            <div className="w-full max-w-md p-3">
              <NumberPad face={face} onPick={pickNumber} disabled={!canAdd} />
              <p className="mt-3 text-center text-xs text-muted">
                Координат нет — кучность по этой серии не считается.
              </p>
            </div>
          )}
          {done && !viewingPast && session.status !== 'finished' && (
            <div className="absolute inset-x-0 bottom-28 mx-auto max-w-sm px-4">
              <div className="card p-4 text-center">
                <p className="mb-3">Все серии отстреляны.</p>
                <Button variant="primary" onClick={() => setFinishOpen(true)} className="w-full">
                  Завершить и посмотреть статистику
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className="safe-bottom border-t border-line lg:w-80 lg:border-t-0 lg:border-l">
          <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
            {endShots.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                className={`tap num flex shrink-0 flex-col items-center justify-center rounded-lg border px-3 text-lg font-semibold ${
                  selectedId === s.id
                    ? 'border-accent bg-accent text-bg'
                    : 'border-line bg-surface2 text-ink'
                }`}
              >
                {session.scored ? shotLabel(s) : '•'}
                {s.repeatedSpot && <span className="text-[10px] font-normal">повтор</span>}
              </button>
            ))}
            {endShots.length === 0 && (
              <span className="px-2 text-sm text-muted">
                {end?.inputMode === 'target' ? 'Тапни по мишени' : 'Выбери номинал'}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2 pl-2">
              {session.scored && endShots.length > 0 && (
                <span className="num text-sm text-muted">
                  {totals(endShots).total}
                </span>
              )}
              <Button
                variant="ghost"
                onClick={() => end && undoLastShot(end.id)}
                disabled={endShots.length === 0}
                aria-label="Отменить последний выстрел"
              >
                ⌫
              </Button>
            </div>
          </div>

          {selectedId && (
            <p className="px-3 pb-2 text-xs text-accent">
              Правка выстрела: тапни новое место на мишени.
            </p>
          )}
          {viewingPast && !selectedId && (
            <div className="flex items-center justify-between gap-2 px-3 pb-2 text-xs text-muted">
              <span>Прошлая серия — можно поправить любой выстрел.</span>
              <button className="text-accent underline" onClick={() => setViewEndId(null)}>
                к текущей
              </button>
            </div>
          )}
          {session.status === 'finished' && (
            <p className="px-3 pb-2 text-xs text-muted">
              Сессия завершена: выстрелы можно править, добавлять новые — нет.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
            <Segmented<InputMode>
              className="flex-1"
              value={end?.inputMode ?? 'target'}
              onChange={(v) => end && patchEnd(end.id, { inputMode: v })}
              options={[
                { value: 'target', label: 'По мишени' },
                { value: 'numbers', label: 'Числами' },
              ]}
            />
            {spotCount > 0 && (
              <Segmented<SpotMode>
                className="flex-1"
                value={end?.spotMode ?? 'onePerSpot'}
                onChange={(v) => end && patchEnd(end.id, { spotMode: v })}
                options={[
                  { value: 'onePerSpot', label: 'По одной в спот' },
                  { value: 'free', label: 'Свободно' },
                ]}
              />
            )}
            {session.timer?.enabled && !timer.running && (
              <Button variant="ghost" onClick={timer.start}>
                ⏱ Старт серии
              </Button>
            )}
            {session.status !== 'finished' && (
              <Button variant="primary" onClick={() => setFinishOpen(true)}>
                Завершить
              </Button>
            )}
          </div>
        </aside>
      </div>

      <IdleDim seconds={settings.idleDimSeconds} enabled={settings.wakeLockEnabled}>
        <div className="num text-5xl font-semibold">{session.scored ? all.total : all.arrows}</div>
        <div className="mt-1 text-sm">{endsLabel}</div>
      </IdleDim>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Сессия">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {session.formatName}
              {session.note && ` · ${session.note}`}
            </p>
            <ThemeToggle theme={settings.theme} />
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setMenuOpen(false)
              navigate('/')
            }}
          >
            Пауза и выход — сессия сохранится
          </Button>
          {(stage.endsPlanned === null || session.formatId === 'free') && (
            <Button
              variant="ghost"
              onClick={() => {
                setMenuOpen(false)
                setStageFormOpen(true)
              }}
            >
              Сменить дистанцию или фейс — новый этап
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => {
              setMenuOpen(false)
              setFinishOpen(true)
            }}
          >
            Завершить сессию
          </Button>
        </div>
      </Modal>

      <Modal open={finishOpen} onClose={() => setFinishOpen(false)} title="Разбор тренировки">
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-muted">Стрел</div>
              <div className="num text-xl font-semibold">{all.arrows}</div>
            </div>
            {session.scored && (
              <>
                <div>
                  <div className="text-xs text-muted">Счёт</div>
                  <div className="num text-xl font-semibold">{all.total}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Средний</div>
                  <div className="num text-xl font-semibold">{all.avgPerArrow.toFixed(2)}</div>
                </div>
              </>
            )}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">
              Как прошло: самочувствие, что не получилось, где были ошибки и ощущения
            </span>
            <textarea rows={5} value={debrief} onChange={(e) => setDebrief(e.target.value)} autoFocus />
          </label>
          {!isSessionComplete(bundle) && (
            <p className="text-xs text-muted">
              Сессия отстреляна не полностью — в личные рекорды она не пойдёт, но вся статистика
              сохранится.
            </p>
          )}
          <Button variant="primary" onClick={finish}>
            Завершить и сохранить
          </Button>
          <button className="text-xs text-muted underline" onClick={() => setFinishOpen(false)}>
            вернуться к стрельбе
          </button>
        </div>
      </Modal>

      <AddStageForm
        open={stageFormOpen}
        onClose={() => setStageFormOpen(false)}
        sessionId={sessionId}
        faces={faceList ?? []}
        previous={stage}
      />
    </div>
  )
}
