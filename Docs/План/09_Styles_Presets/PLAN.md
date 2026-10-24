# 09 — Styles & Presets

**Route:** `/content/styles`  ·  **ТЗ:** §8.8 + §6.9  ·  **Макет:** `mockup.png`

## Назначение
Стиль-пресеты и правила форматирования для AI-генерации. Список + правый drawer + страница Edit Style.

## Блоки макета
1. **Tabs**: Style Presets · Format Templates · Brand Voice · Custom Instructions.
2. **Stats row**: Total Presets · Active · Archived · Default · Last Updated.
3. **Top bar**: Search · фильтры All Statuses / All Languages · Sort by · `+ Create New Preset`.
4. **Таблица**: Preset (иконка + имя + slug) · Description (+теги) · Default (звезда) · Language · Used In Drafts · Status · Updated · Actions (👁 ✏ ⋮).
5. **Правый drawer (Preset Details)**: иконка + имя + статус + Default-бейдж · Description · Tags · Languages · Used In Drafts · Settings (Tone / Writing Style / Length / Complexity / Format) · Custom Instructions · Actions: `Edit Preset` · `Duplicate Preset` · `Archive Preset`.

## Edit Style page (ТЗ §8.8)
Полная форма: Name/Language/Description · System prompt (textarea) · Synthesis instructions · Rewrite instructions · Per-platform overrides (раскрывающиеся) · Forbidden phrases (tag input) · Required elements (tag input) · Temperature slider (0–1) · Max length per platform · Few-shot examples (topic→output, add/remove) · Version history (restore) · `Save` · `Test with Sample Post` (живой прогон synthesis+rewrite).

## API (ТЗ §6.9)
- `GET/POST/PUT/DELETE /content/style-presets[/{id}]`.
- `POST /content/style-presets/{id}/duplicate`.
- `GET /content/style-presets/{id}/versions` — история промптов.
- `POST /content/style-presets/{id}/restore` — восстановить версию.

## Состояние кода
Страницы нет — **создать** `content/styles/page.tsx` + `content/styles/[id]/page.tsx` (Edit). Test-панель дергает синтез/rewrite на сэмпле.

## Acceptance
- Список с tabs/фильтрами/сортировкой; Default отмечается звездой.
- Drawer показывает Settings + Custom Instructions.
- Edit-страница сохраняет все поля + version history с restore.
- «Test with Sample Post» возвращает живой вывод.
