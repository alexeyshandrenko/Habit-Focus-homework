/**
 * Смоук доменных правил + строгой валидации склада (аудит #1).
 * Запуск: node scripts/smoke-domain.mjs
 */
function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(date.getTime())) return null
  if (todayKey(date) !== key) return null
  return date
}

function isValidDateKey(key) {
  return parseDateKey(key) !== null
}

function isFutureDate(dateKey, now = new Date()) {
  if (!isValidDateKey(dateKey)) return true
  return dateKey > todayKey(now)
}

function namesEqual(a, b) {
  const n = (s) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru')
  return n(a) === n(b)
}

function computeStreak(completedDates, now = new Date()) {
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

function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ')
}

function isHabit(value) {
  if (!value || typeof value !== 'object') return false
  if (typeof value.id !== 'string' || value.id.trim() === '') return false
  if (typeof value.name !== 'string') return false
  const name = normalizeName(value.name)
  if (!name || name !== value.name) return false
  if (!Array.isArray(value.completedDates)) return false
  if (!value.completedDates.every((d) => typeof d === 'string' && isValidDateKey(d))) return false
  if (new Set(value.completedDates).size !== value.completedDates.length) return false
  const today = todayKey()
  if (value.completedDates.some((d) => d > today)) return false
  return true
}

function isStore(value) {
  if (!value || typeof value !== 'object') return false
  if (value.version !== 1 || !Array.isArray(value.habits)) return false
  if (!(value.activeId === null || typeof value.activeId === 'string')) return false
  if (!value.habits.every(isHabit)) return false
  const ids = value.habits.map((h) => h.id)
  if (new Set(ids).size !== ids.length) return false
  for (let i = 0; i < value.habits.length; i += 1) {
    for (let j = i + 1; j < value.habits.length; j += 1) {
      if (namesEqual(value.habits[i].name, value.habits[j].name)) return false
    }
  }
  return true
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const today = todayKey()
const t = new Date()
t.setDate(t.getDate() + 1)
const tomorrow = todayKey(t)

assert(!isFutureDate(today), 'today not future')
assert(isFutureDate(tomorrow), 'tomorrow is future')
assert(isFutureDate('2024-02-31'), 'invalid calendar is rejected as future/bad')
assert(!isValidDateKey('2024-02-31'), 'feb 31 invalid')
assert(namesEqual('  Зарядка ', 'зарядка'), 'dup names')
assert(computeStreak([today]) === 1, 'streak 1')

assert(
  isStore({
    version: 1,
    activeId: 'a',
    habits: [{ id: 'a', name: 'Зарядка', completedDates: [today] }],
  }),
  'valid store ok',
)

assert(
  !isStore({
    version: 1,
    activeId: 'a',
    habits: [{ id: 'a', name: '', completedDates: [] }],
  }),
  'empty name rejected',
)

assert(
  !isStore({
    version: 1,
    activeId: 'a',
    habits: [{ id: 'a', name: '  Зарядка', completedDates: [] }],
  }),
  'unnormalized name rejected',
)

assert(
  !isStore({
    version: 1,
    activeId: 'a',
    habits: [
      { id: 'a', name: 'A', completedDates: [] },
      { id: 'b', name: 'a', completedDates: [] },
    ],
  }),
  'duplicate names rejected',
)

assert(
  !isStore({
    version: 1,
    activeId: 'a',
    habits: [{ id: 'a', name: 'A', completedDates: ['2024-02-31'] }],
  }),
  'bad dates rejected',
)

assert(
  !isStore({
    version: 1,
    activeId: 'a',
    habits: [{ id: 'a', name: 'A', completedDates: [tomorrow] }],
  }),
  'future dates in store rejected',
)

console.log('smoke-domain: OK')
console.log(JSON.stringify({ today, tomorrow }))
