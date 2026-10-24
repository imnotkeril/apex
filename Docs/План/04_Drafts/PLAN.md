# 04 — Drafts (+ Create Draft)

**Route:** `/content/drafts`  ·  **Sub:** `/content/drafts/new`  ·  **ТЗ:** §8.5 + §8.4  ·  **Макет:** `mockup.png`

## Назначение
Список черновиков по статусам + редактор/генератор (Create Draft).

## Drafts List (макет, ТЗ §8.5)
1. **Tabs-фильтры**: All · Draft · In Progress · Ready · Scheduled · Published · Archived (с counts). Справа `+ Create New Draft`.
2. **Левая панель фильтров**: Search · Status · Created By · Style Preset · Tags · Language · Date Range · Created By Mode (Manual/Auto) · Apply · Save as View.
3. **Таблица**: чекбокс · Topic & Preview (иконка формата + 2 строки + ID) · Tags · Style Preset (+lang) · Formats (иконки TG/LI/X/PDF +N) · Status (Ready/In Progress c прогресс-баром/Draft/Failed-Issues/Scheduled) · Fact Check (Passed/Pending/Issues Found + View Issues) · Updated · Actions (👁 ✏ ⋮). Сверху Columns + Sort by.

## Create Draft (ТЗ §8.4, без отдельного макета)
- **Левая панель 40%**: выбранные source posts (source/date/summary/tags + Remove), `+ Add More Posts` (модалка-пикер).
- **Правая панель 60%**: настройки — Topic · Style preset · Language · Tags · Output formats (чекбоксы: Telegram/LinkedIn Post/LinkedIn Article/Twitter/Email/PDF/PPTX/Image/Video Idea/Video Script) · Translation targets (EN/RU/JA/KO/ZH).
- `Generate` → прогресс по шагам: `Synthesis ✓ → Styling ✓ → Formatting… → Translation ⏳ → Fact Check ⏳ → Image ⏳`.
- **Results**: табы по форматам (текст + char count + Copy/Edit/Regenerate). Image-таб: 2 варианта side-by-side + Select. Fact check-таб: список claims с verdict (✅/⚠/❌).
- **Related panel**: related raw posts (синие) + published (фиолетовые) через semantic search.
- Низ: `Save Draft` · `Publish Now` · `Schedule`.

## API (ТЗ §6.4)
- `GET /content/drafts?status=&...` — список.
- `POST /content/drafts` `{source_post_ids, cluster_id, style_preset_id, languages, output_formats}` — создать.
- `GET /content/drafts/{id}` — полный с версиями.
- `GET /content/drafts/{id}/status` — polling pipeline_status.
- `PATCH /content/drafts/{id}` — edit text/tags/topic.
- `POST /content/drafts/{id}/regenerate` `{steps, languages}`.
- `POST /content/drafts/{id}/publish` `{platforms, languages, scheduled_at?}`.
- `GET /content/drafts/{id}/related`.
- `DELETE /content/drafts/{id}`.

## Состояние кода
Есть заглушка `content/drafts/page.tsx`. Реализовать список (tabs/таблица/фильтры) + **создать** под-страницу `drafts/new` (двухпанельный редактор с polling генерации).

## Acceptance
- Tabs фильтруют по статусу с корректными counts.
- In Progress показывает прогресс-бар реального pipeline.
- Create Draft: выбор постов → Generate → пошаговый прогресс → табы результатов.
- Publish/Schedule создаёт запись (видна в Calendar / Published).
