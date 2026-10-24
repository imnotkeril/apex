# 01 — Dashboard

**Route:** `/`  ·  **ТЗ:** §8.1  ·  **Макет:** `mockup.png`

## Назначение
Обзорный экран движка контента. Сводка за день + AI-рекомендации + статус авто-режима + лента активности.

## Блоки макета
1. **Stats row** (5 карточек): New Posts (24h) · Active Clusters · Drafts Ready · Published This Week · Total Views (Week). У каждой — дельта vs вчера/прошлая неделя.
2. **AI Recommendations** — горизонтальные карточки кластеров по приоритету (High/Medium/Low бейдж, заголовок, summary, теги, sources count, hours ago). Кнопки: `Create Draft` · `View Sources` · `Dismiss`. Ссылка `View all clusters →`.
3. **Sources Health** — список источников со статусом (OK/Warning/Error) + last parse. `Manage Sources →`.
4. **Content Pipeline** — таблица черновиков в работе: Draft/Topic · Progress (шаги Synthesis→Style→Format→Translation→FactCheck→Image) · Current Step · Updated. `View All Drafts →`.
5. **Recent Activity** — таймлайн последних ~10 событий (parse, draft generated, published, failed) со временем и статус-точкой.
6. **Auto Mode** (правая колонка) — Enabled бейдж, Next Publish Times, Top Recommendations с score, Target Platforms, `View Auto Mode Settings →`.
7. **Quick Actions** — Create New Draft · Parse All Sources · Refresh Clusters · Open Knowledge Graph · Open Calendar.

## API (ТЗ §6)
- `GET /content/recommendations` (§6.12) — AI Recommendations + Top for auto.
- `GET /content/clusters?limit` (§6.3) — Active Clusters stat.
- `GET /content/drafts?status=in_progress` (§6.4) — Content Pipeline.
- `GET /content/sources/{id}/status` (§6.1) — Sources Health.
- `GET /content/auto-mode` + `/auto-mode/preview` (§6.11) — Auto Mode блок.
- Stats: агрегаты raw_posts / clusters / drafts / published (отдельный summary endpoint или несколько count-запросов).
- `GET /health` + AI cost (ai_usage за сегодня) для топбара.

## Состояние кода
Есть заглушка `(dashboard)/page.tsx`. Нужно собрать все 7 блоков, привязать к данным, polling pipeline (status каждые ~5с).

## Acceptance
- 5 stat-карточек с реальными числами и дельтами.
- Рекомендации кликабельны → Create Draft ведёт на `/content/drafts/new` с предзаполнением.
- Quick Actions ведут на нужные маршруты.
- Auto Mode блок отражает реальный конфиг (enabled/next times).
