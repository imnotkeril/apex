# 11 — Image Styles

**Route:** `/content/image-styles`  ·  **ТЗ:** §8.9 (Image Styles tab) + §6.9  ·  **Макет:** `mockup.png`

## Назначение
Управление визуальными стилями и настройками генерации для консистентных изображений. Таблица с превью + правый drawer.

## Блоки макета
1. **Tabs по категории**: All Styles · Charts & Data · Diagrams · Photos · Illustrations · Custom (с counts). Справа `+ New Style`.
2. **Stats row**: Total Styles · Active · Draft · Archived · Consistency Score спарклайн · Images Generated (30d).
3. **Top bar**: Search · фильтры All Categories / All Languages · Sort by · переключатель Grid/List.
4. **Таблица**: Style (иконка + имя + slug) · Category · Description · **Preview** (миниатюра сгенерированного образца) · Used In (N posts) · Languages · Status (Active/Draft/Archived) · Updated · Actions (👁 ✏ ⋮).
5. **Правый drawer (Style Details)**: иконка + имя + статус + Default-бейдж · Description · **Preview** (большой образец) · Settings (Color Scheme / Background / Typography / Grid System / Corner Radius / Shadow / Aspect Ratios) · Used In · Actions: `Edit Style` · `Duplicate Style` · `Archive Style`.

## API (ТЗ §6.9)
- `GET /content/image-style-presets`.
- `POST /content/image-style-presets`.
- `PUT /content/image-style-presets/{id}`.
- `DELETE /content/image-style-presets/{id}`.
- Set Default / генерация превью — связано с image-генерацией пайплайна.

## Состояние кода
Страницы нет — **создать** `content/image-styles/page.tsx` (+ возможно Edit). Превью-миниатюры из сохранённых образцов.

## Acceptance
- Tabs по категориям + Grid/List; превью видны в таблице и drawer.
- Drawer показывает Settings (палитра/типографика/aspect ratios).
- Create/Edit/Duplicate/Archive + Set Default работают.
