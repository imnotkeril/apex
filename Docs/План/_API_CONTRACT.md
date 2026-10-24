# API-контракт: страница → эндпоинт (реальность кода)

Сверено с `backend/app/modules/content/router.py` + `schemas.py` (на 2026-06-28). Префикс: `/api/v1/content`.
Назначение: фронт типизировать против РЕАЛЬНЫХ схем, и видеть что бэк надо ДОСТРОИТЬ перед страницей.

Легенда: ✅ есть · 🔨 достроить бэк · 🟡 есть, но схема урезана (расширить Read-модель).

---

## Сводка пробелов бэка (строить ДО соответствующих страниц)

| Раздел | Чего нет в router.py | Для страницы |
|--------|----------------------|--------------|
| sources | `GET /{id}/status`, `POST /add-url` | 08 Sources, 02 Raw Posts |
| raw-posts | `DELETE`, `GET /{id}/related`, `custom-input/url|youtube|text` | 02 Raw Posts |
| clusters | `GET /{id}`, `POST /search`, `Export` | 03 Clusters |
| drafts | `PATCH`, `POST /regenerate`, `DELETE`, `GET /related` | 04 Drafts/Create |
| published | **весь раздел** (`GET list`, `GET /{id}`, `POST /{id}/sync`) | 07 Published |
| calendar | **весь раздел** (`GET`, `PUT /{id}/reschedule`, `DELETE /{id}`) | 05 Calendar |
| graph | **весь раздел** (`GET`, `GET /{id}`, `links CRUD`) | 06 Knowledge Graph |
| image-styles | **CRUD** (`GET/POST/PUT/DELETE`) — модель есть, роутов нет | 11 Image Styles |
| tags | `PUT`, `DELETE`, merge | 10 Tags |
| style-presets | `PUT`, `DELETE`, `duplicate`, `versions`, `restore` | 09 Styles |
| auto-mode | `enable`, `disable`, `preview`, **rules CRUD** | 12 Auto Mode |
| recommendations | **весь раздел** | 01 Dashboard, 12 Auto Mode |

Также парсеры: есть rss+telegram; **нет youtube/email-imap/web-article** (ТЗ §4) → влияет на Add Source / custom-input.

---

## Реальные Read-схемы (для TS-типов фронта)

> Многие Read-модели **урезаны** против макетов — фронту нужны поля, которых в схеме нет. Помечено 🟡: расширить pydantic Read + миграцию при необходимости.

### ContentSourceRead ✅ (08 Sources)
`id, org_id, source_type, source_id, display_name, is_active, auto_parse, parse_schedule, default_language, last_parsed_at, total_posts_parsed, error_count, last_error`
🟡 макет хочет ещё: success_rate_7d, last_post_at, recent_activity[] — добавить.

### RawPostRead ✅ (02 Raw Posts)
`id, source_id, raw_text, summary, tags[], status, post_date, source_url, cluster_id`
🟡 макет: source display_name+иконка (join), language, used_in (drafts count) — добавить в Read/ответ.

### TopicClusterRead ✅ (03 Clusters)
`id, title, description, tags[], post_count, source_diversity, freshness_hours, priority, status`
🟡 макет: top_sources[], score, used_in — нужен ещё `GET /clusters/{id}` (его нет) с постами.

### DraftRead / DraftDetailRead ✅ (04 Drafts)
Read: `id, topic, pipeline_status, pipeline_error, status, language, telegram_version, linkedin_post_version, twitter_version, fact_check_status, created_at`
Detail: + `synthesized_text, styled_text, fact_check_results`
🟡 макет: created_by (Manual/Auto), style_preset_name, formats[] список, updated_at, tags[] — добавить.
🔨 версии форматов: в схеме только telegram/linkedin_post/twitter — макет хочет ещё LinkedIn Article/Email/PDF/PPTX/Image/Video. Расширить модель draft + Detail.

### TagsConfigRead 🟡 (10 Tags)
`id, tag_name, display_name, category, is_system`
🟡 макет: type, usage_30d, trend, first_used, last_used, languages[], status — сильно расширить Read.

### StylePresetRead 🟡 (09 Styles)
`id, name, display_name, language, is_default`
🟡 макет: description, tags[], used_in_drafts, status, updated_at, settings(tone/length/...), custom_instructions — расширить.

### AutoModeRead ✅ (12 Auto Mode)
`is_enabled, publish_times[], timezone, max_posts_per_day, weight_*, min_source_count, avoid_repeat_hours, publish_to[]`
🔨 макет: rules[] (CRUD правил), stats 30d, guardrails, recent_activity — крупно достроить (модель `auto_mode_config` есть, rules-сущности нет).

### Нет схем вообще (🔨 создать Read+эндпоинты)
- PublishedPostRead (07): platform, published_at, engagement{likes,reposts,views,comments}, tags, language, content_preview, related_draft_id, external_url.
- CalendarEntryRead (05): scheduled_at, platform, language, status, draft_id, preview.
- GraphData (06): nodes[{id,type,title,source,date,size,tags}], edges[{from,to,link_type,weight}], stats{nodes,edges,density,clusters}.
- ImageStylePresetRead (11): name, category, description, preview_url, used_in, languages, status, settings{color_scheme,...}.
- RecommendationRead (01): cluster ref + priority + score + summaries.
- DashboardStats: ✅ есть `GET /dashboard-stats` — сверить поля под 5 stat-карточек.

---

## Пострничная привязка (быстрая)

| Стр | Готовность API | Перед UI достроить |
|-----|----------------|--------------------|
| 01 Dashboard | 🟡 stats есть | recommendations, pipeline-list, sources-health |
| 02 Raw Posts | ✅ почти | delete, related, custom-input, join source/used_in |
| 03 Clusters | 🟡 | get-by-id, search, расширить top_sources |
| 04 Drafts | 🟡 | patch, regenerate, delete, related, расширить форматы |
| 05 Calendar | 🔨 нет | весь раздел calendar |
| 06 Graph | 🔨 нет | весь раздел graph |
| 07 Published | 🔨 нет | весь раздел published |
| 08 Sources | ✅ почти | status, add-url, success_rate |
| 09 Styles | 🟡 | put/delete/duplicate/versions/restore + расширить Read |
| 10 Tags | 🟡 | put/delete/merge + расширить Read (usage/trend) |
| 11 Image Styles | 🔨 нет роутов | CRUD + Read |
| 12 Auto Mode | 🟡 | rules CRUD, enable/disable/preview, stats |
| 13 Settings | 🔨 | workspace settings API (Foundation), integrations |
| 14 Profile | 🔨 | user profile/preferences/activity (Foundation) |

**Вывод:** «все 14 страниц» = заметная достройка бэка (5 разделов с нуля + расширение Read-моделей + 4 парсера). Это не только фронт. Закладываем в порядок слайсов.

## TS API-клиент

Сгенерировать типы из FastAPI OpenAPI: `GET /openapi.json` → `openapi-typescript` → `frontend/lib/api/types.ts`. Тонкий fetch-клиент `frontend/lib/api/client.ts` (Supabase JWT в Authorization). Не писать типы руками — генерить, чтобы фронт не расходился с бэком.
