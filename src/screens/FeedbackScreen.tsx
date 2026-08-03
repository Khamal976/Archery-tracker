import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import {
  FEEDBACK_EMAIL,
  FEEDBACK_KINDS,
  feedbackMailto,
  kindLabel,
  type MailEnvironment,
} from '../core/feedbackMail'
import type { Feedback, FeedbackKind } from '../core/types'
import { addFeedback, deleteFeedback, listFeedback, patchFeedback } from '../db/repo'
import { Button, Card, Empty, Field, Note, Segmented } from '../ui/atoms'

declare const __APP_VERSION__: string

/** Обстановка, без которой ошибку не повторить. Собирается в момент отправки. */
function environment(createdAt: number): MailEnvironment {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent.trim()
  const w = typeof window === 'undefined' ? 0 : window.screen.width
  const h = typeof window === 'undefined' ? 0 : window.screen.height
  return {
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
    // Нулевой размер экрана бывает в нестандартных окружениях — врать в письме незачем.
    device: [ua.slice(0, 120).trim(), w > 0 && h > 0 ? `экран ${w}×${h}` : null]
      .filter(Boolean)
      .join(', '),
    createdAt: new Date(createdAt).toLocaleString('ru-RU'),
  }
}

/** Открывает письмо в почтовом клиенте. Отправку подтверждает человек, не приложение. */
function composeMail(f: Pick<Feedback, 'kind' | 'text' | 'context'>, createdAt: number) {
  const a = document.createElement('a')
  a.href = feedbackMailto(f, environment(createdAt))
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function dateLabel(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function FeedbackScreen() {
  const items = useLiveQuery(() => listFeedback(), [], undefined)
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [text, setText] = useState('')
  const [context, setContext] = useState('')

  const ready = text.trim().length > 0

  const clear = () => {
    setText('')
    setContext('')
  }

  const save = async () => {
    if (!ready) return
    await addFeedback(kind, text, context)
    clear()
  }

  const sendAndSave = async () => {
    if (!ready) return
    const row = await addFeedback(kind, text, context)
    composeMail(row, row.createdAt)
    clear()
  }

  const open = items?.filter((f) => f.status === 'open') ?? []
  const done = items?.filter((f) => f.status === 'done') ?? []

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title="Обратная связь">
        <div className="grid gap-3">
          <Segmented<FeedbackKind>
            value={kind}
            onChange={setKind}
            options={FEEDBACK_KINDS.map((k) => ({ value: k.value, label: k.label }))}
          />
          <p className="text-xs text-muted">
            {FEEDBACK_KINDS.find((k) => k.value === kind)?.hint}
          </p>

          <Field label="Что случилось">
            <textarea
              rows={5}
              value={text}
              placeholder="Опиши своими словами. Если это ошибка — что делал, что ожидал увидеть и что увидел."
              onChange={(e) => setText(e.target.value)}
            />
          </Field>

          <Field label="Где" hint="Экран или момент: ввод на трёхспоте, итоги сессии, справочник">
            <input value={context} onChange={(e) => setContext(e.target.value)} />
          </Field>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="primary" onClick={sendAndSave} disabled={!ready}>
              Написать письмо
            </Button>
            <Button variant="ghost" onClick={save} disabled={!ready}>
              Только записать
            </Button>
          </div>

          <Note>
            Приложение ничего никуда не отправляет само: оно собирает готовое письмо на{' '}
            {FEEDBACK_EMAIL} и открывает его в почте. Отправку подтверждаешь ты. Записи хранятся
            здесь же и попадают в бэкап, так что писать можно и без сети — письмо уйдёт из
            исходящих, когда сеть появится.
          </Note>
        </div>
      </Card>

      <div className="grid gap-3">
        <Card title={`Записи${open.length ? ` · ${open.length}` : ''}`}>
          {open.length === 0 && <Empty>Открытых записей нет.</Empty>}
          <ul className="grid gap-3">
            {open.map((f) => (
              <li key={f.id} className="rounded-xl border border-line p-3">
                <div className="num mb-1 text-xs text-muted">
                  {kindLabel(f.kind)} · {dateLabel(f.createdAt)}
                  {f.context && ` · ${f.context}`}
                </div>
                <p className="text-sm whitespace-pre-wrap">{f.text}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => composeMail(f, f.createdAt)}>
                    Письмо
                  </Button>
                  <Button variant="ghost" onClick={() => patchFeedback(f.id, { status: 'done' })}>
                    Закрыть
                  </Button>
                  <Button variant="danger" onClick={() => deleteFeedback(f.id)}>
                    Удалить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {done.length > 0 && (
          <Card title={`Закрытые · ${done.length}`}>
            <ul className="grid gap-2">
              {done.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="num block text-xs text-muted">
                      {kindLabel(f.kind)} · {dateLabel(f.createdAt)}
                    </span>
                    <span className="block truncate text-muted">{f.text}</span>
                  </span>
                  <button
                    className="shrink-0 text-xs text-accent underline"
                    onClick={() => patchFeedback(f.id, { status: 'open' })}
                  >
                    вернуть
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}
