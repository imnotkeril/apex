# 08 — Sources

**Route:** `/content/sources`  ·  **ТЗ:** §8.9 (Sources tab) + §6.1  ·  **Макет:** `mockup.png`

## Назначение
Управление источниками контента и мониторинг здоровья парсинга. Таблица + правый drawer деталей источника.

## Блоки макета
1. **Tabs по типу**: All Sources · Telegram · Twitter/X · RSS · YouTube · Other (с counts). Справа `+ Add Source`.
2. **Stats row**: Total Sources · Active · With Errors · Disabled · Success Rate (7d) спарклайн · Last Parsed.
3. **Таблица**: Source (иконка + имя + @handle/url) · Type · Status (Active/Error) · Last Parsed · Last Post · Success Rate (7d) прогресс-бар · Error Count · Actions (▶ run · ✏ edit · ⋮).
4. **Правый drawer (Source Details)**: иконка + имя + статус + toggle вкл/выкл · Description + Language · Stats (7d): Posts Parsed / Success Rate / Errors / Duplicates / Filtered Out / Last Parsed · Recent Activity (parse-события с временем) · Actions: `Run Parser Now` · `Edit Source` · `Disable Source`.
5. **Пагинация**: Showing 1–10 of N.
6. **Add Source modal**: по типу источника, с инструкциями подключения (Telegram session, RSS url, YouTube channel, IMAP, web).

## API (ТЗ §6.1)
- `GET /content/sources` — список.
- `POST /content/sources` — добавить.
- `PUT /content/sources/{id}` — редактировать.
- `DELETE /content/sources/{id}`.
- `POST /content/sources/{id}/parse` — Run Parser Now.
- `POST /content/sources/parse-all`.
- `GET /content/sources/{id}/status` — last parse status / error count (drawer).

## Состояние кода
Есть заглушка `content/sources/page.tsx`. Реализовать tabs/stats/таблицу/drawer + Add Source modal по типам.

## Acceptance
- Tabs фильтруют по типу; stats отражают агрегаты.
- Run Parser Now триггерит парс и обновляет Last Parsed / Recent Activity.
- Toggle вкл/выкл и Disable меняют статус.
- Add Source создаёт источник с валидацией по типу.
