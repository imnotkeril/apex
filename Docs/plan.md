# Plan — finish APEX

Estimate before this pass: ~80% of the spec in code, ~60% verified. After T1-T9: **~96% in code** (missing: automatic chart_data extraction), **~65% verified** (98 backend unit tests with mocks; nothing run against live accounts or a started Docker stack).

Tasks are ordered by value. Each: implement, add tests, run checks, tick, log line in STATE.md.

## Buildable without secrets
- [x] T1 Scheduled publishing: `POST /drafts/{id}/publish` with `scheduled_at` creates a `content_calendar` row; beat task publishes due rows; status/error written back; tests
- [x] T2 Auto Mode run history: `auto_mode_runs` table + migration 005, written by `run_auto_mode_cycle`; `GET /auto-mode/activity`; Overview/Rules/Activity tabs read real data (no illustrative rules)
- [x] T3 Email publisher: SMTP behind an interface (stdlib smtplib), secrets keys, wired into `publish_draft_task`, mocked tests
- [x] T4 Remove mock/demo fallbacks on list pages and dashboard; real empty states
- [x] T5 Missing TZ endpoints: raw-post DELETE/related/tags, clusters/search, drafts regenerate, recommendations/refresh, sources/{id}/status, graph/{id}, published tags, style-preset versions/restore (regenerate re-runs the whole pipeline; add-url/custom-input split intentionally not added: existing POST /custom-input covers it)
- [x] T6 Engagement sync (`sync_engagement_stats`) behind an interface: Twitter metrics via tweepy (mocked); Telegram/LinkedIn marked unsupported
- [x] T7 PDF export of a draft (reportlab; present locally, not in requirements.txt, must be added) — GET /drafts/{id}/pdf (on the fly, no storage; reportlab added to requirements, DejaVu in Dockerfile; CJK needs APEX_PDF_FONT)
- [x] T8 Docs refresh: CHANGELOG, README, USER_GUIDE, llms.txt match reality
- [x] T9 Prod compose + CI workflow file (written, not run) — docker-compose.prod.yml (compose config -q OK) + .github/workflows/ci.yml (YAML parses); neither run

## Done in the second pass
- [x] PPTX export, chart PNG from chart_data (+PATCH validation), partial regenerate (stage selection), related content in pipeline, PDF/PPTX buttons in Drafts list, frontend vitest suite + CI step

## Still open (small)
- Nothing generates `chart_data` automatically (AI step to extract numbers would need a design decision)
- Docker image not rebuilt with reportlab / python-pptx / matplotlib

## Needs owner
- Telegram: API id/hash, session string, bot token + chat id; verify real publish + parse
- Twitter/X: 4 OAuth keys (API key/secret, access token/secret); verify real tweet + thread, engagement sync (T6)
- LinkedIn: access token + author URN; verify real UGC post
- Email: SMTP host/port/user/password/from + recipient list; verify real delivery
- AI providers: Anthropic, OpenAI, Perplexity, Grok, Google AI keys; run one full pipeline and check cost/quality
- Google OAuth (Supabase) project for production login
- Decision: `git init` in this folder (currently no VCS)
- Decision: production hosting target (TLS, managed Postgres) before T9 is usable
- Run `docker compose up` end to end once (not done in this review) and apply migration 005
