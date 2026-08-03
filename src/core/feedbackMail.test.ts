import { describe, expect, it } from 'vitest'
import {
  FEEDBACK_EMAIL,
  MAILTO_LIMIT,
  feedbackMailto,
  mailBody,
  mailSubject,
} from './feedbackMail'
import type { MailEnvironment } from './feedbackMail'

const env: MailEnvironment = {
  version: '1.0.0',
  device: 'Chrome 141, Android, экран 412×915',
  createdAt: '01.08.2026, 14:03',
}

describe('тема письма', () => {
  it('содержит тип и первую строку заметки', () => {
    const s = mailSubject({ kind: 'bug', text: 'Счёт на трёхспоте задвоился\nвторая строка' })
    expect(s).toBe('Трекер стрельбы · Ошибка: Счёт на трёхспоте задвоился')
  })

  it('длинную первую строку подрезает', () => {
    const s = mailSubject({ kind: 'idea', text: 'я'.repeat(200) })
    expect(s.length).toBeLessThan(120)
    expect(s.endsWith('…')).toBe(true)
  })

  it('без текста остаётся осмысленной', () => {
    expect(mailSubject({ kind: 'note', text: '   ' })).toBe('Трекер стрельбы · Заметка')
  })
})

describe('тело письма', () => {
  it('под текстом идёт блок с обстановкой', () => {
    const body = mailBody({ kind: 'bug', text: 'Промах засчитался девяткой', context: 'Экран ввода' }, env)
    expect(body).toContain('Промах засчитался девяткой')
    expect(body).toContain('Тип: Ошибка')
    expect(body).toContain('Где: Экран ввода')
    expect(body).toContain('Версия: 1.0.0')
    expect(body).toContain('Chrome 141')
  })

  it('пустое поле «где» строку не добавляет', () => {
    const body = mailBody({ kind: 'note', text: 'что-то', context: '   ' }, env)
    expect(body).not.toContain('Где:')
  })

  it('длинный текст режется, но служебный хвост остаётся целым', () => {
    const body = mailBody({ kind: 'bug', text: 'я'.repeat(5000), context: '' }, env)
    expect(body.length).toBeLessThanOrEqual(MAILTO_LIMIT)
    expect(body).toContain('Версия: 1.0.0')
    expect(body).toContain('…')
  })
})

describe('ссылка mailto', () => {
  it('адресована на нужный ящик', () => {
    const url = feedbackMailto({ kind: 'idea', text: 'привет', context: '' }, env)
    expect(url.startsWith(`mailto:${FEEDBACK_EMAIL}?`)).toBe(true)
  })

  it('переводы строк и кириллица закодированы', () => {
    const url = feedbackMailto({ kind: 'bug', text: 'первая\nвторая', context: '' }, env)
    expect(url).toContain('%0A')
    expect(url).not.toContain('первая')
    expect(decodeURIComponent(url.split('&body=')[1])).toContain('первая\nвторая')
  })

  it('адрес можно переопределить', () => {
    const url = feedbackMailto({ kind: 'note', text: 'x', context: '' }, env, 'other@example.com')
    expect(url.startsWith('mailto:other@example.com?')).toBe(true)
  })
})
