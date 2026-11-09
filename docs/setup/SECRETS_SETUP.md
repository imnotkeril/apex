# APEX — какие ключи нужны и откуда взять

Куда вписывать:
- **Backend + воркеры** → файл `docker.env` (в корне; его читают postgres/backend/celery).
- **Frontend** → `frontend/.env.docker` (docker) и/или `frontend/.env.local` (локальный `npm run dev`).

---

## ✅ Уже готово (трогать не надо)
- Postgres пароль, Redis/Celery URL, `SECRET_KEY` (dev) — заполнены в `docker.env`.
- Postgres-образ `pgvector/pgvector:pg16` → pgvector для кластеров/графа уже есть.
- Инфраструктура (БД, Redis, Celery) поднимается без ключей: `docker compose up --build`.

Архитектура: **Supabase = только авторизация** (Google OAuth + JWT). Данные — в локальном Postgres.

---

## 🔴 Обязательно (без этого не залогиниться / не генерит)

### 1. Supabase (авторизация)
Где: https://supabase.com → **New project** (free tier хватит).
Dashboard → **Project Settings → API**, скопировать 4 значения:

| Значение в Supabase | Куда в `docker.env` | Куда в `frontend/.env.*` |
|---|---|---|
| Project URL | `SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key (секрет!) | `SUPABASE_SERVICE_ROLE_KEY` | — (только backend) |
| JWT Secret (API → JWT Settings) | `SUPABASE_JWT_SECRET` | — |

### 2. Google OAuth (кнопка «Sign in with Google»)
1. https://console.cloud.google.com → **APIs & Services → Credentials → Create OAuth client ID → Web application**.
2. **Authorized redirect URI:** `https://<твой-проект>.supabase.co/auth/v1/callback`
3. Скопировать **Client ID** + **Client Secret**.
4. Supabase → **Authentication → Providers → Google** → вставить Client ID + Secret, включить.
5. Supabase → **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

### 3. AI-ключи (генерация, summary, кластеры, граф)
| Ключ | Зачем | Где взять |
|---|---|---|
| `ANTHROPIC_API_KEY` | **primary** — синтез черновиков, summary, rewrite | https://console.anthropic.com → API Keys |
| `OPENAI_API_KEY` | **fallback + эмбеддинги** (кластеризация, knowledge graph) | https://platform.openai.com/api-keys |

Минимум — **оба**. Без OpenAI-эмбеддингов кластеры/граф работают плохо.

---

## 🟡 Опционально (под конкретные фичи)

| Ключ | Фича | Где взять |
|---|---|---|
| `PERPLEXITY_API_KEY` | «Search by Topic», fact-check | https://www.perplexity.ai/settings/api |
| `GROK_API_KEY` | social monitoring (не ядро M4) | https://x.ai (API) |
| `GOOGLE_AI_API_KEY` | доп. модель Gemini | https://aistudio.google.com/app/apikey |

### Источники / публикация (под каждый канал отдельно)
| Переменные | Для чего | Где взять |
|---|---|---|
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` | парсинг Telegram-каналов (Telethon, user-client) | https://my.telegram.org → API development tools |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | публикация в Telegram | @BotFather → новый бот; chat_id — id канала |
| Twitter/X OAuth | публикация в X | https://developer.x.com |
| LinkedIn OAuth | публикация в LinkedIn | https://www.linkedin.com/developers |
| WordPress URL + App Password | публикация в WordPress | WP-admin → Users → Application Passwords |

---

## 🟢 Минимум чтобы увидеть всё рабочим
1. Supabase: 4 значения (URL, anon, service_role, JWT).
2. Google OAuth подключён в Supabase.
3. `ANTHROPIC_API_KEY` + `OPENAI_API_KEY`.

Telegram и остальные каналы — добавить позже.

---

## Запуск после заполнения
```bash
# 1. вписать ключи в docker.env и frontend/.env.docker
docker compose up --build -d
# 2. миграции БД (001 + 002 + 003)
docker compose exec backend alembic upgrade head
# 3. открыть фронт
# http://localhost:3000  → Sign in with Google
# health бэка: http://localhost:8000/health · доки API: http://localhost:8000/docs
```

## Что мне дать для финальной сверки
Достаточно: Supabase 4 значения + Anthropic + OpenAI ключи. Впишу в `docker.env`/`frontend/.env.*`, подниму стек, прогоню миграции, открою страницы, сверю с макетами, починю расхождения.
> Секреты можно дать прямо здесь — я впишу в env-файлы (они в `.gitignore`, в git не попадут).
