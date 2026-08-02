import { describe, expect, it } from 'vitest'
import { csvCell, mergeRows, parseBackup, BACKUP_APP } from './backup'

interface Row {
  id: string
  updatedAt: number
  deletedAt: number | null
  value: string
}

const row = (id: string, updatedAt: number, value: string, deletedAt: number | null = null): Row => ({
  id,
  updatedAt,
  value,
  deletedAt,
})

describe('мерж бэкапа по UUID', () => {
  it('новые id добавляются', () => {
    const { rows, stat } = mergeRows([row('a', 1, 'local')], [row('b', 1, 'remote')])
    expect(stat).toEqual({ added: 1, updated: 0, kept: 0 })
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('b')
  })

  it('при совпадении id побеждает более поздний updatedAt', () => {
    const { rows, stat } = mergeRows([row('a', 100, 'старая')], [row('a', 200, 'новая')])
    expect(stat).toEqual({ added: 0, updated: 1, kept: 0 })
    expect(rows[0].value).toBe('новая')
  })

  it('устаревшая запись из файла не затирает свежую локальную', () => {
    const { rows, stat } = mergeRows([row('a', 200, 'свежая')], [row('a', 100, 'старая')])
    expect(stat).toEqual({ added: 0, updated: 0, kept: 1 })
    expect(rows).toHaveLength(0)
  })

  it('ничья по updatedAt остаётся за локальной записью', () => {
    const { rows, stat } = mergeRows([row('a', 50, 'local')], [row('a', 50, 'remote')])
    expect(stat.kept).toBe(1)
    expect(rows).toHaveLength(0)
  })

  it('повторный импорт того же файла ничего не меняет — дублей нет', () => {
    const local = [row('a', 10, 'x'), row('b', 20, 'y')]
    const first = mergeRows(local, local)
    expect(first.rows).toHaveLength(0)
    expect(first.stat.added).toBe(0)
  })

  it('тумбстоун переживает мерж: удаление не воскресает', () => {
    // На телефоне сессию удалили (позже), на десктопе она ещё живая.
    const desktop = [row('a', 100, 'сессия', null)]
    const phone = [row('a', 300, 'сессия', 300)]
    const { rows } = mergeRows(desktop, phone)
    expect(rows[0].deletedAt).toBe(300)
  })

  it('и наоборот: восстановление после удаления тоже едет по времени', () => {
    const withTombstone = [row('a', 300, 'сессия', 300)]
    const revived = [row('a', 400, 'сессия', null)]
    const { rows } = mergeRows(withTombstone, revived)
    expect(rows[0].deletedAt).toBeNull()
  })
})

describe('ячейка CSV', () => {
  it('дробные координаты пишутся с запятой — Excel ждёт именно её', () => {
    expect(csvCell(-12.75)).toBe('-12,75')
    expect(csvCell(0)).toBe('0')
  })

  it('пустая координата остаётся пустой, а не нулём', () => {
    expect(csvCell(null)).toBe('')
  })

  it('текст с точкой с запятой и кавычками экранируется', () => {
    expect(csvCell('Хойт; "тест"')).toBe('"Хойт; ""тест"""')
  })
})

describe('разбор файла бэкапа', () => {
  it('чужой файл отвергается', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'что-то другое', version: 1 }))).toThrow()
  })

  it('файл из будущей версии отвергается', () => {
    expect(() => parseBackup(JSON.stringify({ app: BACKUP_APP, version: 99 }))).toThrow()
  })

  it('пустые коллекции заполняются по умолчанию', () => {
    const b = parseBackup(JSON.stringify({ app: BACKUP_APP, version: 1 }))
    expect(b.shots).toEqual([])
    expect(b.sessions).toEqual([])
    expect(b.settings).toBeNull()
  })
})
