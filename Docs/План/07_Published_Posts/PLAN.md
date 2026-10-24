# 07 — Published Posts

**Route:** `/content/published`  ·  **ТЗ:** §6.6 (экран — раздел CONTENT в сайдбаре)  ·  **Макет:** `mockup.png`

## Назначение
Трекинг производительности и вовлечённости опубликованного контента по всем платформам. Таблица + правый drawer деталей поста.

## Блоки макета
1. **Top bar**: `Sync Engagement` (primary) · `Export` · справа Columns · per-page select.
2. **Левая панель фильтров**: Search · Platform · Date Range · Status · Tags · Language · Min Engagement (Min–Max) · Sort By (Published At Newest) · `Apply Filters` · `Save as View`.
3. **Таблица**: чекбокс · Post (превью-картинка + заголовок + ID + Published бейдж) · Platform (иконка + тип: Telegram Channel / LinkedIn Post / X Thread / Email) · Published At · Engagement (❤ 👁 🔁 💬 числа) · Tags (+N) · Language · Actions (👁 ⋮).
4. **Правый drawer (Post Details)**: Published бейдж · заголовок · платформа + дата UTC + внешняя ссылка · Engagement (Last synced) с Likes/Reposts/Views/Comments · Content Preview (Show more) · Tags · Related Draft (View Draft) · Actions: `Sync Engagement` · `View on Platform` · `Delete Record`.
5. **Пагинация**: Showing 1–20 of N.

## API (ТЗ §6.6)
- `GET /content/published?platform=&status=&tags=&min_engagement=` — список с фильтрами.
- `GET /content/published/{id}` — деталь.
- `POST /content/published/{id}/sync` — синхр. метрик вовлечённости с платформы.
- Related Draft → `GET /content/drafts/{id}`.

## Состояние кода
Страницы нет — **создать** `content/published/page.tsx`. Паттерн таблица+фильтры+drawer как Raw Posts.

## Acceptance
- Фильтры (платформа/статус/min engagement/теги) сужают выборку.
- Sync Engagement обновляет метрики и «Last synced».
- Drawer показывает метрики + ссылку «View on Platform» + Related Draft.
- Export выгружает текущую выборку.
