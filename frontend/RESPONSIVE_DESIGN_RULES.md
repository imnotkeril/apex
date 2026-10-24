# Responsive Design Rules — Apex Content Engine Dashboard

> Единый источник истины для всех layout, spacing и scaling решений.  
> Никаких магических чисел в компонентах — только токены из этого документа.

---

## 1. Breakpoints

| Name | Range | Описание |
|---|---|---|
| `mobile` | < 768px | Не приоритет, но не ломается |
| `tablet` | 768px – 1279px | Nav в drawer, 2 колонки |
| `laptop` | 1280px – 1439px | Минимальный полный layout |
| `desktop` | 1440px – 1919px | Стандартный рабочий экран |
| `base` | **1920px** | **База дизайна** |
| `wide` | 2560px+ | Поля по бокам, без доп. разметки |

```css
/* Использование в CSS */
@media (max-width: 1279px) { /* tablet и ниже */ }
@media (max-width: 767px)  { /* mobile */ }
@media (min-width: 2560px) { /* wide — только если нужно */ }
```

**Правило:** дизайн проектируется на 1920px. На 2560px+ контент центрируется, поля по бокам — это норма для всех B2B web apps.

---

## 2. Spacing Tokens

Все отступы — только через токены. Хардкод в компонентах = ошибка.

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  24px;
  --space-6:  32px;
  --space-7:  48px;
  --space-8:  64px;
}
```

### Fluid spacing — масштабируется с вьюпортом

```css
:root {
  --page-padding:   clamp(16px, 2vw, 40px);
  --card-padding:   clamp(12px, 1.5vw, 24px);
  --section-gap:    clamp(16px, 2vw, 32px);
  --card-gap:       clamp(12px, 1.5vw, 24px);
}
```

**Когда использовать fluid vs fixed:**
- `fluid (clamp)` — page padding, section gaps, card gaps — всё что между блоками
- `fixed (px)` — внутренние паддинги кнопок, иконки, высота строк — всё что про touch targets и читаемость

---

## 3. Layout Tokens

```css
:root {
  --nav-width:            90px;
  --nav-width-expanded:   220px;
  --right-panel-width:    300px;
  --content-max-width:    1920px;
  --header-height:        56px;
}
```

### Глобальный app layout

```
┌─────────────────────────────────────────────────────────┐
│                      HEADER (56px)                      │
├──────────┬──────────────────────────────┬───────────────┤
│          │                              │               │
│  NAV     │      MAIN CONTENT            │  RIGHT PANEL  │
│  90px    │      fluid (1fr)             │  300px        │
│  fixed   │      max 1920px              │  fixed        │
│          │                              │               │
└──────────┴──────────────────────────────┴───────────────┘
```

```css
.app-root {
  display: grid;
  grid-template-columns: var(--nav-width) 1fr;
  min-height: 100vh;
}

.app-main {
  display: grid;
  grid-template-columns: 1fr var(--right-panel-width);
  max-width: calc(var(--content-max-width) - var(--nav-width));
  padding: var(--page-padding);
  gap: var(--section-gap);
  align-content: start;
}
```

### Breakpoints для layout

```css
/* Tablet: right panel уходит вниз */
@media (max-width: 1279px) {
  .app-main {
    grid-template-columns: 1fr;
  }
  .right-panel {
    order: 999; /* уходит в конец */
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Mobile: nav уходит в bottom bar */
@media (max-width: 767px) {
  .app-root {
    grid-template-columns: 1fr;
    padding-bottom: 60px; /* место под bottom nav */
  }
  .app-nav {
    position: fixed;
    bottom: 0;
    width: 100%;
    height: 60px;
    flex-direction: row;
  }
}
```

---

## 4. Grid System

### Карточки — основной паттерн

```css
/* 3 колонки → 2 → 1 */
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--card-gap);
}

@media (max-width: 1279px) {
  .grid-3 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 767px) {
  .grid-3 { grid-template-columns: 1fr; }
}
```

```css
/* Auto-fit: карточки сами добавляют колонку при наличии места */
/* Использовать для AI Recommendations на 2560px+ */
.grid-auto {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--card-gap);
}
```

```css
/* 2 колонки → 1 */
.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--card-gap);
}

@media (max-width: 767px) {
  .grid-2 { grid-template-columns: 1fr; }
}
```

### Stats bar (5 метрик в шапке)

```css
.stats-bar {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--card-gap);
}

@media (max-width: 1279px) {
  .stats-bar { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 767px) {
  .stats-bar { grid-template-columns: repeat(2, 1fr); }
}
```

---

## 5. Typography Tokens

```css
:root {
  --text-xs:   11px;  /* метки, timestamps, badges */
  --text-sm:   13px;  /* secondary text, meta info */
  --text-base: 14px;  /* основной body text */
  --text-md:   16px;  /* заголовки карточек */
  --text-lg:   18px;  /* section headers */
  --text-xl:   24px;  /* page title */
  --text-2xl:  32px;  /* крупные цифры в stats */

  --font-weight-normal:   400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;
  --font-weight-bold:     700;

  --line-height-tight:  1.2;
  --line-height-normal: 1.5;
  --line-height-loose:  1.75;
}
```

**Правила:**
- Шрифт **не масштабируется** с вьюпортом — фиксированные px
- Минимальный размер любого текста в UI — **12px** (читаемость)
- Заголовки карточек — `--text-md`, никогда не обрезаются через ellipsis
- Вторичный текст — `--text-sm`, может быть ellipsis только в таблицах с явным overflow

---

## 6. Component Constraints

### Карточки

```css
.card {
  min-width: 240px;       /* не сжимается ниже */
  /* max-width не нужен если grid настроен правильно */
  padding: var(--card-padding);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
```

### Кнопки

```css
.btn {
  height: 36px;             /* фиксированная высота, не сжимается */
  min-width: 80px;          /* не сжимается до нечитаемого */
  padding: 0 var(--space-4);
  white-space: nowrap;      /* текст кнопки не переносится */
  font-size: var(--text-sm);
}

/* В группе кнопок — не растягиваются на всю ширину карточки */
.btn-group {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;          /* переносятся если не влезают */
}
```

**Правило:** кнопки `width: auto`. Никогда не `width: 100%` если контейнер fluid — иначе кнопка на широком экране занимает полкарточки.

### Таблицы и пайплайны

```css
.table-container {
  overflow-x: auto;         /* горизонтальный скролл внутри, не снаружи */
  min-width: 0;             /* разрешает сжатие grid item */
}

.table {
  min-width: 500px;         /* таблица не сжимается — скролл контейнера */
  width: 100%;
}
```

### Sidebar (правая панель)

```css
.right-panel {
  width: var(--right-panel-width);  /* фиксированная, не fluid */
  min-width: var(--right-panel-width);
  align-self: start;
  position: sticky;
  top: var(--page-padding);         /* прилипает при скролле */
}
```

---

## 7. Border Radius Tokens

```css
:root {
  --radius-xs: 2px;   /* теги, badges */
  --radius-sm: 4px;   /* кнопки, inputs */
  --radius-md: 8px;   /* карточки */
  --radius-lg: 12px;  /* модалки, большие блоки */
  --radius-xl: 16px;  /* специальные блоки */
  --radius-full: 9999px; /* pill badges, аватары */
}
```

---

## 8. Color Tokens

```css
:root {
  /* Backgrounds */
  --color-bg:           #f5f5f5;
  --color-surface:      #ffffff;
  --color-surface-alt:  #f9fafb;

  /* Borders */
  --color-border:       #e5e7eb;
  --color-border-focus: #7c3aed;

  /* Text */
  --color-text-primary:   #111827;
  --color-text-secondary: #6b7280;
  --color-text-muted:     #9ca3af;
  --color-text-inverse:   #ffffff;

  /* Brand */
  --color-accent:       #7c3aed;
  --color-accent-light: #ede9fe;
  --color-accent-dark:  #5b21b6;

  /* States */
  --color-error:        #ef4444;
  --color-error-light:  #fef2f2;
  --color-success:      #22c55e;
  --color-success-light:#f0fdf4;
  --color-warning:      #f59e0b;
  --color-warning-light:#fffbeb;

  /* Priority badges */
  --color-priority-high:   #fecaca;  /* text: #991b1b */
  --color-priority-medium: #fed7aa;  /* text: #9a3412 */
  --color-priority-low:    #d1fae5;  /* text: #065f46 */
}
```

---

## 9. Что масштабируется, что нет

| Элемент | Поведение | Почему |
|---|---|---|
| Page padding | fluid `clamp()` | Адаптация к вьюпорту |
| Section gaps | fluid `clamp()` | Адаптация к вьюпорту |
| Шрифт | фиксированный px | Читаемость важнее density |
| Иконки | фиксированный px | Не теряют форму |
| Высота кнопок | фиксированный px | Touch target |
| Ширина nav | фиксированный px | Навигация всегда читаема |
| Ширина right panel | фиксированный px | Контент панели фиксирован |
| Карточки | fluid в grid, min-width | Grid управляет, не карточка |
| Колонки грида | рефлоу 3→2→1 | Breakpoints |
| Таблицы | overflow-x: auto | Не сжимаются, скроллятся |

---

## 10. Правила которые нельзя нарушать

1. **Никаких магических чисел** — только токены. `padding: 24px` → `padding: var(--space-5)`
2. **Минимальный шрифт 12px** — ни один текст в UI не меньше
3. **Кнопки не растягиваются** — `width: auto`, не `width: 100%`
4. **Заголовки карточек не обрезаются** — перенос строки, не ellipsis
5. **Таблицы в overflow контейнере** — горизонтальный скролл внутри блока
6. **Right panel фиксирован** — не fluid, не сжимается
7. **Grid управляет шириной карточек** — не `max-width` на самой карточке
8. **Breakpoints только в layout файлах** — не в компонентах
9. **Base = 1920px** — дизайн и review на этом разрешении
10. **Fluid паддинги через clamp** — не медиа-квери для spacing

---

## 11. Структура файлов

```
styles/
├── tokens.css          ← spacing, colors, typography, radii
├── reset.css           ← normalize, box-sizing
├── layout.css          ← app-root, app-main, breakpoints
├── grids.css           ← grid-3, grid-2, grid-auto, stats-bar
├── typography.css      ← h1-h6, body, labels, монотипы
└── components/
    ├── card.css
    ├── button.css
    ├── badge.css
    ├── sidebar.css
    ├── table.css
    └── stats-widget.css
```

`main.css`:
```css
@import './tokens.css';    /* всегда первым */
@import './reset.css';
@import './layout.css';
@import './grids.css';
@import './typography.css';
/* компоненты подключаются в своих модулях */
```

---

## 12. Zoom поведение (Ctrl+/−)

При zoom браузера увеличивается effective viewport width — контент должен рефлоуиться как при сужении окна.

- zoom 125% на 1920px → ~1536px → должно работать как на laptop
- zoom 150% на 1920px → ~1280px → рефлоу на tablet layout
- zoom 200% на 1920px → ~960px → рефлоу на mobile layout

Если `clamp()` и breakpoints настроены правильно — zoom работает бесплатно, без дополнительных правил.

---

*Документ обновляется при изменении дизайн-системы. Все компоненты следуют этим правилам без исключений.*
