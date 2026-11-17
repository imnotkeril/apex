# Security Policy

## Scope
APEX stores per-organisation third-party credentials (AI provider keys, Telegram and publishing tokens) and publishes content on an organisation's behalf. The backend scopes data by organisation, meters AI spend per organisation and refuses to start in production with `DEV_AUTH=true` or a weak `SECRET_KEY`.

## Reporting a vulnerability
Please do not open a public issue. Use GitHub private reporting: **Security -> Report a vulnerability** at https://github.com/imnotkeril/apex/security/advisories/new.
Include the affected file or endpoint, steps to reproduce and the impact. Expect an acknowledgement within a few days. Maintained on a best-effort basis.

## Supported versions
Only the latest commit on `develop`.

## Hardening notes
- Set `ENVIRONMENT=production` in deployments; use a random `SECRET_KEY` of 32+ characters and keep `DEV_AUTH=false`.
- Never commit `.env` files or `docker.env`; only the `*.example` files (names, no values) are tracked.
- Auth is Google OAuth through Supabase; the backend validates the Supabase JWT on every request.
- Set a daily AI budget per organisation (`ai_daily_limit_usd`) or `MAX_AI_COST_PER_DAY_USD` to bound provider spend.
