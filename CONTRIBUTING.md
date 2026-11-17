# Contributing

Thanks for taking a look. APEX is a self-hosted AI content automation platform (FastAPI, Celery, Next.js); focused fixes with a test are the easiest changes to merge.

## Setup
```bash
# backend
cd backend && pip install -r requirements.txt
python -m pytest -q

# frontend
cd ../frontend && npm ci && npx tsc --noEmit && npm test && npx next lint && npx next build
```
Copy `.env.example` / `docker.env.example` and fill them in if you need to run the stack (see the README). Never commit `.env*` or `docker.env` files or keys.

## Pull requests
- Branch from `develop`; one topic per pull request.
- Add or update a test for every behaviour change.
- Tests, type-check, lint and build must pass; CI runs the same commands.
- Every AI call goes through the AI router so spend is metered per organisation; do not call providers directly.
- Provider calls in tests are mocked; do not add tests that need real API keys.

## Reporting problems
Use the issue templates. For security problems follow [`SECURITY.md`](SECURITY.md) instead of opening a public issue.
