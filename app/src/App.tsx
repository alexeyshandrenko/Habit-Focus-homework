import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import {
  addHabit,
  deleteHabit,
  getActiveHabit,
  isDoneToday,
  renameHabit,
  setActive,
  shiftActive,
  streakFor,
  toggleCompletion,
} from './domain'
import { emptyStore, loadStore, makeDemoStore, saveStore } from './storage'
import type { HabitStore } from './types'
import './App.css'

type Notice = { tone: 'error' | 'info'; text: string } | null

function daysWord(n: number): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return 'дней'
  if (last === 1) return 'день'
  if (last >= 2 && last <= 4) return 'дня'
  return 'дней'
}

export default function App() {
  const [store, setStore] = useState<HabitStore>(() => emptyStore())
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [draftName, setDraftName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [streakPulse, setStreakPulse] = useState(false)
  const nameFieldId = useId()
  const selectId = useId()

  useEffect(() => {
    const { store: loaded, reset } = loadStore()
    const wantDemo =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === '1' &&
      loaded.habits.length === 0

    const next = wantDemo ? makeDemoStore() : loaded
    setStore(next)
    setReady(true)
    if (reset) {
      setNotice({
        tone: 'info',
        text: 'Данные в хранилище были повреждены — список сброшен.',
      })
      saveStore(next)
    } else if (wantDemo) {
      saveStore(next)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    saveStore(store)
  }, [store, ready])

  const active = getActiveHabit(store)
  const isEmpty = store.habits.length === 0
  const activeIndex = active ? store.habits.findIndex((h) => h.id === active.id) : -1
  const doneToday = active ? isDoneToday(active) : false
  const streak = active ? streakFor(active) : 0

  function applyResult(
    result: { ok: true; value: HabitStore } | { ok: false; error: { message: string } },
    onOk?: () => void,
  ) {
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error.message })
      return
    }
    setNotice(null)
    setStore(result.value)
    onOk?.()
  }

  function onSubmitName(e: FormEvent) {
    e.preventDefault()
    if (renaming && active) {
      applyResult(renameHabit(store, active.id, draftName), () => {
        setRenaming(false)
        setDraftName('')
      })
      return
    }
    applyResult(addHabit(store, draftName), () => setDraftName(''))
  }

  function onToggleToday() {
    if (!active) return
    applyResult(toggleCompletion(store, active.id), () => {
      setStreakPulse(true)
      window.setTimeout(() => setStreakPulse(false), 450)
    })
  }

  function onDelete() {
    if (!active) return
    const name = active.name
    applyResult(deleteHabit(store, active.id), () => {
      setRenaming(false)
      setDraftName('')
      setNotice({ tone: 'info', text: `Удалено: ${name}` })
    })
  }

  function onDemo() {
    const demo = makeDemoStore()
    setStore(demo)
    setNotice({ tone: 'info', text: 'Добавлено 5 примеров привычек.' })
    setRenaming(false)
    setDraftName('')
  }

  if (!ready) {
    return <div className="page page--loading">Загрузка…</div>
  }

  return (
    <>
      <div className="atmosphere" aria-hidden="true">
        <span className="atmosphere__orb atmosphere__orb--a" />
        <span className="atmosphere__orb atmosphere__orb--b" />
      </div>

      <div className="page">
        <header className="hero">
          <p className="brand">Habit Focus</p>
          <h1 className="title">Одна привычка за раз</h1>
          <p className="lede">
            Отметьте сегодняшнее выполнение и держите серию дней — без аккаунтов и лишнего шума.
          </p>
        </header>

        {notice && (
          <div
            className={`notice notice--${notice.tone}`}
            role={notice.tone === 'error' ? 'alert' : 'status'}
          >
            {notice.text}
            <button type="button" className="notice__close" onClick={() => setNotice(null)}>
              Закрыть
            </button>
          </div>
        )}

        {isEmpty ? (
          <section className="panel panel--empty" aria-labelledby="empty-heading">
            <h2 id="empty-heading">Пока пусто</h2>
            <p>
              Добавьте первую привычку или загрузите примеры, чтобы посмотреть, как это работает.
            </p>
            <form className="row" onSubmit={onSubmitName}>
              <label className="sr-only" htmlFor={nameFieldId}>
                Название привычки
              </label>
              <input
                id={nameFieldId}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Например: Зарядка"
                autoComplete="off"
              />
              <button type="submit" className="btn btn--primary">
                Добавить
              </button>
            </form>
            <button type="button" className="btn btn--ghost" onClick={onDemo}>
              Заполнить пример
            </button>
          </section>
        ) : (
          <section className="panel" aria-labelledby="habit-heading">
            <div className="nav">
              <button
                type="button"
                className="btn btn--icon"
                onClick={() => setStore(shiftActive(store, -1))}
                aria-label="Предыдущая привычка"
              >
                ←
              </button>
              <label className="nav__select" htmlFor={selectId}>
                <span className="sr-only">Выбрать привычку</span>
                <select
                  id={selectId}
                  value={active?.id ?? ''}
                  onChange={(e) => applyResult(setActive(store, e.target.value))}
                >
                  {store.habits.map((h, i) => (
                    <option key={h.id} value={h.id}>
                      {i + 1}. {h.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn--icon"
                onClick={() => setStore(shiftActive(store, 1))}
                aria-label="Следующая привычка"
              >
                →
              </button>
            </div>

            <p className="meta">
              {activeIndex + 1} из {store.habits.length}
            </p>

            <div className="habit-stage">
              <h2 id="habit-heading" className="habit-name" key={active?.id}>
                {active?.name}
              </h2>

              <div
                className={`streak${streakPulse ? ' is-live' : ''}`}
                aria-live="polite"
              >
                Серия <strong>{streak}</strong> {daysWord(streak)}
              </div>
            </div>

            <label className={`check${doneToday ? ' is-done' : ''}`}>
              <input
                type="checkbox"
                checked={doneToday}
                onChange={onToggleToday}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onToggleToday()
                  }
                }}
              />
              <span>Сделано сегодня</span>
            </label>

            <div className="actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setRenaming(true)
                  setDraftName(active?.name ?? '')
                  setNotice(null)
                }}
              >
                Переименовать
              </button>
              <button type="button" className="btn btn--danger" onClick={onDelete}>
                Удалить
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setRenaming(false)
                  setDraftName('')
                }}
              >
                Новая…
              </button>
            </div>

            <form className="row" onSubmit={onSubmitName}>
              <label className="sr-only" htmlFor={nameFieldId}>
                {renaming ? 'Новое название' : 'Название новой привычки'}
              </label>
              <input
                id={nameFieldId}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={renaming ? 'Новое название' : 'Добавить ещё привычку'}
                autoComplete="off"
              />
              <button type="submit" className="btn btn--primary">
                {renaming ? 'Сохранить' : 'Добавить'}
              </button>
            </form>
          </section>
        )}

        <footer className="footer">Данные только в этом браузере · Habit Focus</footer>
      </div>
    </>
  )
}
