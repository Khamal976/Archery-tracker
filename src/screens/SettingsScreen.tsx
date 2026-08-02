import { useEffect, useRef, useState } from 'react'
import { navigate } from '../app/router'
import { useSettings } from '../app/useSettings'
import type { ThemeName } from '../core/types'
import { patchSettings } from '../db/repo'
import {
  applyBackup,
  buildBackup,
  buildCsv,
  downloadText,
  parseBackup,
  stamp,
  type MergeReport,
} from '../lib/backup'
import { Button, Card, Field, Note, Segmented, Toggle } from '../ui/atoms'

function ReportView({ report }: { report: MergeReport }) {
  const rows = Object.entries(report).filter(([, s]) => s.added + s.updated + s.kept > 0)
  if (rows.length === 0) return <Note>В файле не было записей.</Note>
  return (
    <div className="grid gap-1 text-sm">
      {rows.map(([name, s]) => (
        <div key={name} className="num flex justify-between gap-3">
          <span className="text-muted">{name}</span>
          <span>
            +{s.added} · обновлено {s.updated} · оставлено {s.kept}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SettingsScreen() {
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [report, setReport] = useState<MergeReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [])

  const exportJson = async () => {
    const data = await buildBackup()
    downloadText(`archery-backup-${stamp()}.json`, JSON.stringify(data), 'application/json')
    await patchSettings({ lastBackupAt: Date.now() })
  }

  const exportCsv = async () => {
    downloadText(`archery-shots-${stamp()}.csv`, await buildCsv(), 'text/csv')
  }

  const importJson = async (file: File) => {
    setError(null)
    setReport(null)
    try {
      const parsed = parseBackup(await file.text())
      setReport(await applyBackup(parsed))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось прочитать файл')
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title="Вид">
        <div className="grid gap-3">
          <Field label="Тема" hint="Светлая — высококонтрастная, для яркого солнца">
            <Segmented<ThemeName>
              value={settings.theme}
              onChange={(v) => patchSettings({ theme: v })}
              options={[
                { value: 'dark', label: 'Тёмная' },
                { value: 'light', label: 'Светлая' },
              ]}
            />
          </Field>
        </div>
      </Card>

      <Card title="На рубеже">
        <div className="grid gap-1">
          <Toggle
            checked={settings.wakeLockEnabled}
            onChange={(v) => patchSettings({ wakeLockEnabled: v })}
            label="Не давать экрану гаснуть"
            hint="Пока идёт сессия. Телефон не блокируется — разблокировка между сериями не нужна"
          />
          <Field label="Дежурный экран через" hint="Гасит картинку, но не телефон. Тап возвращает ввод">
            <Segmented<string>
              value={String(settings.idleDimSeconds)}
              onChange={(v) => patchSettings({ idleDimSeconds: Number(v) })}
              options={[
                { value: '0', label: 'Никогда' },
                { value: '60', label: '1 мин' },
                { value: '180', label: '3 мин' },
              ]}
            />
          </Field>
          <Toggle
            checked={settings.soundEnabled}
            onChange={(v) => patchSettings({ soundEnabled: v })}
            label="Звук таймера"
          />
          <Toggle
            checked={settings.vibrationEnabled}
            onChange={(v) => patchSettings({ vibrationEnabled: v })}
            label="Вибро таймера"
          />
        </div>
      </Card>

      <Card title="Статистика">
        <Toggle
          checked={settings.excludeFlyersDefault}
          onChange={(v) => patchSettings({ excludeFlyersDefault: v })}
          label="По умолчанию исключать флаеры"
          hint="Влияет только на кучность и смещение, счёт не меняется никогда"
        />
      </Card>

      <Card title="Мишени">
        <div className="grid gap-2">
          <p className="text-sm text-muted">
            Фейсы — это данные: можно завести свой, не трогая код.
          </p>
          <Button variant="ghost" onClick={() => navigate('/faces')}>
            Мишени и фейсы
          </Button>
        </div>
      </Card>

      <Card title="Перенос между устройствами" className="lg:col-span-2">
        <div className="grid gap-3">
          <Note>
            Синхронизации нет и не будет: данные лежат только здесь. Перенос — экспорт файла
            и импорт на другом устройстве. При импорте записи сливаются по id, побеждает более
            поздняя правка, дублей не появляется.
          </Note>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="primary" onClick={exportJson}>
              Экспорт JSON
            </Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              Импорт JSON
            </Button>
            <Button variant="ghost" onClick={exportCsv}>
              Экспорт CSV
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importJson(f)
              e.target.value = ''
            }}
          />
          {error && <Note tone="warn">{error}</Note>}
          {report && <ReportView report={report} />}
          <div className="num text-xs text-muted">
            Последний бэкап:{' '}
            {settings.lastBackupAt
              ? new Date(settings.lastBackupAt).toLocaleString('ru-RU')
              : 'ещё не делался'}
            {persisted !== null && (
              <>
                {' · '}хранилище{' '}
                {persisted ? 'защищено от выселения' : 'без гарантии от выселения браузером'}
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
