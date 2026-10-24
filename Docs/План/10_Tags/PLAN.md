# 10 — Tags

**Route:** `/content/tags`  ·  **ТЗ:** §8.9 (Tags tab) + §6.10  ·  **Макет:** `mockup.png`

## Назначение
Организация и управление тегами по всему контенту. Таблица с группировкой по категориям + правый drawer аналитики тега.

## Блоки макета
1. **Tabs**: All Tags · Topic Tags · Content Tags · Platform Tags · Status Tags. Справа `+ Create Tag`.
2. **Stats row**: Total Tags · Active · Archived · Unused · Usage (30d) спарклайн.
3. **Top bar**: Search · фильтры All Categories / All Languages · Sort by (Usage High→Low).
4. **Таблица**: Tag (имя + описание) · Type (Topic/Content/…) · Category (Macro/Markets/Format/…) · Usage (30d) · Trend (мини-график) · First Used · Last Used · Languages (+N) · Status · Actions (👁 ✏ ⋮).
5. **Правый drawer (Tag Details)**: # имя + статус + тип · Description · Stats (30d): Posts / Mentions / Potential Reach / Trend % · Usage Over Time (бар-чарт) · Languages · Related Tags · Actions: `Edit Tag` · `Merge Tag` · `Archive Tag`.
6. **System tags** — иконка-замок, неудаляемы.

## API (ТЗ §6.10)
- `GET /content/tags`.
- `POST /content/tags`.
- `PUT /content/tags/{id}`.
- `DELETE /content/tags/{id}` — только не-системные.
- Merge — слияние тегов (бэкенд-операция; если нет в ТЗ — отдельная задача backend).

## Состояние кода
Страницы нет — **создать** `content/tags/page.tsx`. Таблица + drawer с usage-графиками.

## Acceptance
- Tabs/фильтры/сортировка по usage работают.
- System-теги показывают замок и защищены от удаления.
- Drawer рисует Usage Over Time + Related Tags.
- Create/Edit/Merge/Archive отрабатывают.
