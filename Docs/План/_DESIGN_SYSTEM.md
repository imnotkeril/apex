# Дизайн-система APEX — токены из макетов

Извлечено из 14 макетов `Docs/Pics/`. Уровень: implementation-grade (Tailwind-классы). Источник правды визуала.

> ⚠️ **РАСХОЖДЕНИЕ С КОДОМ.** Текущий фронт — **тёмная** тема (`globals.css`: `bg-zinc-950 text-zinc-100`; ui-компоненты тёмные; `tailwind.config.js` пустой). Макеты — **светлая** тема (белый контент, тёмный только сайдбар). **Решение: переключить на light.** Первый шаг стройки — переписать `globals.css`, `tailwind.config.js`, `button/card/input` под light-токены ниже. Иначе весь UI разъедется с макетами.

---

## 1. Палитра (Tailwind)

| Роль | Класс | Где |
|------|-------|-----|
| Фон страницы | `bg-zinc-50` | основной контейнер контента |
| Фон карточки/таблицы | `bg-white` | карточки, строки, drawer |
| Граница | `border-zinc-200` | карточки, разделители |
| Заголовок | `text-zinc-900` | H1/H2, имена |
| Текст основной | `text-zinc-700` | значения |
| Текст вторичный | `text-zinc-500` | подписи, мета, time-ago |
| **Сайдбар фон** | `bg-zinc-950` | aside |
| Сайдбар текст | `text-zinc-400` | пункты |
| Сайдбар секция-лейбл | `text-zinc-600 uppercase text-xs tracking-wider` | MAIN/CONTENT/SETTINGS |
| **Акцент (primary)** | `bg-violet-600 hover:bg-violet-700 text-white` | главные кнопки |
| Акцент мягкий | `bg-violet-100 text-violet-700` | активный пункт сайдбара, чипы |
| Прогресс-бар | `bg-violet-500` | AI cost, pipeline |

## 2. Бейджи (приоритет/статус)

| Бейдж | Класс |
|-------|-------|
| High priority | `bg-rose-100 text-rose-700` |
| Medium priority | `bg-violet-100 text-violet-700` |
| Low priority | `bg-zinc-100 text-zinc-600` |
| Active / OK / Passed / Published | `bg-emerald-100 text-emerald-700` |
| Failed / Error / Issues Found | `bg-rose-100 text-rose-700` |
| Warning | `bg-amber-100 text-amber-700` |
| New | `bg-sky-100 text-sky-700` |
| Scheduled / In Progress | `bg-violet-100 text-violet-700` |
| Draft / Pending / Archived | `bg-zinc-100 text-zinc-600` |

Форма бейджа: `inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium`.

## 3. Типографика

- Шрифт: `Inter` (через `next/font/google`), fallback sans.
- H1 страницы: `text-2xl font-bold tracking-tight text-zinc-900` (часто UPPERCASE в макете — оставить как есть в тексте, не CSS).
- Подзаголовок страницы: `text-sm text-zinc-500`.
- Секция-лейбл: `text-xs font-semibold uppercase tracking-wider text-zinc-500`.
- Число-метрика (stat): `text-3xl font-bold text-zinc-900`.
- Таблица header: `text-xs font-medium uppercase tracking-wide text-zinc-500`.

## 4. Радиусы / тени / отступы

- Радиус: карточки/кнопки `rounded-lg` (8px), бейджи/инпуты `rounded-md`.
- Тень: карточки `shadow-sm`, drawer `shadow-xl`.
- Сетка контента: `p-6` страница, `gap-4` между карточками, `gap-6` между секциями.
- Stat-карточка: `bg-white border border-zinc-200 rounded-lg p-4`.

## 5. Повторяющиеся паттерны (компоненты для `components/ui` и `components/layout`)

| Компонент | Назначение | Видно на |
|-----------|------------|----------|
| `Sidebar` | 14 пунктов, 3 группы, активный = violet-100, низ = карточка юзера | все |
| `Topbar` | AI Cost (Today) прогресс + дата UTC + org switcher | все |
| `PageHeader` | H1 + подзаголовок + правый слот действий | все |
| `StatCard` | иконка + лейбл + число + дельта | Dashboard, Sources, Tags, Auto Mode |
| `Badge` | вариант по статусу (см. §2) | везде |
| `DataTable` | header + строки + чекбоксы + пагинация + bulk-bar | Raw Posts, Drafts, Published, Sources, Tags, Styles, Image Styles, Auto Mode |
| `FilterPanel` | левая колонка фильтров (search/select/range/checkbox) + Apply/Save View | Raw Posts, Clusters, Drafts, Published |
| `DetailDrawer` | правая панель ~`w-[360px]`, white, `border-l`, header+крестик+actions | Clusters, Sources, Published, Tags, Styles, Image Styles, Graph, Calendar, Auto Mode |
| `Tabs` | горизонтальные табы с counts | Drafts, Sources, Styles, Tags, Image Styles, Auto Mode, Settings, Profile |
| `Card`/`CardGrid` | карточки кластеров/черновиков/стилей | Clusters, Drafts, Styles |
| `Toggle` | переключатели | Settings, Auto Mode, Sources, Raw Posts |
| `PlatformIcon` | Telegram/LinkedIn/X/Email/PDF/Internal | везде |
| `Pagination` | Show N per page + номера | таблицы |
| `ProgressSteps` | Synthesis→Style→Format→Translation→FactCheck→Image | Dashboard, Create Draft, Drafts |

**Вывод:** ~80% UI = `DataTable + FilterPanel + DetailDrawer + Badge + StatCard`. Построить их идеально один раз → остальное сборка.

## 6. Иконки

Lib: `lucide-react` (добавить в deps). Платформенные (Telegram/X/LinkedIn) — `lucide` brand-иконки либо `simple-icons`/локальные SVG.

## 7. Layout-сетка страницы (типовая)

```
┌── Sidebar(w-56, fixed, dark) ──┬── main(flex-1, bg-zinc-50) ──────────────┐
│                                │ Topbar                                   │
│                                │ PageHeader                               │
│                                │ ┌ FilterPanel ┬ DataTable ┬ DetailDrawer ┐│
│                                │ └─────────────┴───────────┴─────────────┘│
└────────────────────────────────┴──────────────────────────────────────────┘
```
Drawer открыт → таблица сжимается. Drawer — overlay на мобиле.
