# 12 — Auto Mode

**Route:** `/content/auto-mode`  ·  **ТЗ:** §8.9 (Auto Mode tab) + §6.11  ·  **Макет:** `mockup.png`

## Назначение
Автоматизация генерации, оптимизации и публикации по правилам и сигналам. Overview + таблица правил + правый drawer + activity.

## Блоки макета
1. **Tabs**: Overview · Rules · Activity · Settings. Справа `+ Create Rule`.
2. **Status + Stats row**: Auto Mode toggle (Active / Running smoothly) · Content Generated (30d) · Content Published (30d) · Time Saved (30d) · Success Rate (30d) — все со спарклайнами и дельтами.
3. **Auto Mode Rules** (таблица): Rule (иконка + имя + описание + теги-условия) · Trigger & Frequency (расписание + условие, напр. «If trend score > 70») · Channels (иконки платформ +N) · Status (Active/Paused/Inactive) · Last Run · Actions (▶ ✏ ⋮). Внизу `+ Create New Rule`.
4. **Правый drawer (Auto Mode Details)**: статус + started · Description · AI Model (GPT-4o + Change, temperature, max tokens) · Guardrails (Fact check / Brand voice / Duplicate check / Spam filter / Min score / Styles applied / Human review) чеклист · Quick Stats (30d) · Recent Activity · `View Full Activity`.
5. **Auto Mode Activity** (низ): карточки последних запусков правил (что сгенерировано/опубликовано + каналы).

## Auto Mode Settings (ТЗ §8.9)
Enable toggle · publish times · weights sliders · min source count · avoid-repeat hours · default style/image style · auto-translate targets.

## API (ТЗ §6.11)
- `GET /content/auto-mode` — конфиг.
- `PUT /content/auto-mode` — сохранить.
- `POST /content/auto-mode/enable` · `/disable`.
- `GET /content/auto-mode/preview` — что опубликует следующим.
- Правила (rules) — если не покрыто §6.11, добавить backend-эндпоинты CRUD правил.

## Состояние кода
Страницы нет — **создать** `content/auto-mode/page.tsx` с tabs Overview/Rules/Activity/Settings.

## Acceptance
- Master toggle вкл/выкл авто-режим (enable/disable).
- Rules-таблица: pause/run/edit правил; Status отражается.
- Drawer показывает Guardrails + AI Model + Quick Stats.
- Settings сохраняет publish times/weights/targets (PUT auto-mode).
- Preview показывает следующий запланированный авто-пост.
