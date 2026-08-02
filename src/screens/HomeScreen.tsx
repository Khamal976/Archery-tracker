import { useLiveQuery } from 'dexie-react-hooks'
import { ThemeToggle } from '../ui/ThemeToggle'
import { navigate } from '../app/router'
import { useSettings } from '../app/useSettings'
import { totals } from '../core/scoring'
import { db } from '../db/db'
import { listSessions } from '../db/repo'
import { Button, Card, Empty, Note } from '../ui/atoms'

const DAY = 24 * 60 * 60 * 1000
export const BACKUP_REMINDER_DAYS = 14

function dateLabel(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HomeScreen() {
  const settings = useSettings()
  const sessions = useLiveQuery(() => listSessions(), [], undefined)
  const shots = useLiveQuery(() => db.shots.toArray(), [], undefined)

  const byId = new Map<string, ReturnType<typeof totals>>()
  if (sessions && shots) {
    const live = shots.filter((s) => s.deletedAt === null)
    for (const s of sessions) {
      byId.set(
        s.id,
        totals(live.filter((x) => x.sessionId === s.id)),
      )
    }
  }

  const unfinished = sessions?.find((s) => s.status !== 'finished')
  const staleBackup =
    settings.lastBackupAt === null || Date.now() - settings.lastBackupAt > BACKUP_REMINDER_DAYS * DAY
  const hasData = (sessions?.length ?? 0) > 0

  return (
    <div className="grid gap-3">
      {staleBackup && hasData && (
        <button onClick={() => navigate('/settings')} className="text-left">
          <Note tone="warn">
            {settings.lastBackupAt === null
              ? 'Бэкапа ещё не было. Данные живут только на этом устройстве — сделай экспорт.'
              : `Последний бэкап ${dateLabel(settings.lastBackupAt)}. Пора сделать новый.`}
          </Note>
        </button>
      )}

      {unfinished && (
        <Card title="Незавершённая сессия">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{unfinished.formatName}</div>
              <div className="num text-sm text-muted">
                {dateLabel(unfinished.startedAt)} · {byId.get(unfinished.id)?.arrows ?? 0} стрел
              </div>
            </div>
            <Button variant="primary" onClick={() => navigate(`/shoot/${unfinished.id}`)}>
              Продолжить
            </Button>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="primary" className="h-14 flex-1" onClick={() => navigate('/new')}>
          Начать сессию
        </Button>
        <Button variant="ghost" className="h-14 flex-1" onClick={() => navigate('/stats')}>
          Общая статистика
        </Button>
        <ThemeToggle theme={settings.theme} className="h-14 lg:hidden" />
      </div>

      <Card title="Сессии">
        {!sessions && <Empty>Загрузка…</Empty>}
        {sessions?.length === 0 && (
          <Empty>Пока пусто. Заведи сетап и начни первую сессию.</Empty>
        )}
        <ul className="divide-y divide-line">
          {sessions?.map((s) => {
            const t = byId.get(s.id)
            return (
              <li key={s.id}>
                <button
                  onClick={() =>
                    navigate(s.status === 'finished' ? `/session/${s.id}` : `/shoot/${s.id}`)
                  }
                  className="tap flex w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{s.formatName}</span>
                    <span className="num block text-xs text-muted">
                      {dateLabel(s.startedAt)}
                      {s.status !== 'finished' && ' · не завершена'}
                      {s.note && ` · ${s.note}`}
                    </span>
                  </span>
                  <span className="num shrink-0 text-right">
                    {s.scored ? (
                      <>
                        <span className="block text-lg font-semibold">{t?.total ?? 0}</span>
                        <span className="block text-xs text-muted">
                          {t?.arrows ?? 0} стрел · {t?.xCount ?? 0}X
                        </span>
                      </>
                    ) : (
                      <span className="block text-xs text-muted">
                        без счёта · {t?.arrows ?? 0} стрел
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
