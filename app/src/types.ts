export type Habit = {
  id: string
  name: string
  /** Даты выполнения в формате YYYY-MM-DD (локальная дата). */
  completedDates: string[]
}

export type HabitStore = {
  version: 1
  habits: Habit[]
  activeId: string | null
}

export type DomainError =
  | { code: 'duplicate_name'; message: string }
  | { code: 'future_date'; message: string }
  | { code: 'empty_name'; message: string }
  | { code: 'not_found'; message: string }

export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function namesEqual(a: string, b: string): boolean {
  return normalizeName(a).toLocaleLowerCase('ru') === normalizeName(b).toLocaleLowerCase('ru')
}

export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(date.getTime())) return null
  // Отсекаем календарный мусор вроде 2024-02-31 (иначе Date «переносит» день).
  if (todayKey(date) !== key) return null
  return date
}

export function isValidDateKey(key: string): boolean {
  return parseDateKey(key) !== null
}

export function isFutureDate(dateKey: string, now = new Date()): boolean {
  if (!isValidDateKey(dateKey)) return true
  return dateKey > todayKey(now)
}

/** Streak: подряд от сегодня (если отмечено) или от вчера назад. */
export function computeStreak(completedDates: string[], now = new Date()): number {
  const set = new Set(completedDates)
  let cursor = todayKey(now)
  if (!set.has(cursor)) {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    cursor = todayKey(y)
    if (!set.has(cursor)) return 0
  }
  let streak = 0
  while (set.has(cursor)) {
    streak += 1
    const d = parseDateKey(cursor)
    if (!d) break
    d.setDate(d.getDate() - 1)
    cursor = todayKey(d)
  }
  return streak
}

export function createId(): string {
  return crypto.randomUUID()
}

export const DEMO_HABITS = [
  'Зарядка 10 минут',
  'Стакан воды утром',
  'Чтение 20 страниц',
  'Прогулка',
  'Без телефона перед сном',
] as const
