# Стек и конвенции фронта (зафиксировано)

Чтобы агенты не импровизировали либы/паттерны. Решения приняты — следовать без отклонений.

## 1. Базис (уже в package.json)
Next.js 14 (App Router) · React 18 · TS 5 · Tailwind 3 · `@supabase/ssr` + `supabase-js` · `clsx` + `tailwind-merge` (`cn()` в `lib/utils`).

## 2. Добавить в зависимости

| Задача | Либа | Почему |
|--------|------|--------|
| Иконки | `lucide-react` | лёгкие, совпадают со стилем макетов |
| Data-fetching/cache | `@tanstack/react-query` | списки+polling pipeline/draft status |
| Формы | `react-hook-form` + `zod` | Create Draft, Edit Style, Settings |
| Таблицы | `@tanstack/react-table` (headless) | сортировка/выбор/колонки, верстаем своим Tailwind |
| Календарь | **своя grid-сетка** (без DnD) | ТЗ §8.6 запрещает DnD в v1 — lib избыточна |
| Граф | `vis-network` (или `react-force-graph`) | 06 Knowledge Graph, force-layout+zoom |
| Графики (спарклайны/бары) | `recharts` | Tags/Auto Mode/Profile тренды |
| Даты | `date-fns` | форматирование UTC, диапазоны |
| Тосты | `sonner` | действия parse/publish/sync |

Не тащить тяжёлые UI-киты (MUI/AntD) — ломают кастомный вид макетов. Компоненты — свои на Tailwind по `_DESIGN_SYSTEM.md`.

## 3. Структура папок (App Router)

```
frontend/
├─ app/
│  ├─ (auth)/login/
│  ├─ (dashboard)/                 # общий layout: sidebar+topbar
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                  # 01 Dashboard (/)
│  │  ├─ content/
│  │  │  ├─ raw-posts/ clusters/ drafts/ (+ drafts/new) calendar/
│  │  │  ├─ graph/ published/ sources/ styles/ (+ styles/[id])
│  │  │  ├─ tags/ image-styles/ auto-mode/ settings/
│  │  └─ profile/                  # 14 Profile
├─ components/
│  ├─ layout/  (sidebar, topbar, page-header)
│  ├─ ui/      (button,card,input,badge,table,drawer,tabs,toggle,stat-card,
│  │           filter-panel,pagination,progress-steps,platform-icon)
│  └─ content/ (per-page composite: cluster-card, draft-card, source-row, ...)
├─ lib/
│  ├─ api/ (client.ts, types.ts[generated], hooks/*.ts react-query)
│  ├─ supabase/ (browser, server)
│  └─ utils.ts
```

## 4. Конвенции

- **Данные:** только через `lib/api/hooks/*` (react-query). Никаких прямых fetch в компонентах.
- **Типы:** из `lib/api/types.ts` (генерится из OpenAPI). Руками типы API не писать.
- **Фильтры таблиц:** состояние в URL searchParams (шарится/перезагрузка переживает).
- **Polling:** draft pipeline + cluster refresh → `refetchInterval` пока `pipeline_status in (queued,processing)`.
- **Auth:** JWT Supabase → Authorization header в client.ts; защита роутов через существующий `middleware.ts`.
- **Drawer:** один паттерн `DetailDrawer`, открытие по `?selected=<id>` в URL.
- **Состояния:** у каждой страницы loading (skeleton) / empty / error — обязательно, не пустой экран.
- **i18n:** строки UI пока EN (макеты EN); вынести в константы для будущего i18n, но не блокировать.

## 5. Definition of Done страницы

1. Маршрут + layout + sidebar-пункт активен.
2. Данные из реального API (не мок), типы из generated.
3. Все блоки макета собраны (свериться с `mockup.png` в папке страницы).
4. Loading/empty/error состояния.
5. Действия работают (кнопки триггерят API, тосты).
6. Адаптив: drawer→overlay, таблица→скролл на мобиле.
7. **Верификация запуском**: `npm run dev` → открыть страницу → скриншот → сверить с макетом. Не «выглядит готово» на глаз кода.

## 6. Порядок слайсов (все 14, заземлён под пробелы бэка)

**Слайс 0 — каркас + тема** (блокер всего):
light-тема (globals/tailwind/ui), `lucide`+`react-query`+`react-table` setup, Sidebar(14), Topbar, PageHeader, OpenAPI→types, api client.

**Волна 1 — API почти готов** (быстрые победы): 08 Sources → 02 Raw Posts → 03 Clusters → 01 Dashboard.
*(параллельно бэк: sources/status+add-url, raw delete/related/custom-input, clusters get-by-id/search, recommendations)*

**Волна 2 — генерация/публикация**: 04 Drafts + Create Draft → 05 Calendar → 07 Published.
*(бэк: расширить draft-форматы, calendar раздел, published раздел)*

**Волна 3 — конфиг**: 09 Styles → 11 Image Styles → 10 Tags → 13 Settings.
*(бэк: style put/delete/dup/versions, image-styles CRUD, tags put/delete, workspace settings)*

**Волна 4 — продвинутое**: 06 Knowledge Graph → 12 Auto Mode → 14 Profile.
*(бэк: graph раздел, auto-mode rules+enable/disable/preview, profile/activity)*

Каждый слайс: бэк-эндпоинт(ы) → регенерить types → UI → верификация. Один слайс = одна рабочая вертикаль, не уплывает.
