# 03 — Topic Clusters

**Route:** `/content/clusters`  ·  **ТЗ:** §8.3  ·  **Макет:** `mockup.png`

## Назначение
AI-обнаруженные темы, сгруппированные по похожему контенту. Сетка карточек по приоритету + правый drawer деталей кластера.

## Блоки макета
1. **Top bar**: Search topics · `Refresh Clusters` (primary) · `Search by Topic` (ручной поиск через Perplexity) · `Export` · справа Sort by (Priority & Freshness) · переключатель Grid/List.
2. **Левая панель фильтров**: Status (Active/Used/Dismissed/Archived + counts) · Priority (High/Medium/Low + counts) · Tags · Date Range (Most Recent Post) · Min Source Count · Search in Description · `Apply Filters`. Внизу — «Last Clustering» time + based on N posts.
3. **Карточка кластера**: priority-бейдж · заголовок · описание (2 предл.) · Sources / Posts / Freshness цифры · аватары источников (+N) · теги · кнопки `Create Draft` · `View Posts` · `Dismiss` · ⋮.
4. **Правый drawer (Cluster Details)**: priority + created · заголовок · описание · теги (edit) · метрики (Sources/Posts/Freshness/Priority/Score/Used In) · Top Sources (список с кол-вом постов + время) · `View All N Posts` · Actions (Create Draft / View Posts / Dismiss).
5. **Пагинация**: Show 10 per page.

## API (ТЗ §6.3)
- `GET /content/clusters` — активные по приоритету.
- `GET /content/clusters/{id}` — кластер со всеми постами (drawer).
- `POST /content/clusters/{id}/dismiss`.
- `POST /content/clusters/refresh` — перезапуск кластеризации (Celery).
- `POST /content/clusters/search` `{query, tags}` — ручной поиск темы.
- Create Draft → `POST /content/drafts` c `cluster_id`.

## Состояние кода
Есть заглушка `content/clusters/page.tsx`. Реализовать grid/list, фильтры, drawer, Refresh с прогрессом.

## Acceptance
- Карточки сортируются по Priority & Freshness; toggle Grid/List работает.
- Клик по карточке открывает drawer с Top Sources и метриками.
- Refresh Clusters запускает кластеризацию и обновляет «Last Clustering».
- Create Draft переносит кластер в Create Draft.
