# APEX Content Engine — мастер-план фронтенда (по страницам)

| Поле | Значение |
|------|----------|
| Версия | 1.0 |
| Дата | 2026-06-28 |
| Источник | `Docs/APEX_M4_Content_Engine_TZ.md` §8 (Frontend Screens), §6 (API), макеты `Docs/Pics/` |
| Назначение | На каждую страницу — отдельная папка с мини-планом + макет-скриншот (`mockup.png`) |

## ⚡ Implementation-grade документы (читать ПЕРЕД стройкой)

1. [`_DESIGN_SYSTEM.md`](_DESIGN_SYSTEM.md) — токены из макетов (цвета/типографика/паттерны). **Содержит критичное расхождение: код тёмный, макеты светлые → переключить на light.**
2. [`_API_CONTRACT.md`](_API_CONTRACT.md) — карта страница→эндпоинт (что ✅ есть / 🔨 достроить в бэке) + реальные схемы для TS-типов.
3. [`_STACK_AND_CONVENTIONS.md`](_STACK_AND_CONVENTIONS.md) — зафиксированные либы, структура папок, конвенции, Definition of Done, порядок слайсов (волны 0–4).

Папки `01..14` — пострничные мини-планы (что на экране + API + acceptance).

---

## 1. Что это

Content Engine — система автоматизации контента: собирает посты из источников → кластеризует в темы → синтезирует черновики в любом формате (Telegram / LinkedIn / Twitter / Email / PDF / PPTX / Image / Video) → фактчек → публикация. Два режима: **Manual** и **Auto**.

Поток данных:
```
Sources → raw_posts → AI Analysis → Topic Clusters → Draft → Fact Check → Publish
                                                        ↕
                                          Knowledge Graph (pgvector)
```

---

## 2. Навигация (sidebar) — что видно на макетах

Левый сайдбар фикс, ширина ~256px, тёмный (`zinc-950`). Группы:

**MAIN**
1. Dashboard — `/`
2. Raw Posts — `/content/raw-posts`
3. Topic Clusters — `/content/clusters`
4. Drafts — `/content/drafts`
5. Calendar — `/content/calendar`
6. Knowledge Graph — `/content/graph`

**CONTENT**
7. Published Posts — `/content/published`

**SETTINGS**
8. Sources — `/content/sources`
9. Styles & Presets — `/content/styles`
10. Tags — `/content/tags`
11. Image Styles — `/content/image-styles`
12. Auto Mode — `/content/auto-mode`
13. Settings — `/content/settings`

**Низ сайдбара (карточка юзера)** → 14. Profile — `/profile`

Топбар (общий для всех): **AI Cost (Today)** прогресс-бар · дата/время UTC · переключатель организации (Apex Org / Team Admin).

Под-страницы без отдельного макета: **Create Draft** (`/content/drafts/new`, ТЗ §8.4) — описана внутри `04_Drafts`; **Login** (`/login`) — вне нав-меню.

---

## 3. Дизайн-система (вывод из макетов)

- **Фон контента**: светлый (white / zinc-50). Сайдбар тёмный.
- **Акцент**: фиолетовый (purple-500/600) — активные пункты, primary-кнопки, прогресс.
- **Бейджи приоритета/статуса**: High=розовый, Medium=сиреневый, Low=серый; Active=зелёный, Failed=красный, Pending=серый.
- **Правая панель деталей** (drawer ~360px): открывается по клику на строку/карточку/ноду. Закрытие крестиком.
- **Таблицы**: левая панель фильтров + основная таблица + правый drawer деталей (паттерн Raw Posts / Published / Sources / Tags).
- **Иконки платформ**: Telegram, LinkedIn, Twitter/X, Email, PDF, Internal.

---

## 4. Текущее состояние кода (`frontend/app`)

Уже есть (заглушки): `login`, `(dashboard)/page` (Dashboard), `content/page`, `content/raw-posts`, `content/clusters`, `content/drafts`, `content/sources`, `layout`, `sidebar`, `topbar`, ui: button/card/input.

**Сайдбар `components/layout/sidebar.tsx` сейчас содержит только 2 пункта** (Dashboard, Content) — нужно расширить до 14 по списку выше с группами MAIN / CONTENT / SETTINGS.

Отсутствуют страницы: Calendar, Knowledge Graph, Published Posts, Styles & Presets, Tags, Image Styles, Auto Mode, Settings, Profile, Create Draft.

---

## 5. Порядок реализации (рекомендация)

1. **Каркас**: расширить sidebar (14 пунктов), topbar (AI cost, org switcher), общий layout под-страниц с правым drawer.
2. **Core loop** (ТЗ Phase 1): Dashboard → Sources → Raw Posts → Topic Clusters → Create Draft → Drafts.
3. **Публикация**: Calendar → Published Posts.
4. **Конфиг**: Styles & Presets → Image Styles → Tags → Settings.
5. **Продвинутое**: Knowledge Graph (D3/vis.js) → Auto Mode → Profile.

Зависимости по бэкенду: страницы тянут API из ТЗ §6 (см. ссылки в каждом мини-плане). Бэкенд M4 поверх Foundation (auth, AI Router, Celery) — см. `Docs/APEX_M4_Content_Engine_Implementation_Plan.md`.

---

## 6. Карта папок

```
Docs/
├─ APEX_Foundation_TZ_EN.md            (ТЗ Foundation)
├─ APEX_M4_Content_Engine_TZ.md        (ТЗ M4 — главный источник экранов §8)
├─ FOUNDATION_IMPLEMENTATION_PLAN.md
├─ APEX_M4_Content_Engine_Implementation_Plan.md
├─ APEX_ENV_SETUP_GUIDE.md
├─ AI Marketing Automation System.pdf
├─ AI-ассистент editor suite.docx
├─ Pics/                               (14 оригиналов макетов)
└─ План/
   ├─ 00_OVERVIEW.md                   (этот файл)
   ├─ 01_Dashboard/{PLAN.md, mockup.png}
   ├─ 02_Raw_Posts/...
   ├─ ... (каждая страница)
   └─ 14_Profile/{PLAN.md, mockup.png}
```
