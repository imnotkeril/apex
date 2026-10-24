# STATE — APEX Content Engine

Append-only progress log. One line per completed step. Next work = first unchecked item in `docs/plan.md`.
On a rate-limit cut or new session: read this file, then `docs/plan.md`, continue with "Next".

## Project
- Family/subtype: webapp / content-automation (FastAPI + Celery + Postgres/pgvector backend, Next.js 14 frontend, Docker Compose)
- Spec: `Docs/APEX_M4_Content_Engine_TZ.md`; page plans `Docs/План/*`; `Docs/SPEC-deferred-sections.md`
- Not a git repo. Work is checkpointed in a shadow repo outside the folder (`--git-dir` in the session scratchpad, branch `develop`); no `.git` was created here. Ask the owner before `git init`.
- Checks (Windows, global Python 3.11 has the deps; pip to PyPI fails with a self-signed-cert error, so no new packages can be installed):
  - backend: `cd backend && python -m pytest -q`
  - frontend: `cd frontend && npx tsc --noEmit && npx next lint && npx next build`

## Baseline (2026-10-24, before any change)
- backend pytest: 44 passed
- frontend tsc: clean; next lint: 0 errors, 1 warning (settings/page.tsx exhaustive-deps); next build: OK (22 pages)

## Log
- [x] adopted — baseline above; findings: CHANGELOG/README are stale (Twitter+LinkedIn publish ARE wired in tasks.py), `scheduled_at` in PublishBody is ignored (no calendar entry, no scheduler), no auto-mode run history, mock fallbacks on list pages, no PDF/PPTX output, email publish missing, several TZ endpoints missing.
- [x] T1 scheduled publishing (calendar entry + minutely beat `publish_due_calendar`, datetime picker) — pytest 50 passed, tsc clean
- [x] T2 auto-mode run history (model+migration 005_auto_runs, cycle records created/skipped, GET /auto-mode/activity, UI tabs read real data, fake rules removed) — pytest 56 passed, tsc+lint clean
- [x] T3 email publisher (stdlib SMTP, org secrets smtp_*/email_recipients, wired into publish_draft_task, mocked tests) — pytest 64 passed
- [x] T5 missing TZ endpoints (router_ext.py: raw delete/related/tags, published tags, source status, clusters/search, drafts regenerate, recommendations/refresh, graph/{id}, style versions+restore with snapshot-on-edit) — pytest 82 passed, routes verified registered
- [x] T6 engagement sync (services/engagement.py: Twitter public_metrics via tweepy, telegram/linkedin/email reported unsupported; real /sync + /sync-all; daily beat sync_engagement_stats) — pytest 92 passed
- [x] T7 PDF export GET /drafts/{id}/pdf (reportlab, unicode font handling) — pytest 98 passed; Docker image NOT rebuilt (reportlab + fonts-dejavu-core unverified in the image)
- [x] T9 prod compose + CI workflow written; docker compose config -q passes, CI not executed, stack not started
- [x] T4 mock/demo fallbacks removed from all list pages, dashboard, calendar, graph (real data or empty/loading/error states); auto-mode platform list now includes email — tsc clean, next lint 0 errors, next build exit 0 (1 baseline warning in settings/page.tsx)
- [x] T8 docs refreshed (README, USER_GUIDE, CHANGELOG, backend/llms.txt)

- [x] second pass: PPTX + chart PNG + partial regenerate + related content + PDF/PPTX UI buttons + vitest (11 tests) + CI step

## Final checks (2026-10-24)
- backend pytest: 120 passed (baseline 44)
- frontend: tsc clean; vitest 11 passed; lint/build see below

## Next
- Owner items in `Docs/plan.md` ("Needs owner")
