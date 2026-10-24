# 14 — Profile

**Route:** `/profile`  ·  **ТЗ:** (вне §8 — карточка юзера внизу сайдбара)  ·  **Макет:** `mockup.png`

## Назначение
Профиль пользователя: данные, предпочтения, активность, аккаунт. Открывается из карточки юзера внизу сайдбара. Левая карточка профиля + центр (активность) + правая панель Account & Plan.

## Блоки макета
1. **Tabs**: Overview · Preferences · Security · API & Integrations · Activity · Notifications.
2. **Карточка профиля (лево)**: аватар (с камерой-загрузкой) · имя + @handle + Admin-бейдж · роль-описание · Email · Role · Member Since · Last Active (Online now) · Language · Time Zone · `Edit Profile` · `Change Password`.
3. **Your Activity Overview (центр)**: 5 метрик за 30 дней — Posts Created · Drafts · Topics Owned · AI Generations · Time Saved (с дельтами). Селектор периода (Last 30 Days).
4. **Recently Worked On**: список последних объектов (Topic Cluster / Draft / Published / Analysis) с типом-бейджем и временем + `View All`.
5. **Your Preferences (низ)**: Default Language · Content Tone · Writing Style · Default Length · AI Model · `View All Preferences`.
6. **Правая панель**:
   - **Account & Plan**: org + Manage Team · Current Plan + Upgrade · AI Credits + next reset.
   - **Achievements**: бейджи (Content Creator / Consistency Pro / AI Power User) с датами.
   - **Recent Activity**: лента (created post / published / generated / updated / added source) с временем.

## API
- Foundation: `GET /api/v1/auth` текущий пользователь, профиль/preferences (Foundation §6).
- Метрики активности — агрегаты по drafts/published/clusters пользователя.
- Achievements — backend-расчёт (если нет — отдельная задача).

## Состояние кода
Страницы нет — **создать** `app/profile/page.tsx` (вне `(dashboard)` или внутри — но доступна из карточки сайдбара). Edit Profile / Change Password — модалки или таб Preferences/Security.

## Acceptance
- Карточка профиля + Edit Profile / Change Password работают.
- Activity Overview показывает реальные метрики за период.
- Recently Worked On кликабельно ведёт на объекты.
- Account & Plan + Achievements + Recent Activity заполнены данными.
