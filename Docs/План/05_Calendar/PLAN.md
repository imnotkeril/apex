# 05 — Content Calendar

**Route:** `/content/calendar`  ·  **ТЗ:** §8.6  ·  **Макет:** `mockup.png`

## Назначение
Планирование и управление контентом по платформам. Month/Week/List + правый drawer деталей запланированного поста.

## Блоки макета
1. **Top bar**: переключатель Month / Week / List · навигация `< May 2025 >` + `Today` · фильтры All Platforms / All Languages / All Statuses · `+ Schedule Content`.
2. **Сетка месяца** (MON–SUN): в днях — пилюли постов: иконка платформы + время + заголовок + платформа·язык. Цвет фона пилюли = статус. Выбранный день подсвечен.
3. **Легенда снизу**: платформы (Telegram/LinkedIn/X/Email/PDF/Internal) + статусы (Scheduled/Publishing/Published/Failed/Cancelled).
4. **Правый drawer (деталь поста)**: статус-бейдж · платформа + дата/время UTC · Languages · ссылка на Draft · Preview (Show more) · Platforms & Languages · Status · Created/By · Actions: `Edit Schedule` · `Reschedule` · `Duplicate` · `Cancel Scheduled Post`.

## Поведение
- **Без drag-and-drop в v1** — перенос через drawer (Reschedule).
- Hover пилюли → tooltip с полным превью. Click → drawer.

## API (ТЗ §6.7)
- `GET /content/calendar?date_from=&date_to=` — запланированные посты за диапазон.
- `PUT /content/calendar/{id}/reschedule` — смена времени.
- `DELETE /content/calendar/{id}` — отмена.
- `+ Schedule Content` → `POST /content/drafts/{id}/publish` с `scheduled_at`.

## Состояние кода
Страницы нет — **создать** `content/calendar/page.tsx`. Календарную сетку можно на собственном grid или lib (react-big-calendar / day-grid), но без DnD.

## Acceptance
- Month/Week/List переключаются; навигация по месяцам + Today.
- Фильтры платформа/язык/статус сужают показ.
- Клик по пилюле открывает drawer; Reschedule меняет дату и обновляет сетку.
- Cancel убирает пост из расписания.
