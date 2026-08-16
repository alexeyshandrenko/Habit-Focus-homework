import type { Habit, HabitStore } from './types'
import {
  createId,
  DEMO_HABITS,
  isValidDateKey,
  namesEqual,
  normalizeName,
  todayKey,
} from './types'

export const STORAGE_KEY = 'habit-tracker:v1'

function isHabit(value: unknown): value is Habit {
  if (!value || typeof value !== 'object') return false
  const h = value as Habit
  if (typeof h.id !== 'string' || h.id.trim() === '') return false
  if (typeof h.name !== 'string') return false
  const name = normalizeName(h.name)
  // Пустое или «грязное» (не нормализованное) имя — чужие/битые данные.
  if (!name || name !== h.name) return false
  if (!Array.isArray(h.completedDates)) return false
  if (!h.completedDates.every((d) => typeof d === 'string' && isValidDateKey(d))) return false
  if (new Set(h.completedDates).size !== h.completedDates.length) return false
  const today = todayKey()
  if (h.completedDates.some((d) => d > today)) return false
  return true
}

/** Строгая проверка склада: иначе loadStore сбрасывает в пустое состояние. */
export function isStore(value: unknown): value is HabitStore {
  if (!value || typeof value !== 'object') return false
  const s = value as HabitStore
  if (s.version !== 1 || !Array.isArray(s.habits)) return false
  if (!(s.activeId === null || typeof s.activeId === 'string')) return false
  if (!s.habits.every(isHabit)) return false

  const ids = s.habits.map((h) => h.id)
  if (new Set(ids).size !== ids.length) return false

  for (let i = 0; i < s.habits.length; i += 1) {
    for (let j = i + 1; j < s.habits.length; j += 1) {
      if (namesEqual(s.habits[i].name, s.habits[j].name)) return false
    }
  }

  return true
}

export function emptyStore(): HabitStore {
  return { version: 1, habits: [], activeId: null }
}

export function loadStore(): { store: HabitStore; reset: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return { store: emptyStore(), reset: false }
    const parsed: unknown = JSON.parse(raw)
    if (!isStore(parsed)) return { store: emptyStore(), reset: true }
    const activeExists = parsed.activeId
      ? parsed.habits.some((h) => h.id === parsed.activeId)
      : false
    return {
      store: {
        ...parsed,
        activeId: activeExists ? parsed.activeId : parsed.habits[0]?.id ?? null,
      },
      reset: false,
    }
  } catch {
    return { store: emptyStore(), reset: true }
  }
}

export function saveStore(store: HabitStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function makeDemoStore(): HabitStore {
  const habits = DEMO_HABITS.map((name) => ({
    id: createId(),
    name: normalizeName(name),
    completedDates: [] as string[],
  }))
  return {
    version: 1,
    habits,
    activeId: habits[0]?.id ?? null,
  }
}
