import type { DomainError, Habit, HabitStore } from './types'
import {
  computeStreak,
  createId,
  isFutureDate,
  namesEqual,
  normalizeName,
  todayKey,
} from './types'

export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError }

function withActive(store: HabitStore, habits: Habit[], preferredId?: string | null): HabitStore {
  const id =
    (preferredId && habits.some((h) => h.id === preferredId) && preferredId) ||
    (store.activeId && habits.some((h) => h.id === store.activeId) && store.activeId) ||
    habits[0]?.id ||
    null
  return { version: 1, habits, activeId: id }
}

export function getActiveHabit(store: HabitStore): Habit | null {
  if (!store.activeId) return null
  return store.habits.find((h) => h.id === store.activeId) ?? null
}

export function addHabit(store: HabitStore, name: string): Result<HabitStore> {
  const normalized = normalizeName(name)
  if (!normalized) {
    return { ok: false, error: { code: 'empty_name', message: 'Введите название привычки.' } }
  }
  if (store.habits.some((h) => namesEqual(h.name, normalized))) {
    return {
      ok: false,
      error: { code: 'duplicate_name', message: 'Привычка с таким именем уже есть.' },
    }
  }
  const habit: Habit = { id: createId(), name: normalized, completedDates: [] }
  const habits = [...store.habits, habit]
  return { ok: true, value: withActive(store, habits, habit.id) }
}

export function renameHabit(store: HabitStore, id: string, name: string): Result<HabitStore> {
  const normalized = normalizeName(name)
  if (!normalized) {
    return { ok: false, error: { code: 'empty_name', message: 'Введите название привычки.' } }
  }
  if (store.habits.some((h) => h.id !== id && namesEqual(h.name, normalized))) {
    return {
      ok: false,
      error: { code: 'duplicate_name', message: 'Привычка с таким именем уже есть.' },
    }
  }
  if (!store.habits.some((h) => h.id === id)) {
    return { ok: false, error: { code: 'not_found', message: 'Привычка не найдена.' } }
  }
  const habits = store.habits.map((h) => (h.id === id ? { ...h, name: normalized } : h))
  return { ok: true, value: withActive(store, habits, id) }
}

export function deleteHabit(store: HabitStore, id: string): Result<HabitStore> {
  const index = store.habits.findIndex((h) => h.id === id)
  if (index < 0) {
    return { ok: false, error: { code: 'not_found', message: 'Привычка не найдена.' } }
  }
  const habits = store.habits.filter((h) => h.id !== id)
  const neighbor = store.habits[index + 1] ?? store.habits[index - 1] ?? null
  return { ok: true, value: withActive(store, habits, neighbor?.id ?? null) }
}

export function setActive(store: HabitStore, id: string): Result<HabitStore> {
  if (!store.habits.some((h) => h.id === id)) {
    return { ok: false, error: { code: 'not_found', message: 'Привычка не найдена.' } }
  }
  return { ok: true, value: { ...store, activeId: id } }
}

export function shiftActive(store: HabitStore, delta: -1 | 1): HabitStore {
  if (store.habits.length === 0) return store
  const current = Math.max(
    0,
    store.habits.findIndex((h) => h.id === store.activeId),
  )
  const next = (current + delta + store.habits.length) % store.habits.length
  return { ...store, activeId: store.habits[next].id }
}

/**
 * Переключает отметку за дату. За один день одна запись.
 * Будущие даты запрещены.
 */
export function toggleCompletion(
  store: HabitStore,
  id: string,
  dateKey = todayKey(),
): Result<HabitStore> {
  if (isFutureDate(dateKey)) {
    return {
      ok: false,
      error: { code: 'future_date', message: 'Нельзя отметить день в будущем.' },
    }
  }
  const habit = store.habits.find((h) => h.id === id)
  if (!habit) {
    return { ok: false, error: { code: 'not_found', message: 'Привычка не найдена.' } }
  }
  const has = habit.completedDates.includes(dateKey)
  const completedDates = has
    ? habit.completedDates.filter((d) => d !== dateKey)
    : [...habit.completedDates, dateKey]
  const habits = store.habits.map((h) => (h.id === id ? { ...h, completedDates } : h))
  return { ok: true, value: withActive(store, habits, id) }
}

export function streakFor(habit: Habit): number {
  return computeStreak(habit.completedDates)
}

export function isDoneToday(habit: Habit, now = new Date()): boolean {
  return habit.completedDates.includes(todayKey(now))
}
