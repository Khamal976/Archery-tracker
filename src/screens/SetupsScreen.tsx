import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { navigate } from '../app/router'
import { BOW_TYPES, bowTypeLabel } from '../core/equipment'
import type { BowType } from '../core/types'
import { db } from '../db/db'
import { createSetup, listSetups } from '../db/repo'
import { Button, Card, Empty, Field, Modal } from '../ui/atoms'

export function SetupsScreen() {
  const setups = useLiveQuery(() => listSetups(), [], undefined)
  const versions = useLiveQuery(() => db.setupVersions.toArray(), [], undefined)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [bowType, setBowType] = useState<BowType>('recurve')

  const create = async () => {
    const setup = await createSetup(name.trim() || 'Без названия', bowType, {})
    setOpen(false)
    setName('')
    navigate(`/setups/${setup.id}`)
  }

  return (
    <div className="grid gap-3">
      <Card title="Настройка лука">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-muted">
            Конспект по настройке: центровка плечей, база, тиллер, насечки, центр-шот, планжер.
          </p>
          <Button variant="ghost" onClick={() => navigate('/tuning')}>
            Открыть справочник
          </Button>
        </div>
      </Card>

      <Card
        title="Сетапы снаряжения"
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            + Сетап
          </Button>
        }
      >
        {setups?.length === 0 && (
          <Empty>
            Сетапов нет. Заведи первый — сессия будет ссылаться на конкретную его версию,
            и потом можно будет сравнить «до и после» настройки.
          </Empty>
        )}
        <ul className="divide-y divide-line">
          {setups?.map((s) => {
            const count = (versions ?? []).filter(
              (v) => v.setupId === s.id && v.deletedAt === null,
            ).length
            return (
              <li key={s.id}>
                <button
                  onClick={() => navigate(`/setups/${s.id}`)}
                  className="tap flex w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span>
                    <span className="block">{s.name}</span>
                    <span className="block text-xs text-muted">{bowTypeLabel(s.bowType)}</span>
                  </span>
                  <span className="num text-xs text-muted">
                    {count} {count === 1 ? 'версия' : 'версий'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Новый сетап">
        <div className="grid gap-3">
          <Field label="Название">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Хойт классика"
            />
          </Field>
          <Field label="Тип лука" hint="От него зависит набор полей">
            <select value={bowType} onChange={(e) => setBowType(e.target.value as BowType)}>
              {BOW_TYPES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
          <Button variant="primary" onClick={create}>
            Создать
          </Button>
        </div>
      </Modal>
    </div>
  )
}
