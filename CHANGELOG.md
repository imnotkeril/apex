# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project does
not yet have tagged releases — the sections below describe the current state of `develop`.

## [Unreleased]

### Pipeline

- Sources: Telegram (Telethon), RSS, YouTube (transcript with Whisper fallback), web
  articles; manual URL/YouTube/text input via Custom Input.
- AI analysis: summary, tags, and pgvector embeddings generated per raw post.
- Topic clustering with priority/freshness/source-diversity scoring; dismiss/refresh.
- Draft pipeline: research → synthesis → styling → per-platform formatting → translation
  → fact-check → optional image generation, tracked via `pipeline_status` with a per-step
  progress UI.
- AI spend guard: every AI call is metered per org (`ai_usage`), gated against a daily
  budget (`org.settings.ai_daily_limit_usd`, falling back to `MAX_AI_COST_PER_DAY_USD`);
  the router returns `429 AI_QUOTA_EXCEEDED` once the budget is hit.

### Auto Mode

- Org-level config: mode (full auto vs. draft-only), allowed days, publish times, max
  posts/day, allowed tags, target platforms — `GET/PUT /content/auto-mode`,
  `POST /content/auto-mode/{enable,disable}`, `GET /content/auto-mode/preview`.
- Every auto-mode cycle decision (draft started, or slot skipped with a reason) is stored in
  `auto_mode_runs` (migration `005_auto_runs`); `GET /content/auto-mode/activity` serves the
  history and 30-day stats, and the Overview/Rules/Activity tabs render them. No sample data.

### Integrations

- Telegram: real publish (`publish_to_telegram`) and real test-notification send.
- Org-level Integrations panel: paste-in API keys (AI providers, Telegram, Twitter,
  LinkedIn, source-parsing credentials), encrypted at rest, override server env defaults,
  masked once saved.
- LinkedIn and Twitter/X publishing (UGC post; tweet or thread of up to 10) and email via SMTP
  are wired into the publish task. All provider calls are covered by mocked tests only.

### UI (frontend)

- Full page set under `(dashboard)`: Dashboard, Raw Posts, Topic Clusters, Drafts (+
  Create/Edit Draft), Calendar, Knowledge Graph, Published Posts, Sources, Styles &
  Presets, Tags, Image Styles, Auto Mode, Settings, Profile.
- Every list page follows the same pattern: filter rail, table/card list, bulk actions,
  detail panel (inline on wide screens, slide-over drawer below).
- Pages show real data only; an empty backend renders empty states with a next step.
- Google OAuth login screen; `DEV_AUTH` bypass for local development.

### Team / Billing / Notifications (new this cycle)

- **Team & Access**: `GET /orgs/current/users`, `PATCH /orgs/current/users/{id}`
  (role change, activate/deactivate). Admin-only; self-demote/self-deactivate blocked with
  a 400 both client- and server-side.
- **Billing**: plan card honestly labeled "Pro · self-hosted"; live AI spend (today/30d, by
  model, by task) from `GET /content/ai-usage`; editable daily AI budget that immediately
  updates the spend-guard limit.
- **Notifications**: org-level Telegram toggles (`draft_ready`, `published`,
  `pipeline_failed`, `budget_alert` at 80% of daily budget, once per UTC day) stored in
  `org.settings.notifications`; `POST /orgs/current/notifications/test` sends a real
  message. User-level personal delivery-preference toggles on the Profile page.
- **Advanced**: full org content export (`GET /content/export`, alias
  `GET /api/content/export`) as a JSON download; read-only workspace info; link to
  `/llms.txt`.
- **Profile**: Preferences tab (default language/tone/writing style/length) persists to
  `user.preferences` via `PATCH /users/me`; Activity tab shows real counts from
  `/content/my-activity` and recent drafts; Security tab is an honest read-only card (no
  password is ever stored).

### Finish-up pass (2026-10)

- Scheduled publishing: `POST /drafts/{id}/publish` with a future `scheduled_at` creates a
  calendar entry; beat task `publish_due_calendar` (every minute) publishes due entries and
  records published/failed. Cancelling an entry returns the draft to `draft`.
- Email publisher (stdlib SMTP, SSL on 465 / STARTTLS otherwise); SMTP and recipient settings
  live under Settings → Integrations.
- Engagement sync: Twitter/X metrics via the API (daily beat + manual sync); Telegram, LinkedIn
  and email are reported as unsupported instead of being stamped as synced.
- New endpoints: raw-post delete/related/tags, published tags, source status, cluster search,
  draft regenerate (re-runs the whole pipeline), recommendations refresh, graph focus,
  style-preset version history + restore (snapshot on every prompt edit, last 20 kept), draft PDF.
- Draft export: PDF, PPTX (python-pptx; cover, optional chart slide, body slides) and chart PNG
  rendered from `chart_data` (`{type: bar|line|pie, labels, series}`, validated on PATCH). Download
  buttons on the Drafts list.
- Partial regenerate: `steps` now selects pipeline stages (formatting, translation, fact_check,
  image); selecting synthesis/styling re-runs everything because new text invalidates the rest.
- Drafts get related raw/published posts by tag overlap when the pipeline finishes.
- Frontend tests: vitest + Testing Library (`npm test`, 11 tests); added to CI.
- `docker-compose.prod.yml` and a GitHub Actions CI workflow (written, not yet run).

### Docs

- `README.md`, `USER_GUIDE.md`, `CHANGELOG.md` rewritten to cover the full product (was
  foundation-layer only).
- `backend/llms.txt` kept as the single source of truth for the API surface, served live at
  `GET /llms.txt`.

### Known gaps

- Nothing has been run against live Telegram/LinkedIn/Twitter/SMTP/AI accounts; see
  `Docs/plan.md` ("Needs owner") for what must be supplied and verified.
- Production path is written but unrun: no TLS termination, hosting target undecided.
- Nothing in the pipeline generates `chart_data` yet; it is supplied via PATCH /drafts/{id}.
- PDF export needs a Unicode TTF for non-Latin text (DejaVu in the image; CJK needs `APEX_PDF_FONT`).
- Docker image not rebuilt with the new dependencies (reportlab, python-pptx, matplotlib).
- Content tab in Settings is reserved but not yet configurable.
