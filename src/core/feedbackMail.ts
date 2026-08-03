import type { Feedback, FeedbackKind } from './types'

/**
 * Обратная связь без бэкенда: приложение собирает готовое письмо и открывает его
 * в почтовом клиенте. Ничего никуда само не отправляется — отправку подтверждает
 * человек в своей почте. Работает офлайн: клиент положит письмо в исходящие.
 */

/** Куда уходят письма. Менять здесь — одно место на всё приложение. */
export const FEEDBACK_EMAIL = 'fifth-sank-spud@duck.com'

/** Практический предел длины mailto: дальше часть клиентов молча обрезает ссылку. */
export const MAILTO_LIMIT = 1800

export const FEEDBACK_KINDS: { value: FeedbackKind; label: string; hint: string }[] = [
  { value: 'bug', label: 'Ошибка', hint: 'Что-то посчиталось или сработало не так' },
  { value: 'idea', label: 'Идея', hint: 'Чего не хватает' },
  { value: 'note', label: 'Заметка', hint: 'Наблюдение на будущее' },
]

export function kindLabel(kind: FeedbackKind): string {
  return FEEDBACK_KINDS.find((k) => k.value === kind)?.label ?? kind
}

function firstLine(text: string, max = 60): string {
  const line = text.trim().split('\n')[0] ?? ''
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`
}

export function mailSubject(f: Pick<Feedback, 'kind' | 'text'>): string {
  const head = firstLine(f.text)
  return head ? `Трекер стрельбы · ${kindLabel(f.kind)}: ${head}` : `Трекер стрельбы · ${kindLabel(f.kind)}`
}

export interface MailEnvironment {
  /** Версия приложения из package.json. */
  version: string
  /** Браузер и размер экрана — без этого баг не повторить. */
  device: string
  /** Дата в читаемом виде; передаётся снаружи, чтобы функция осталась чистой. */
  createdAt: string
}

export function mailBody(f: Pick<Feedback, 'kind' | 'text' | 'context'>, env: MailEnvironment): string {
  const tail = [
    '---',
    `Тип: ${kindLabel(f.kind)}`,
    f.context.trim() ? `Где: ${f.context.trim()}` : null,
    `Создано: ${env.createdAt}`,
    `Версия: ${env.version}`,
    `Устройство: ${env.device}`,
  ]
    .filter((l): l is string => l !== null)
    .join('\n')

  const room = MAILTO_LIMIT - tail.length - 2
  const text = f.text.trim()
  const body = text.length > room ? `${text.slice(0, Math.max(0, room - 1))}…` : text

  return `${body}\n\n${tail}`
}

/**
 * Готовая ссылка mailto. Перевод строки кодируется как %0A — так его понимают
 * и мобильные клиенты, и десктопные.
 */
export function feedbackMailto(
  f: Pick<Feedback, 'kind' | 'text' | 'context'>,
  env: MailEnvironment,
  to = FEEDBACK_EMAIL,
): string {
  const subject = encodeURIComponent(mailSubject(f))
  const body = encodeURIComponent(mailBody(f, env))
  return `mailto:${to}?subject=${subject}&body=${body}`
}
