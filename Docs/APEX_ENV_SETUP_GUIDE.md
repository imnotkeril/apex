# APEX — полная настройка окружения

Этот документ описывает **каждый параметр**, **куда его вписать** и **откуда его взять**. Репозиторий не содержит секретов; значения ты получаешь из своих сервисов или задаёшь сам.

---

## 1. Два способа запуска (не путать)

| Способ | Где лежат переменные | Кому виден Postgres |
|--------|----------------------|---------------------|
| **Docker Compose** (рекомендуется) | Корень репозитория: **`docker.env`**, фронт: **`frontend/.env.docker`** | Хост БД из контейнеров — **`postgres`** (имя сервиса в сети compose) |
| **Без Docker** (uvicorn/alembic на машине) | **`./.env`** в корне (скопировать из `.env.example`) | Хост БД — **`127.0.0.1`** или **`localhost`**, порт **5432** (если Postgres проброшен наружу) |

Ниже по умолчанию разбирается вариант **Docker Compose**, как в `docker-compose.yml`.

---

## 2. `docker.env` (backend, postgres, redis, celery)

Файл **`docker.env`** подключён к сервисам Postgres и backend через `env_file`. Именно его нужно править для поднятия стека командой `docker compose up`.

### 2.1 `POSTGRES_PASSWORD`

- **Что это:** пароль пользователя PostgreSQL `apex_user` (пользователь и база заданы в `docker-compose.yml`).
- **Откуда взять:** придумываешь **сам** (одна строка без пробелов проще всего).
- **Важно:** этот пароль **обязан совпадать** с паролем внутри `DATABASE_URL` (см. ниже). Если они разные — backend не подключится к БД.

### 2.2 `DATABASE_URL`

- **Что это:** строка подключения SQLAlchemy/asyncpg к Postgres.
- **Формат:**

```text
postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DATABASE
```

- **Для этого проекта в Docker (backend/celery внутри compose):**

| Часть | Значение | Почему |
|-------|----------|--------|
| USER | `apex_user` | Задано в `docker-compose.yml` → `POSTGRES_USER` |
| PASSWORD | **тот же**, что в `POSTGRES_PASSWORD` | Один пароль для одной учётки |
| HOST | `postgres` | Имя сервиса в Docker network (не `localhost` из контейнера backend) |
| PORT | `5432` | Стандартный порт Postgres в контейнере |
| DATABASE | `apex` | Задано в `docker-compose.yml` → `POSTGRES_DB` |

**Пример** (подставь свой пароль вместо `YOUR_PASSWORD`):

```text
postgresql+asyncpg://apex_user:YOUR_PASSWORD@postgres:5432/apex
```

- **Если пароль содержит символы `@ : / # ? &`** — их нужно **URL-кодировать** в части пароля (или использовать простой пароль без этих символов).

- **Если запускаешь Alembic/uvicorn на хосте**, а Postgres в Docker с пробросом порта `5432:5432`, хост в URL будет **`127.0.0.1`**, не `postgres`:

```text
postgresql+asyncpg://apex_user:YOUR_PASSWORD@127.0.0.1:5432/apex
```

### 2.3 Redis и Celery

```text
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
```

- **Откуда:** для локального compose это **имена сервисов** из `docker-compose.yml` (`redis`, порт `6379`). Внешние API-ключи не нужны.

---

## 3. Supabase (вход через Google и JWT для API)

Backend проверяет Bearer-токен через **`SUPABASE_JWT_SECRET`**. Фронт ходит в Supabase по URL и anon key.

### 3.1 Где взять значения (Supabase Dashboard)

Открой проект → **Project Settings → API**:

| Переменная в `docker.env` | Поле в Supabase |
|---------------------------|-----------------|
| `SUPABASE_URL` | **Project URL** (`https://xxxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | **anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** (секретный; не вставлять во фронт) |
| `SUPABASE_JWT_SECRET` | **JWT Secret** (раздел JWT / Legacy JWT secret — актуальное название см. в своём проекте) |

`SUPABASE_JWT_SECRET` **должен совпадать** с секретом проекта Supabase, иначе backend ответит **401** при запросах с фронта с токеном пользователя.

### 3.2 Фронтенд (`frontend/.env.docker` или `frontend/.env.local`)

| Переменная | Откуда |
|------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Тот же **Project URL**, что и `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Тот же **anon** ключ |
| `NEXT_PUBLIC_API_URL` | URL бэкенда для браузера: при локальном compose обычно `http://localhost:8000` |

**Нельзя** оставлять заглушки вида `placeholder.supabase.co` — OAuth откроет несуществующий хост.

### 3.3 Google OAuth (Continue with Google)

1. **Google Cloud Console** → APIs & Services → Credentials → OAuth 2.0 Client ID (Web application).
2. В **Authorized redirect URIs** добавь:

```text
https://<PROJECT_REF>.supabase.co/auth/v1/callback
```

(подставь свой ref из URL проекта Supabase.)

3. **Supabase** → Authentication → Providers → **Google**: вставь Client ID и Client Secret из Google Cloud.
4. **Supabase** → Authentication → **URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** `http://localhost:3000/auth/callback`

---

## 4. Ключи AI (опционально, для Content Engine / AIRouter)

Пока ключи пустые, часть функций (анализ текста, черновики, фактчек) **не будет работать**.

| Переменная | Где взять |
|------------|-----------|
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com) → API keys |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com) → API Keys |
| `PERPLEXITY_API_KEY` | Личный кабинет Perplexity API (раздел ключей) |
| `GROK_API_KEY` | Личный кабинет xAI / провайдера Grok |
| `GOOGLE_AI_API_KEY` | Google AI Studio / консоль ключей Google для Gemini |

---

## 5. Telegram (опционально, модуль Content Engine)

| Переменная | Где взять |
|------------|-----------|
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` | [my.telegram.org](https://my.telegram.org) → API development tools |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) → создание бота |
| `TELEGRAM_CHAT_ID` | ID чата/канала получателя (через ботов или Telegram API после первого сообщения боту) |

---

## 6. Прочее приложение

| Переменная | Откуда |
|------------|--------|
| `SECRET_KEY` | Любая длинная случайная строка (генератор паролей / `openssl rand -hex 32`). Не публиковать. |
| `ALLOWED_ORIGINS` | Origin фронта для CORS, например `http://localhost:3000` |
| `DEFAULT_ORG_SLUG`, `DEFAULT_ORG_NAME` | Имя организации по умолчанию для первого входа пользователя (можно оставить как в примере) |
| `MAX_AI_COST_PER_DAY_USD` | Лимит расхода AI в долларах за сутки на организацию |

---

## 7. Порядок действий после заполнения файлов

1. Убедиться, что **`POSTGRES_PASSWORD` и пароль в `DATABASE_URL` совпадают**.
2. Заполнить **реальный** Supabase во **`docker.env`** и **`frontend/.env.docker`**.
3. Запуск:

```bash
docker compose up --build -d
```

4. Миграции:

```bash
docker compose exec backend alembic upgrade head
```

5. Проверки:
   - `curl http://localhost:8000/health`
   - Браузер: `http://localhost:3000`

---

## 8. Частые ошибки

| Симптом | Причина |
|---------|---------|
| Backend не коннектится к Postgres | Разные пароли в `POSTGRES_PASSWORD` и в `DATABASE_URL`; или хост `postgres` используется с хоста машины без Docker |
| `placeholder.supabase.co` в браузере | Во фронте не заменены `NEXT_PUBLIC_SUPABASE_*` на реальный проект |
| 401 на API с фронта | Неверный или старый `SUPABASE_JWT_SECRET`; или не тот проект Supabase |
| OAuth Google редиректит с ошибкой | Не добавлен redirect в Google Console и/или в Supabase URL Configuration |

---

## 9. Связанные файлы в репозитории

- **Шаблон переменных (без секретов):** `.env.example`
- **Docker по умолчанию:** `docker.env` (правь его под себя)
- **Фронт в Docker:** `frontend/.env.docker`
- **Фронт без Docker:** `frontend/.env.local.example` → скопировать в `frontend/.env.local`

Спецификация Foundation также содержит блок про env и OAuth: **`APEX_Foundation_TZ_EN.md`**.
