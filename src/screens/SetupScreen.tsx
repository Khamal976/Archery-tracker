import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../app/router'
import { bowTypeLabel, diffFields, groupedFieldsFor } from '../core/equipment'
import { tuningFor } from '../core/tuning'
import { db } from '../db/db'
import { commitSetupVersion, deleteSetup, listVersions, renameSetup } from '../db/repo'
import { Button, Card, Empty, Field, Note } from '../ui/atoms'

export function SetupScreen({ setupId }: { setupId: string }) {
  const setup = useLiveQuery(() => db.setups.get(setupId), [setupId], undefined)
  const versions = useLiveQuery(() => listVersions(setupId), [setupId], undefined)

  const current = versions?.[0]
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    setDraft(current?.fields ?? {})
  }, [current])
  useEffect(() => {
    setName(setup?.name ?? '')
  }, [setup])

  const groups = useMemo(
    () => (setup ? groupedFieldsFor(setup.bowType) : []),
    [setup],
  )

  if (!setup) return <div className="p-6 text-muted">Сетап не найден.</div>

  const changes = current ? diffFields(setup.bowType, current.fields, draft) : []
  const dirty = changes.length > 0

  const save = async () => {
    if (!dirty) return
    await commitSetupVersion(setupId, draft, reason.trim() || 'Без описания')
    setReason('')
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="grid gap-3">
        <Card title="Сетап">
          <div className="grid gap-3">
            <Field label="Название">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && name !== setup.name && renameSetup(setupId, name.trim())}
              />
            </Field>
            <div className="text-sm text-muted">
              Тип лука: {bowTypeLabel(setup.bowType)} · текущая версия v{current?.versionNo ?? 1}
            </div>
          </div>
        </Card>

        {groups.map((g) => (
          <Card
            key={g.group}
            title={g.group}
            action={
              tuningFor(g.group).length > 0 && (
                <div className="flex flex-wrap justify-end gap-1">
                  {tuningFor(g.group).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/tuning/${s.id}`)}
                      className="rounded-lg border border-line px-2 py-1 text-xs text-accent"
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              )
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {g.fields.map((f) => (
                <Field key={f.key} label={f.unit ? `${f.label}, ${f.unit}` : f.label} hint={f.hint}>
                  {f.kind === 'textarea' ? (
                    <textarea
                      rows={2}
                      value={draft[f.key] ?? ''}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      inputMode={f.kind === 'number' ? 'decimal' : 'text'}
                      value={draft[f.key] ?? ''}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    />
                  )}
                </Field>
              ))}
            </div>
          </Card>
        ))}

        <Button variant="danger" onClick={() => deleteSetup(setupId).then(() => navigate('/setups'))}>
          Удалить сетап
        </Button>
      </div>

      <div className="grid gap-3 self-start lg:sticky lg:top-3">
        <Card title="Сохранение">
          {dirty ? (
            <div className="grid gap-3">
              <div className="grid gap-1 text-sm">
                {changes.map((c) => (
                  <div key={c.key} className="flex flex-wrap gap-1">
                    <span className="text-muted">{c.label}:</span>
                    <span className="line-through opacity-60">{c.from || '—'}</span>
                    <span>→ {c.to || '—'}</span>
                  </div>
                ))}
              </div>
              <Field label="Причина изменения" hint="Зачем крутил — это попадёт в журнал">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Например: подняли тиллер на 1 мм"
                />
              </Field>
              <Button variant="primary" onClick={save}>
                Сохранить как новую версию
              </Button>
              <Note>
                Старые сессии останутся привязанными к своей версии — иначе сравнение «до и
                после» потеряет смысл.
              </Note>
            </div>
          ) : (
            <Empty>Изменений нет.</Empty>
          )}
        </Card>

        <Card title="Журнал изменений">
          <ol className="grid gap-3">
            {versions?.map((v, i) => {
              const prev = versions[i + 1]
              const d = prev ? diffFields(setup.bowType, prev.fields, v.fields) : []
              return (
                <li key={v.id} className="border-l-2 border-line pl-3">
                  <div className="num text-sm font-semibold">
                    v{v.versionNo} · {new Date(v.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                  <div className="text-sm">{v.reason}</div>
                  {prev && (
                    <ul className="mt-1 grid gap-0.5 text-xs text-muted">
                      {d.length === 0 && <li>поля не менялись</li>}
                      {d.map((c) => (
                        <li key={c.key}>
                          {c.label}: {c.from || '—'} → {c.to || '—'}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        </Card>
      </div>
    </div>
  )
}
