# SPEC: APEX deferred sections + docs + cleanup (2026-07-14)

Approved by user. Excludes: Twitter/LinkedIn publishing, email invites, real payment providers.

## 1. Settings → Team & Access
- List all users of the current org: avatar initials, name, email, role badge, active status, created date.
- Admin can change a member's role (admin / editor / viewer) and deactivate/reactivate a member.
- Current user cannot demote/deactivate themself (guard in UI + backend).
- Acceptance: GET list renders from real API; role change + deactivate persist and survive reload.

## 2. Settings → Billing (AI spend management)
- Plan info card (static "Pro" — single-tenant tool, honest label "self-hosted").
- Real AI spend from /ai-usage: today, 30d, by model, by task.
- Editable daily AI budget (USD): stored in org.settings.ai_daily_limit_usd; backend spend-guard and /ai-usage must respect the org override (fallback to env default).
- Acceptance: changing limit updates /ai-usage daily_limit_usd immediately.

## 3. Settings → Notifications (real Telegram)
- Org-level toggles stored in org.settings.notifications: draft_ready, published, pipeline_failed, budget_alert (80% of daily limit).
- Backend sends messages via existing Telegram bot integration (org integration keys, env fallback) at those pipeline events.
- "Send test notification" button → POST endpoint → real Telegram message.
- Acceptance: with bot configured, test button delivers message; pipeline events fire per toggles (unit-tested via mocked sender).

## 4. Settings → Advanced
- Export all org content (sources, raw posts count, drafts, published, tags) as JSON download — real endpoint.
- Read-only org info: org id, slug, created, current settings JSON (pretty).
- Link to /llms.txt.
- Acceptance: export downloads valid JSON with org-scoped data.

## 5. Profile tabs
- Preferences: default_language, content_tone, writing_style, default_length — persisted to user.preferences via existing PATCH /users/me; Overview cards read the saved values.
- Activity: real /my-activity numbers + recent drafts (existing hooks). 
- Security: honest read-only card (auth method = Google OAuth/dev bypass, no password stored).
- API & Integrations: card linking to Settings → Integrations.
- Notifications: user-level toggles saved to user.preferences.notifications (informational until user-level routing exists; labelled as org defaults applying).

## 6. Docs (EN, committed at repo root)
- README.md: what APEX is, architecture overview, stack, quickstart (docker compose), env setup, key URLs.
- USER_GUIDE.md: page-by-page guide of the app.
- CHANGELOG.md: current state summary.
- /llms.txt: served by backend at GET /llms.txt (plain text, describes API surface); source file backend/llms.txt.

## 7. Cleanup (по шаблонам)
- Remove dead files (components/layout/topbar.tsx — unused).
- ESLint/tsc clean; docker build clean.
- docs/ stays internal (planning docs).

## API contract (frozen for parallel build)
- GET  /api/v1/orgs/current/users → UserProfile[]
- PATCH /api/v1/orgs/current/users/{user_id} body {role?: "admin"|"editor"|"viewer", is_active?: bool} → UserProfile; 403 if actor not admin; 400 if self-demote/self-deactivate.
- POST /api/v1/orgs/current/notifications/test → {ok: true} (sends Telegram test msg; 400 if bot not configured).
- GET  /api/content/export → application/json download {org, sources[], drafts[], published[], tags[], exported_at}.
- GET  /llms.txt → text/plain.
- Org settings keys: ai_daily_limit_usd (number), notifications {draft_ready, published, pipeline_failed, budget_alert: bool}.
- User preferences keys: default_language, content_tone, writing_style, default_length, notifications {…}.
