# 02 — Raw Posts

**Route:** `/content/raw-posts`  ·  **ТЗ:** §8.2  ·  **Макет:** `mockup.png`

## Назначение
Весь собранный из источников контент. Таблица full-width + левая панель фильтров.

## Блоки макета
1. **Top bar**: `Parse Now` (primary) · `Parse All Sources` · `Add URL / Video / Text` · справа Auto-parse toggle + `Schedule: Every hour` + `Edit`.
2. **Левая панель фильтров**: Search · Sources (multi) · Status (New/Analyzed/Used с counts + чекбоксы) · Tags (multi) · Date Range · Language · Min Post Length · Content Type Tag · `Apply Filters` · `Save as View`.
3. **Bulk bar** (при выборе строк): `N selected` · `Create Draft from Selected` · `Re-analyze` · `Edit Tags` · `Mark as Used` · `Delete`.
4. **Таблица**: чекбокс · Date · Source (иконка платформы + имя) · Summary · Tags (+N) · Status (Analyzed/New/Failed бейдж + «5m ago») · Used In (— / N drafts) · Language · Actions (👁 ✏ ⋮). Для Failed-строк — строка ошибки + `Retry`.
5. **Пагинация**: Show 25 per page · номера страниц.

## API (ТЗ §6.2 / §6.5 / §6.1)
- `GET /content/raw-posts?status=&tags=&date_from=&source_id=&limit=` — список с фильтрами.
- `GET /content/raw-posts/{id}` — полный текст (модалка View Full Text).
- `PATCH /content/raw-posts/{id}` — edit tags/summary.
- `DELETE /content/raw-posts/{id}`.
- `POST /content/sources/{id}/parse` · `/sources/parse-all` — Parse Now / Parse All.
- `POST /content/custom-input/url|youtube|text` (§6.5) — Add URL / Video / Text.
- Bulk Create Draft → `POST /content/drafts` с `source_post_ids`.

## Состояние кода
Есть заглушка `content/raw-posts/page.tsx`. Реализовать фильтры (URL-state), таблицу, bulk-выбор, модалки View/Edit Tags, Add-input.

## Acceptance
- Фильтры меняют выборку и отражаются в URL.
- Bulk «Create Draft from Selected» переносит выбранные посты в Create Draft.
- Parse Now/All триггерят Celery-парсинг и обновляют статусы.
- Failed-пост показывает ошибку + рабочий Retry.
