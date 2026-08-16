# Independent audit — Habit Focus

**Date:** 2026-08-16  
**Auditor stance:** no prior conversation; SPEC + AGENTS Part II are the contract; code under `app/src/` is the product under review.  
**`docs/naive/`:** contrast only (single-file list tracker without focus/streak/dup/future/safe parse) — not scored as the deliverable.

---

## Summary

The React app implements the main SPEC scenarios: empty / data / error messaging, one-habit focus with prev/next + select, today toggle, streak, CRUD, duplicate-name checks, future-date rejection in the domain layer, demo of 5, and corrupt-JSON reset. Several concrete gaps remain: storage validation accepts semantically broken but type-shaped payloads; native checkbox does not wire Enter as required by acceptance criteria; `?demo=1` bypasses the “demo only via button” assumption; calendar-invalid `YYYY-MM-DD` strings can slip past `isFutureDate`. Keyboard traversal and live 360/1440 overflow were not re-verified in a browser in this audit (screenshots reviewed statically).

## Method (what you read/checked)

- Read `SPEC.md` (scenarios, states, assumptions, acceptance criteria, out-of-scope).
- Read `AGENTS.md` Part II (stack, states contract, constraints, verification bar).
- Read product code: `app/src/App.tsx`, `domain.ts`, `storage.ts`, `types.ts`, `main.tsx`; CSS `App.css` / `index.css` as needed for a11y focus and layout.
- Briefly noted `docs/naive/README.md` for contrast only.
- Ran `npm run smoke` (`app/scripts/smoke-domain.mjs`) — passes, but under-tests vs production `isFutureDate`.
- Replicated storage `isStore` / streak / future-date edge cases in Node (soft-corrupt payload accepted; invalid calendar dates not treated as future).
- Reviewed static screenshots `docs/screenshots/after/{360,1440}.png` (360×800, 1440×900). Did **not** run `npm run dev`, Tab/Enter in a browser, or inject `localStorage` in a live page — those items marked **unverified**.

## Findings

1. **Severity:** major  
   **Spec reference:** Assumptions «Битый/чужой JSON → сброс»; States «Ошибка» / scenario 9; uniqueness & `YYYY-MM-DD` date model  
   **Evidence:** `storage.ts` `isHabit` / `isStore` only check `typeof` / `Array.isArray` / `version === 1`. Node probe: payload with empty `name`, non-date strings, future dates, duplicate `id`s, case-duplicate names, and duplicate day entries still returns `isStore === true` and would load without reset.  
   **Why it matters:** “Чужой” data that looks structurally versioned can skip the required reset path, surface blank habit titles, break uniqueness invariants, and leave junk in `completedDates` while the UI still claims a healthy store.  
   **Suggested fix direction:** Tighten load validation (non-empty name, unique ids/names, `YYYY-MM-DD` + real calendar dates, dedupe days); fail → empty + reset notice.

2. **Severity:** major  
   **Spec reference:** Acceptance «Клавиатура: … Enter/Space активируют галочку и основные кнопки»  
   **Evidence:** `App.tsx` uses native `<input type="checkbox">` with `onChange` only; no `onKeyDown`/button-role handler for Enter. Platform behavior: Space toggles a checkbox; Enter typically does not.  
   **Why it matters:** Explicit acceptance criterion is unmet for keyboard users who expect Enter on the primary “today” control (buttons are fine as native `<button>`).  
   **Suggested fix direction:** Handle Enter on the check control (or use a `button`/`role="checkbox"` with full keyboard map). **Live Enter behavior: unverified** in browser this audit; gap is from code + HTML semantics.

3. **Severity:** minor  
   **Spec reference:** Assumptions «Демо: ровно 5 привычек создаёт **только** действие „Заполнить пример“»  
   **Evidence:** `App.tsx` (~L41–57): `?demo=1` with empty store calls `makeDemoStore()` and `saveStore`, same factory as the button.  
   **Why it matters:** Extra auto-seed path contradicts the written “только” rule (empty remains reachable if the param is unused, but the assumption is still violated).  
   **Suggested fix direction:** Remove URL auto-demo from product UI, or document it as a non-SPEC test hook outside the shipped contract.

4. **Severity:** minor  
   **Spec reference:** Scenario 8 / acceptance «Нельзя отметить дату в будущем»; Assumptions date format `YYYY-MM-DD`  
   **Evidence:** `types.ts` `parseDateKey` builds `Date` without checking that Y-M-D round-trips (e.g. `2024-02-31` → Mar 2; `2024-13-01` rolls forward). `isFutureDate` then compares the **original string** to today; many invalid keys are **not** `> today`, so `toggleCompletion` accepts them.  
   **Why it matters:** Non-UI callers (and any future UI) can write non-dates into `completedDates`, contradicting the date contract even though the happy path uses `todayKey()` only.  
   **Suggested fix direction:** Reject keys unless `todayKey(parsed) === key` (and keep rejecting true futures).

5. **Severity:** minor  
   **Spec reference:** States «Ошибка» / no white-screen crash; AGENTS verification «консоль без ошибок»  
   **Evidence:** `storage.ts` `saveStore` — bare `localStorage.setItem` with no try/catch; called from `useEffect` on every store change (`App.tsx`).  
   **Why it matters:** Quota / disabled storage throws inside React effects and can take down the UI after an otherwise successful domain update.  
   **Suggested fix direction:** Catch write failures and surface an error notice without crashing.

6. **Severity:** minor  
   **Spec reference:** Acceptance «Ширины 360 и 1440: без горизонтального скролла, элементы не наезжают»  
   **Evidence:** CSS uses `width: min(760px, 100%)`, `min-width: 0` on select/input, `overflow-wrap: anywhere` on habit name, action `flex-wrap`. Static `after/360.png` shows a dense action row (third control easy to crowd); no clear full-page horizontal scroll in the crop. Live resize/scroll metrics **unverified**.  
   **Why it matters:** Crowding at 360 can look like overlap/cutoff even when wrap exists; acceptance needs interactive proof, not only screenshots.  
   **Suggested fix direction:** Re-check 360 with long names + three actions; force actions to full-width stack earlier if needed.

7. **Severity:** nit  
   **Spec reference:** Acceptance keyboard (Tab order, visible focus) — AGENTS checklist items 7–8  
   **Evidence:** `:focus-visible` outline exists in `index.css`; interactive elements are mostly native controls with labels/`aria-label`. Full Tab order, focus ring visibility across browsers, and console cleanliness on the main scenario were **not** exercised in a live session this audit (**unverified**).  
   **Why it matters:** Code looks prepared, but SPEC bars “готово” without demonstrated keyboard/console checks.  
   **Suggested fix direction:** Manual pass: Tab through empty + data states; confirm focus ring; watch console.

8. **Severity:** nit  
   **Spec reference:** Process / AGENTS “проверка вместо слова готово” (smoke as evidence)  
   **Evidence:** `smoke-domain.mjs` implements `isFutureDate` as plain string `>` and a simplified streak walker — not the same as `types.ts` (no invalid-key → true branch, no `parseDateKey`).  
   **Why it matters:** Green smoke can miss production edge cases (invalid keys, calendar rollover) and give false confidence.  
   **Suggested fix direction:** Point smoke at shared logic or mirror production rules exactly.

## What looks solid

- **Empty / data / error UX:** Empty panel with «Добавить» + «Заполнить пример»; data panel with one focused habit, streak, checkbox, CRUD; duplicate and domain errors via `role="alert"`; corrupt parse → empty store + info notice (`App.tsx` + `loadStore`).
- **Navigation contract (AGENTS Part II):** Prev/next buttons + accessible `<select>` with sr-only label.
- **Duplicate names:** `normalizeName` (trim + collapse spaces) + `namesEqual` with `toLocaleLowerCase('ru')` on add/rename; store unchanged on failure.
- **Today toggle / one row per day:** `toggleCompletion` add-or-remove single `dateKey`; UI binds only today.
- **Future rejection (valid keys):** Domain returns clear `future_date` message; matches scenario 8’s “even if not via UI” for normal `YYYY-MM-DD` futures.
- **Streak rule:** `computeStreak` matches SPEC (from today if marked, else yesterday; gap breaks) — checked for empty / today / yesterday / gap chains in Node.
- **Delete focus:** Moves to next neighbor, else previous, else empty (`deleteHabit`).
- **Demo count:** `DEMO_HABITS` length 5; button only on empty screen.
- **Stack constraints:** React 19 + Vite + TS + plain CSS; local fonts (no CDN); `localStorage` key `habit-tracker:v1` with `version: 1`; no backend/router/UI kit in `package.json`.
- **Out-of-scope respected:** No accounts, calendar of arbitrary past days, charts, PWA, etc. in `app/src`.

## Verdict: pass-with-fixes

**Why:** Core product behavior aligns with SPEC for the primary user journeys and the three UI states; domain streak, dup-name, and (valid) future-date rules are coherent. It is not a clean **pass** because storage accepts soft-corrupt data that should reset or sanitize, keyboard Enter-on-checkbox is not implemented against an explicit acceptance line, and a few SPEC assumptions (`только` demo, strict date keys) are bent. It is not a **fail**: required features are present, corrupt JSON that fails `JSON.parse` / shape checks resets safely, and no blocker-level streak or empty-state hole was found in code review.

**Still unverified without a browser this audit:** live Tab/Enter/Space, console on main path, and measured absence of horizontal scroll at 360/1440 (screenshots only).

---

## Remediation (session 4, 2026-08-16)

Addressed **major #1** and **major #2** after independent audit:

1. **Storage validation** (`storage.ts` + `types.ts`): reject empty/unnormalized names, duplicate ids/names, invalid or duplicate date keys, and future dates in `completedDates`; invalid calendar keys via round-trip in `parseDateKey`. Soft-corrupt payloads now reset like broken JSON.
2. **Enter on checkbox** (`App.tsx`): `onKeyDown` toggles today on Enter (Space remains native).

Smoke updated: `npm run smoke` covers soft-corrupt store rejection and invalid `2024-02-31`.

Minor items (#3 `?demo=1`, #5 `setItem` try/catch) left as known deviations.
