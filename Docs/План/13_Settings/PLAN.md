# 13 — Settings

**Route:** `/content/settings`  ·  **ТЗ:** §8.9  ·  **Макет:** `mockup.png`

## Назначение
Конфигурация воркспейса, AI-предпочтений, интеграций и системных настроек. Tabs + правая панель Account & Plan / Security / System Info.

## Блоки макета
1. **Tabs**: General · AI & Generation · Content · Integrations · Team & Access · Billing · Notifications · Advanced.
2. **Workspace Settings** (General): Workspace Name · Workspace URL · Default Language · Time Zone · Date Format · Time Format · Workspace Logo (upload) · Favicon (upload).
3. **Content Settings**: Default Post Status · Default Category · Default Author · Default Tags · Duplicate Detection (toggle) · Auto Save (toggle) · Media Optimization (toggle) · Link Checking (toggle).
4. **System Settings**: Data Retention · Storage Region · Export Format · Import Duplicates · API Access (toggle) · System Updates (toggle).
5. **Правая панель**:
   - **Account & Plan**: org + role · Manage Team · Current Plan (Pro) + Upgrade · AI Credits (Monthly) прогресс + next reset.
   - **Security**: Password (last changed) · Two-Factor Authentication (enabled) · Sessions (active).
   - **System Information**: Workspace ID · Created · Region · Version · `View System Status`.
   - **Danger Zone**: Delete Workspace.

## Tabs-подразделы (ТЗ §8.9 связанные)
- **Sources / Tags / Image Styles** вынесены в отдельные страницы сайдбара (см. 08/10/11), но ТЗ §8.9 описывает Settings как контейнер этих вкладок — в текущей навигации это самостоятельные пункты SETTINGS.
- **Integrations / Publishing**: Telegram bot token + channel · Twitter OAuth · LinkedIn OAuth · WordPress URL + credentials.

## API
- Foundation: профиль org/user, обновление воркспейс-настроек (расширить Foundation API §6 ТЗ Foundation).
- `GET/PUT /content/auto-mode` для auto-translate defaults (пересечение с Auto Mode).
- Integrations — хранение платформенных креденшелов (Publishing tab, §8.9).

## Состояние кода
Страницы нет — **создать** `content/settings/page.tsx` с tabs. Начать с General + Content + System; Integrations/Billing/Team — последующими итерациями.

## Acceptance
- Tabs переключают разделы; General сохраняет workspace-настройки.
- Toggles (Duplicate/Auto Save/Media/Link/API) persist.
- Account & Plan показывает план + AI credits; Security — статусы.
- Danger Zone требует подтверждения на Delete Workspace.
