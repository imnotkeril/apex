# 06 — Knowledge Graph

**Route:** `/content/graph`  ·  **ТЗ:** §8.7  ·  **Макет:** `mockup.png`

## Назначение
Полноэкранный интерактивный граф связей между raw-контентом и опубликованными постами (D3.js или vis.js).

## Блоки макета
1. **Top controls**: View toggles `All / Raw Posts / Published` · Filter by Tags (multi) · Date Range · Sources · Search nodes · `More Filters`.
2. **Легенда**: узлы — 🔵 Raw Post, 🟣 Published Post; рёбра — Same Topic / Continuation / Contradicts / Supplements / Source Of / Auto Semantic (цвет+стиль линии).
3. **Канвас графа**: ноды с карточкой-подписью (заголовок + источник + дата). Размер ноды = число связей. Цвет/толщина ребра = тип связи. Контролы зума (рука/курсор/+/−/fit/настройки) слева. Мини-карта снизу-слева.
4. **Bottom stats**: Nodes (raw/published) · Edges (manual/auto) · Density · Clusters detected · Last Updated.
5. **Правый drawer (Node Details)**: тип-бейдж · заголовок · платформа + дата публикации · Tags · Summary (Show more) · Metrics (Views/Reactions/Shares/Comments) · `Connected to (N)` список со связями и весом · Actions: `Create Draft from This` · `View Full Content` · `Find Related Content`.

## API (ТЗ §6.8)
- `GET /content/graph?types=raw,published&tags=&date_from=` — данные графа.
- `GET /content/graph/{id}` — граф вокруг конкретной ноды.
- `POST /content/graph/links` `{from_type, from_id, to_type, to_id, link_type}` — ручная связь.
- `DELETE /content/graph/links/{id}`.
- `PATCH /content/raw-posts/{id}/tags` · `/published/{id}/tags` — теги (граф авто-обновляется).

## Состояние кода
Страницы нет — **создать** `content/graph/page.tsx`. Подключить vis-network или d3-force. Force-симуляция + zoom/pan + клик-ноды → drawer.

## Acceptance
- Граф рендерит ноды/рёбра по типам с легендой; зум/пан/fit работают.
- Фильтры View/Tags/Date/Source перестраивают граф.
- Клик по ноде открывает drawer со списком связей и весами.
- «Add Manual Link» создаёт ребро; «Create Draft from This» ведёт в Create Draft.
