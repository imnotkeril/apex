# APEX — Foundation
### Technical Specification | v1.0 | 2025

---

## 0. What Is the Foundation and Why It Matters

The foundation is a set of base services and layers that exist **before** any module (M1–M6) and are shared by all modules without duplication.

Without the foundation, each module writes its own auth logic, its own AI client, its own database connection — and that is exactly why the previous attempt "didn't work". When something changes in one place, it breaks in three others.

**The foundation solves this once. Modules use what's already there.**

```
┌─────────────────────────────────────────────────────┐
│                   APEX MODULES                      │
│   M1  │  M2  │  M3  │  M4  │  M5  │  M6            │
└───────┴──────┴──────┴──────┴──────┴────────────────┘
┌─────────────────────────────────────────────────────┐
│                  FOUNDATION                         │
│                                                     │
│  Auth & Users  │  AI Router  │  Job Queue           │
│  Database ORM  │  Config     │  Error Handling      │
│  Logging       │  Core API   │  Docker Setup        │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│               INFRASTRUCTURE                        │
│  PostgreSQL  │  Redis  │  Docker Compose            │
└─────────────────────────────────────────────────────┘
```

---

## 1. Tech Stack

### 1.1 Full List with Rationale

| Component | Technology | Version | Why |
|-----------|-----------|---------|-----|
| Backend language | Python | 3.12+ | Best ecosystem for AI/ML tasks |
| Backend framework | FastAPI | 0.110+ | Async, auto-docs, fast |
| ORM | SQLAlchemy | 2.0+ | Database access via Python objects |
| DB migrations | Alembic | latest | Schema versioning |
| Database | PostgreSQL | 16+ | Primary data store |
| Cache & queues | Redis | 7+ | Fast cache + background job queue |
| Background tasks | Celery | 5+ | Async tasks (AI calls, parsing) |
| Auth provider | Supabase Auth | latest | Google OAuth + session management |
| Frontend | Next.js | 14+ | React framework with SSR |
| Styling | Tailwind CSS | 3+ | Utility-first CSS |
| Containers | Docker + Compose | latest | Isolation, reproducibility, persistence |
| Validation | Pydantic | 2.0+ | Data validation in FastAPI |
| HTTP client | httpx | latest | Async HTTP requests to external APIs |
| Logging | structlog | latest | Structured JSON logs |
| Environment vars | python-dotenv | latest | Secrets management |

### 1.2 Why These Tools Specifically

**Supabase Auth instead of custom auth** — Google OAuth out of the box, user management via UI, JWT tokens ready to use. No need to write and maintain auth logic yourself. Free tier is sufficient to start.

**Celery + Redis instead of simple background tasks** — FastAPI `BackgroundTasks` do not survive a restart. Celery tasks are persistent: if the container crashes during an AI request, the task is not lost.

**SQLAlchemy 2.0** — new async syntax, compatible with modern FastAPI.

---

## 2. Project Structure

Complete file tree to create:

```
apex/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    ← FastAPI entry point
│   │   │
│   │   ├── core/                      ← FOUNDATION
│   │   │   ├── __init__.py
│   │   │   ├── config.py              ← all settings from .env
│   │   │   ├── database.py            ← PostgreSQL connection
│   │   │   ├── redis.py               ← Redis connection
│   │   │   ├── auth.py                ← Supabase Auth middleware
│   │   │   ├── ai_router.py           ← unified client for all AI APIs
│   │   │   ├── celery_app.py          ← Celery configuration
│   │   │   ├── exceptions.py          ← custom exceptions
│   │   │   ├── logging.py             ← structlog configuration
│   │   │   └── dependencies.py        ← FastAPI dependencies (get_db, get_user)
│   │   │
│   │   ├── models/                    ← SQLAlchemy models (DB tables)
│   │   │   ├── __init__.py
│   │   │   ├── base.py                ← base model with id, created_at
│   │   │   ├── user.py                ← users and organisations
│   │   │   └── company.py             ← central companies table
│   │   │
│   │   ├── schemas/                   ← Pydantic schemas (API validation)
│   │   │   ├── __init__.py
│   │   │   ├── common.py              ← shared schemas (pagination, response)
│   │   │   └── user.py
│   │   │
│   │   ├── api/                       ← API routes
│   │   │   ├── __init__.py
│   │   │   ├── router.py              ← main router (mounts all modules)
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py            ← /api/v1/auth/*
│   │   │       ├── users.py           ← /api/v1/users/*
│   │   │       └── companies.py       ← /api/v1/companies/* (basic CRUD)
│   │   │
│   │   └── modules/                   ← MODULES GO HERE
│   │       ├── __init__.py
│   │       └── .gitkeep               ← empty folder, modules added later
│   │
│   ├── alembic/                       ← DB migrations
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/                  ← migration files (auto-generated)
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_health.py             ← basic tests
│   │
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                 ← root layout
│   │   ├── page.tsx                   ← home page (redirect)
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx           ← Google login page
│   │   └── (dashboard)/
│   │       ├── layout.tsx             ← layout with sidebar
│   │       └── page.tsx               ← dashboard (empty, filled per module)
│   │
│   ├── components/
│   │   ├── ui/                        ← base UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── input.tsx
│   │   └── layout/
│   │       ├── sidebar.tsx
│   │       └── topbar.tsx
│   │
│   ├── lib/
│   │   ├── api.ts                     ← backend API client
│   │   ├── auth.ts                    ← Supabase Auth client
│   │   └── utils.ts
│   │
│   ├── middleware.ts                  ← route protection (redirect if not logged in)
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.local.example
│
├── docker-compose.yml                 ← main startup file
├── docker-compose.dev.yml             ← dev override
├── .env.example                       ← all environment variables
├── .gitignore
└── README.md
```

---

## 3. Docker and Data Persistence

### 3.1 How Docker Compose Works for This Project

Docker Compose runs multiple containers as a single system. The critical rule: **data is stored in volumes, not in containers**. A container can be deleted and recreated — data remains in the volume on disk.

### 3.2 `docker-compose.yml`

```yaml
version: '3.9'

services:

  # ─── DATABASE ─────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: apex_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: apex
      POSTGRES_USER: apex_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}     # from .env file
    volumes:
      - postgres_data:/var/lib/postgresql/data    # ← data stored here
    ports:
      - "5432:5432"                               # accessible from local machine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U apex_user -d apex"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── REDIS ────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: apex_redis
    restart: unless-stopped
    command: redis-server --appendonly yes        # Redis persistence enabled
    volumes:
      - redis_data:/data                          # ← data stored here
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── BACKEND API ──────────────────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: apex_backend
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app                            # live reload in development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  # ─── CELERY WORKER ────────────────────────────────────────
  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: apex_celery_worker
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./backend:/app
    depends_on:
      - redis
      - postgres
    command: celery -A app.core.celery_app worker --loglevel=info --concurrency=4

  # ─── CELERY BEAT (scheduler) ──────────────────────────────
  celery_beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: apex_celery_beat
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./backend:/app
    depends_on:
      - redis
      - postgres
    command: celery -A app.core.celery_app beat --loglevel=info

  # ─── FRONTEND ─────────────────────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: apex_frontend
    restart: unless-stopped
    env_file:
      - frontend/.env.local
    ports:
      - "3000:3000"
    depends_on:
      - backend
    command: npm run dev

# ─── VOLUMES (data stores) ────────────────────────────────────
volumes:
  postgres_data:    # PostgreSQL data — survives container stop
  redis_data:       # Redis data — survives container stop
```

### 3.3 Management Commands

```bash
# Start everything (first time or after changes)
docker compose up --build -d

# Start without rebuilding (normal startup)
docker compose up -d

# Stop (data is preserved)
docker compose down

# Stop AND delete all data (careful!)
docker compose down -v

# View logs
docker compose logs -f backend
docker compose logs -f celery_worker

# Enter a container
docker compose exec backend bash

# Apply DB migrations
docker compose exec backend alembic upgrade head

# Check container status
docker compose ps
```

---

## 4. Environment Variables

### 4.1 `.env` file (project root, for backend and docker)

```bash
# ─── DATABASE ─────────────────────────────────────────────
POSTGRES_PASSWORD=your_strong_password_here
DATABASE_URL=postgresql+asyncpg://apex_user:your_strong_password_here@postgres:5432/apex

# ─── REDIS ────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# ─── SUPABASE AUTH ────────────────────────────────────────
# Get from: https://supabase.com → your project → Settings → API
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-dashboard

# ─── AI API KEYS ──────────────────────────────────────────
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
GROK_API_KEY=xai-...
GOOGLE_AI_API_KEY=AIza...

# ─── APP SETTINGS ─────────────────────────────────────────
ENVIRONMENT=development        # development / production
SECRET_KEY=random-64-char-string-for-signing
DEBUG=true
ALLOWED_ORIGINS=http://localhost:3000

# ─── COST CONTROLS ────────────────────────────────────────
MAX_AI_COST_PER_DAY_USD=20.0   # alert if AI spend exceeds $20/day
```

### 4.2 `frontend/.env.local`

```bash
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Supabase (same values as backend)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4.3 How to Get Each API Key

**OpenAI:**
1. platform.openai.com → API Keys → Create new secret key
2. Copy immediately — it won't be shown again

**Anthropic (Claude):**
1. console.anthropic.com → API Keys → Create Key
2. Copy immediately

**Perplexity:**
1. perplexity.ai → Settings → API → Generate
2. Paid plan required for API access (from $20/month)

**Grok (xAI):**
1. console.x.ai → API Keys
2. Currently in beta — may require access request

**Google AI (Gemini/Imagen):**
1. aistudio.google.com → Get API Key → Create API key
2. Free tier available

**Supabase:**
1. supabase.com → New Project
2. Settings → API → copy URL, anon key, service_role key
3. Authentication → Providers → Google → enable, paste Google Client ID and Secret
4. For Google Client ID: console.cloud.google.com → Credentials → OAuth 2.0

---

## 5. Database — Foundation Schema

### 5.1 Base Model (inherited by all tables)

```python
# backend/app/models/base.py

import uuid
from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    """Mixin: automatic created_at and updated_at fields"""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )


class UUIDMixin:
    """Mixin: UUID primary key"""
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
```

### 5.2 `organisations` table (multi-tenancy)

```sql
-- Organisation = one account / data workspace
-- When APEX becomes SaaS, each paying customer = one organisation
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,         -- URL-friendly ID: 'my-company'
  plan TEXT DEFAULT 'free',          -- 'free', 'pro', 'enterprise'
  settings JSONB DEFAULT '{}',       -- organisation-level settings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3 `users` table

```sql
-- Users belong to organisations
-- auth_id is the UUID from Supabase Auth
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE NOT NULL,      -- Supabase Auth user ID
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'member',        -- 'owner', 'admin', 'member'
  is_active BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
```

### 5.4 `companies` table (central object)

```sql
-- All companies are isolated by org_id
-- A company belonging to one org is not visible to another
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  domain TEXT,

  -- Profile
  industry TEXT,
  sub_industry TEXT,
  size TEXT,                         -- 'startup', 'smb', 'mid-market', 'enterprise'
  employee_count INTEGER,
  location TEXT,
  country TEXT,
  description TEXT,
  founded_year INTEGER,

  -- Links
  linkedin_url TEXT,
  twitter_handle TEXT,
  website_url TEXT,

  -- Scores (updated by modules)
  icp_fit_score INTEGER DEFAULT 0,   -- populated by M2
  contact_score INTEGER DEFAULT 0,   -- populated by M1

  -- Status and source
  status TEXT DEFAULT 'lead',        -- 'lead', 'prospect', 'customer', 'lost', 'not_fit'
  source TEXT DEFAULT 'manual',      -- 'manual', 'prospecting', 'autopilot', 'import'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_enriched_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,

  -- Domain uniqueness within an organisation
  CONSTRAINT unique_domain_per_org UNIQUE (org_id, domain)
);

CREATE INDEX idx_companies_org_id ON companies(org_id);
CREATE INDEX idx_companies_domain ON companies(org_id, domain);
CREATE INDEX idx_companies_status ON companies(org_id, status);
CREATE INDEX idx_companies_score ON companies(org_id, contact_score DESC);
```

### 5.5 `ai_usage` table (cost tracking)

```sql
-- Every AI request is logged for cost control
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  user_id UUID REFERENCES users(id),

  -- Request
  model TEXT NOT NULL,               -- 'claude-sonnet-4-5', 'gpt-4o', 'sonar-pro'
  task_type TEXT NOT NULL,           -- 'company_research', 'text_generation', etc.
  module TEXT,                       -- 'M1', 'M2', 'M3', etc.

  -- Tokens and cost
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,

  -- Result
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  duration_ms INTEGER,               -- how long the request took in milliseconds

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_org_date ON ai_usage(org_id, created_at DESC);
CREATE INDEX idx_ai_usage_model ON ai_usage(model, created_at DESC);
```

---

## 6. Backend — Core Files

### 6.1 `backend/app/core/config.py`

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Database
    DATABASE_URL: str
    POSTGRES_PASSWORD: str

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    # AI API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    PERPLEXITY_API_KEY: str = ""
    GROK_API_KEY: str = ""
    GOOGLE_AI_API_KEY: str = ""

    # Cost controls
    MAX_AI_COST_PER_DAY_USD: float = 20.0

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
```

### 6.2 `backend/app/core/database.py`

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import settings

# Create async PostgreSQL engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,           # log SQL queries in development
    pool_pre_ping=True,            # verify connection before use
    poolclass=NullPool if settings.ENVIRONMENT == "test" else None,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,        # objects remain accessible after commit
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    """
    FastAPI dependency.
    Usage in routes: db: AsyncSession = Depends(get_db)
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### 6.3 `backend/app/core/ai_router.py`

The most important file in the foundation. Single entry point for all AI calls.

```python
import time
import httpx
from enum import Enum
from typing import Any
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class AIModel(str, Enum):
    # Claude
    CLAUDE_SONNET = "claude-sonnet-4-5"
    CLAUDE_HAIKU = "claude-haiku-4-5-20251001"
    # OpenAI
    GPT4O = "gpt-4o"
    GPT4O_MINI = "gpt-4o-mini"
    # Perplexity
    PERPLEXITY_SONAR = "sonar"
    PERPLEXITY_SONAR_PRO = "sonar-pro"
    # Grok
    GROK = "grok-3"


class TaskType(str, Enum):
    COMPANY_RESEARCH = "company_research"
    TRIGGER_ANALYSIS = "trigger_analysis"
    TEXT_GENERATION = "text_generation"
    CONTENT_SYNTHESIS = "content_synthesis"
    ICP_BUILDING = "icp_building"
    LEAD_SCORING = "lead_scoring"
    DEAL_SCORING = "deal_scoring"
    MEETING_NOTES = "meeting_notes"
    SOCIAL_MONITORING = "social_monitoring"
    SUMMARY = "summary"
    IMAGE_GENERATION = "image_generation"


# Routing table: task → primary model → fallback
ROUTING_TABLE: dict[TaskType, dict] = {
    TaskType.COMPANY_RESEARCH:  {"primary": AIModel.PERPLEXITY_SONAR_PRO, "fallback": AIModel.GPT4O},
    TaskType.TRIGGER_ANALYSIS:  {"primary": AIModel.PERPLEXITY_SONAR_PRO, "fallback": AIModel.GPT4O},
    TaskType.TEXT_GENERATION:   {"primary": AIModel.CLAUDE_SONNET,         "fallback": AIModel.GPT4O},
    TaskType.CONTENT_SYNTHESIS: {"primary": AIModel.CLAUDE_SONNET,         "fallback": AIModel.GPT4O},
    TaskType.ICP_BUILDING:      {"primary": AIModel.CLAUDE_SONNET,         "fallback": AIModel.GPT4O},
    TaskType.LEAD_SCORING:      {"primary": AIModel.CLAUDE_SONNET,         "fallback": AIModel.GPT4O},
    TaskType.DEAL_SCORING:      {"primary": AIModel.CLAUDE_SONNET,         "fallback": AIModel.GPT4O},
    TaskType.MEETING_NOTES:     {"primary": AIModel.CLAUDE_SONNET,         "fallback": AIModel.GPT4O},
    TaskType.SOCIAL_MONITORING: {"primary": AIModel.GROK,                  "fallback": AIModel.PERPLEXITY_SONAR},
    TaskType.SUMMARY:           {"primary": AIModel.CLAUDE_HAIKU,          "fallback": AIModel.GPT4O_MINI},
}

# Cost per 1000 tokens (input / output) in USD
MODEL_COSTS: dict[str, dict] = {
    "claude-sonnet-4-5":          {"input": 0.003,  "output": 0.015},
    "claude-haiku-4-5-20251001":  {"input": 0.00025,"output": 0.00125},
    "gpt-4o":                     {"input": 0.0025, "output": 0.01},
    "gpt-4o-mini":                {"input": 0.00015,"output": 0.0006},
    "sonar":                      {"input": 0.001,  "output": 0.001},
    "sonar-pro":                  {"input": 0.003,  "output": 0.015},
    "grok-3":                     {"input": 0.003,  "output": 0.015},
}


class AIRouter:
    """
    Single entry point for all AI requests in APEX.
    Automatically selects model, handles fallback, logs cost.

    Usage in modules:
        from app.core.ai_router import ai_router, TaskType
        result = await ai_router.complete(
            task_type=TaskType.TEXT_GENERATION,
            system_prompt="...",
            user_prompt="...",
            org_id=org_id
        )
    """

    def __init__(self):
        self._claude = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self._openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def complete(
        self,
        task_type: TaskType,
        user_prompt: str,
        system_prompt: str = "",
        max_tokens: int = 2000,
        org_id: str | None = None,
        user_id: str | None = None,
        force_model: AIModel | None = None,
    ) -> dict[str, Any]:
        """
        Execute an AI request.

        Returns:
            {
                "content": str,          # model response
                "model": str,            # which model responded
                "input_tokens": int,
                "output_tokens": int,
                "cost_usd": float,
                "duration_ms": int,
            }
        """
        model = force_model or ROUTING_TABLE[task_type]["primary"]
        fallback = ROUTING_TABLE[task_type].get("fallback")

        start_time = time.time()

        try:
            result = await self._call_model(model, system_prompt, user_prompt, max_tokens)
        except Exception as e:
            logger.warning(f"Primary model {model} failed: {e}. Trying fallback {fallback}")
            if fallback:
                result = await self._call_model(fallback, system_prompt, user_prompt, max_tokens)
                result["used_fallback"] = True
            else:
                raise

        result["duration_ms"] = int((time.time() - start_time) * 1000)
        result["cost_usd"] = self._calculate_cost(
            result["model"], result["input_tokens"], result["output_tokens"]
        )

        # Log usage (saved to DB via Celery to avoid blocking the request)
        logger.info(
            "ai_request_completed",
            model=result["model"],
            task_type=task_type,
            cost_usd=result["cost_usd"],
            duration_ms=result["duration_ms"],
        )

        return result

    async def _call_model(
        self,
        model: AIModel,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int,
    ) -> dict:
        """Call a specific model"""

        if model in (AIModel.CLAUDE_SONNET, AIModel.CLAUDE_HAIKU):
            return await self._call_claude(model, system_prompt, user_prompt, max_tokens)

        elif model in (AIModel.GPT4O, AIModel.GPT4O_MINI):
            return await self._call_openai(model, system_prompt, user_prompt, max_tokens)

        elif model in (AIModel.PERPLEXITY_SONAR, AIModel.PERPLEXITY_SONAR_PRO):
            return await self._call_perplexity(model, system_prompt, user_prompt, max_tokens)

        elif model == AIModel.GROK:
            return await self._call_grok(system_prompt, user_prompt, max_tokens)

        else:
            raise ValueError(f"Unknown model: {model}")

    async def _call_claude(self, model, system_prompt, user_prompt, max_tokens) -> dict:
        response = await self._claude.messages.create(
            model=model.value,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return {
            "content": response.content[0].text,
            "model": model.value,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }

    async def _call_openai(self, model, system_prompt, user_prompt, max_tokens) -> dict:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})

        response = await self._openai.chat.completions.create(
            model=model.value,
            max_tokens=max_tokens,
            messages=messages,
        )
        return {
            "content": response.choices[0].message.content,
            "model": model.value,
            "input_tokens": response.usage.prompt_tokens,
            "output_tokens": response.usage.completion_tokens,
        }

    async def _call_perplexity(self, model, system_prompt, user_prompt, max_tokens) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model.value,
                    "max_tokens": max_tokens,
                    "messages": [
                        {"role": "system", "content": system_prompt or "Be precise and concise."},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "content": data["choices"][0]["message"]["content"],
                "model": model.value,
                "input_tokens": data.get("usage", {}).get("prompt_tokens", 0),
                "output_tokens": data.get("usage", {}).get("completion_tokens", 0),
            }

    async def _call_grok(self, system_prompt, user_prompt, max_tokens) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.x.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "grok-3",
                    "max_tokens": max_tokens,
                    "messages": [
                        {"role": "system", "content": system_prompt or "Be precise."},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "content": data["choices"][0]["message"]["content"],
                "model": AIModel.GROK.value,
                "input_tokens": data.get("usage", {}).get("prompt_tokens", 0),
                "output_tokens": data.get("usage", {}).get("completion_tokens", 0),
            }

    def _calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        costs = MODEL_COSTS.get(model, {"input": 0, "output": 0})
        return (input_tokens / 1000 * costs["input"]) + (output_tokens / 1000 * costs["output"])


# Singleton — one instance for the entire application
ai_router = AIRouter()
```

### 6.4 `backend/app/core/auth.py`

```python
import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.config import settings
from app.models.user import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: AsyncSession = ...,   # injected via Depends in dependencies.py
) -> User:
    """
    Middleware for verifying Supabase JWT tokens.
    Usage in routes: current_user: User = Depends(get_current_user)
    """
    token = credentials.credentials

    try:
        # Decode the JWT token from Supabase
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        auth_id: str = payload.get("sub")
        if not auth_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no subject"
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    # Look up the user in our DB by auth_id from Supabase
    result = await db.execute(
        select(User).where(User.auth_id == auth_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return user
```

### 6.5 `backend/app/core/celery_app.py`

```python
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "apex",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task behavior
    task_acks_late=True,           # acknowledge task only after completion
    task_reject_on_worker_lost=True,

    # Schedule (extended by each module)
    beat_schedule={
        # M1 will add: "intelligence.daily_refresh"
        # M4 will add: "content.parse_sources"
        # M6 will add: "autopilot.daily_cycle"
    },

    # Queue routing
    task_routes={
        "app.modules.*.tasks.*": {"queue": "modules"},
        "app.core.*": {"queue": "core"},
    },
)

# Auto-discover tasks in modules
celery_app.autodiscover_tasks([
    "app.core",
    # Modules added here as they are built:
    # "app.modules.intelligence",
    # "app.modules.content",
])
```

### 6.6 `backend/app/core/exceptions.py`

```python
from fastapi import HTTPException, status


class ApexException(Exception):
    """Base APEX exception"""
    def __init__(self, message: str, code: str = "APEX_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


class AIRouterException(ApexException):
    """AI Router error — all models unavailable"""
    def __init__(self, task_type: str):
        super().__init__(
            message=f"All AI models failed for task: {task_type}",
            code="AI_ALL_MODELS_FAILED"
        )


class AIQuotaExceededException(ApexException):
    """Daily AI spend limit exceeded"""
    def __init__(self, current_cost: float, limit: float):
        super().__init__(
            message=f"Daily AI cost limit exceeded: ${current_cost:.2f} / ${limit:.2f}",
            code="AI_QUOTA_EXCEEDED"
        )


class ResourceNotFoundException(ApexException):
    """Resource not found"""
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            message=f"{resource} with id {resource_id} not found",
            code="NOT_FOUND"
        )


class PermissionDeniedException(ApexException):
    """No access to resource"""
    def __init__(self, resource: str):
        super().__init__(
            message=f"Access denied to {resource}",
            code="PERMISSION_DENIED"
        )


def register_exception_handlers(app):
    """Register exception handlers in FastAPI"""
    from fastapi.responses import JSONResponse

    @app.exception_handler(ApexException)
    async def apex_exception_handler(request, exc: ApexException):
        return JSONResponse(
            status_code=400,
            content={"error": exc.code, "message": exc.message}
        )

    @app.exception_handler(ResourceNotFoundException)
    async def not_found_handler(request, exc: ResourceNotFoundException):
        return JSONResponse(
            status_code=404,
            content={"error": exc.code, "message": exc.message}
        )

    @app.exception_handler(PermissionDeniedException)
    async def permission_handler(request, exc: PermissionDeniedException):
        return JSONResponse(
            status_code=403,
            content={"error": exc.code, "message": exc.message}
        )
```

### 6.7 `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.api.router import api_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="APEX API",
        version="1.0.0",
        docs_url="/docs" if settings.DEBUG else None,   # Swagger in dev only
        redoc_url="/redoc" if settings.DEBUG else None,
    )

    # CORS — allow requests from frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount routes
    app.include_router(api_router, prefix="/api/v1")

    # Register error handlers
    register_exception_handlers(app)

    # Health check (no auth required)
    @app.get("/health")
    async def health():
        return {"status": "ok", "version": "1.0.0"}

    return app


app = create_app()
```

---

## 7. Database Migrations (Alembic)

### 7.1 `alembic.ini`

```ini
[alembic]
script_location = alembic
sqlalchemy.url =    # leave empty — taken from env.py

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

### 7.2 `alembic/env.py`

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.core.config import settings
from app.models.base import Base
# Import all models so Alembic can see them
from app.models import user, company   # noqa

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

### 7.3 Alembic Commands

```bash
# Create a new migration (after changing models)
docker compose exec backend alembic revision --autogenerate -m "add_companies_table"

# Apply all pending migrations
docker compose exec backend alembic upgrade head

# Roll back the last migration
docker compose exec backend alembic downgrade -1

# Check current version
docker compose exec backend alembic current

# View migration history
docker compose exec backend alembic history
```

---

## 8. How Modules Plug Into the Foundation

This is the key point. Each module is a folder inside `app/modules/`. It does **not create** its own DB connections, Redis connections, or AI clients. It **imports** ready-made ones from `app/core/`.

### 8.1 New Module Structure

```
app/modules/content/           ← example: M4 Content Engine
├── __init__.py
├── router.py                  ← module API endpoints
├── service.py                 ← business logic
├── tasks.py                   ← Celery tasks
├── models.py                  ← SQLAlchemy models (new tables)
└── schemas.py                 ← Pydantic schemas
```

### 8.2 How a Module Uses the Foundation

```python
# app/modules/content/service.py

from app.core.ai_router import ai_router, TaskType      # ← AI Router from foundation
from app.core.database import get_db                    # ← DB from foundation
from app.core.exceptions import ResourceNotFoundException # ← errors from foundation
from app.models.base import Base                        # ← base model

class ContentService:
    async def synthesize(self, source_ids: list, org_id: str, db):
        # Uses ai_router — does NOT create its own AI client
        result = await ai_router.complete(
            task_type=TaskType.CONTENT_SYNTHESIS,
            system_prompt="...",
            user_prompt="...",
            org_id=org_id,
        )
        return result["content"]
```

```python
# app/modules/content/router.py

from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, get_db  # ← from foundation
from app.models.user import User

router = APIRouter(prefix="/content", tags=["content"])

@router.post("/synthesize")
async def synthesize_content(
    current_user: User = Depends(get_current_user),  # ← auth from foundation
    db = Depends(get_db),                            # ← DB from foundation
):
    # ... module logic
```

```python
# app/api/router.py — main router mounts all modules

from fastapi import APIRouter
from app.api.v1 import auth, users, companies

# Foundation routes
api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])

# Modules are added here as they are built:
# from app.modules.content import router as content_router
# api_router.include_router(content_router.router, prefix="/content")
#
# from app.modules.intelligence import router as intel_router
# api_router.include_router(intel_router.router, prefix="/intelligence")
```

---

## 9. Supabase Auth — Google OAuth Setup

### 9.1 Google Cloud Console Setup

1. Go to console.cloud.google.com
2. Create a new project or select an existing one
3. Navigate to: APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
4. Application type: Web application
5. Name: APEX
6. Authorised JavaScript origins: `http://localhost:3000`
7. Authorised redirect URIs: `https://[YOUR_SUPABASE_PROJECT].supabase.co/auth/v1/callback`
8. Copy the Client ID and Client Secret

### 9.2 Supabase Dashboard Setup

1. Go to supabase.com → your project
2. Authentication → Providers → Google
3. Enable Google provider
4. Paste the Client ID and Client Secret from the step above
5. Save

### 9.3 Frontend — Google Sign-In

```typescript
// frontend/lib/auth.ts

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
```

```typescript
// frontend/app/(auth)/login/page.tsx

'use client'
import { signInWithGoogle } from '@/lib/auth'

export default function LoginPage() {
  return (
    <div>
      <h1>APEX</h1>
      <button onClick={signInWithGoogle}>
        Continue with Google
      </button>
    </div>
  )
}
```

```typescript
// frontend/app/auth/callback/route.ts
// Supabase redirects here after Google OAuth

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
}
```

```typescript
// frontend/middleware.ts
// Protects all routes except /login

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res })
  const { data: { session } } = await supabase.auth.getSession()

  // Not logged in and not on login page — redirect to login
  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in and on login page — redirect to dashboard
  if (session && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

---

## 10. requirements.txt

```txt
# Framework
fastapi==0.110.0
uvicorn[standard]==0.27.0

# Database
sqlalchemy==2.0.27
asyncpg==0.29.0         # async PostgreSQL driver
alembic==1.13.1

# Validation & Settings
pydantic==2.6.1
pydantic-settings==2.2.1

# Auth
PyJWT==2.8.0
supabase==2.3.4

# AI Clients
anthropic==0.20.0
openai==1.12.0
httpx==0.26.0           # for Perplexity and Grok (no official SDKs)

# Queue & Cache
celery==5.3.6
redis==5.0.1

# Logging
structlog==24.1.0

# Utils
python-dotenv==1.0.1
```

---

## 11. Backend Dockerfile

```dockerfile
# backend/Dockerfile

FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Port
EXPOSE 8000

# Default command (overridden in docker-compose.yml)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 12. Step-by-Step Setup and Launch

### Step 1: Prepare the repository

```bash
mkdir apex && cd apex
git init
```

### Step 2: Create folder structure

```bash
mkdir -p backend/app/{core,models,schemas,api/v1,modules}
mkdir -p backend/alembic/versions
mkdir -p backend/tests
mkdir -p frontend/app/{(auth)/login,(dashboard),auth/callback}
mkdir -p frontend/{components/{ui,layout},lib}
```

### Step 3: Create the `.env` file

```bash
cp .env.example .env
# Open .env and fill in all keys
```

### Step 4: Configure Supabase

1. Create a project at supabase.com
2. Set up Google OAuth (see section 9 of this document)
3. Copy the URL and keys into `.env`

### Step 5: Start the infrastructure

```bash
docker compose up --build -d

# Verify everything started
docker compose ps
# Expected: Running — postgres, redis, backend, celery_worker, frontend
```

### Step 6: Apply migrations

```bash
# Initialize Alembic (first time only)
docker compose exec backend alembic init alembic

# Create the first migration
docker compose exec backend alembic revision --autogenerate -m "initial_schema"

# Apply
docker compose exec backend alembic upgrade head
```

### Step 7: Verify everything works

```bash
# Backend health check
curl http://localhost:8000/health
# Expected response: {"status": "ok", "version": "1.0.0"}

# Swagger documentation
open http://localhost:8000/docs

# Frontend
open http://localhost:3000
```

---

## 13. How to Add a New Module (Instructions for M4 and Beyond)

Once the foundation is ready, adding a new module is 5 steps:

**1. Create the module folder:**
```bash
mkdir -p backend/app/modules/content
touch backend/app/modules/content/{__init__,router,service,tasks,models,schemas}.py
```

**2. Create models (new tables):**
```python
# backend/app/modules/content/models.py
from app.models.base import Base, UUIDMixin, TimestampMixin
# ... define module tables
```

**3. Add models to alembic/env.py:**
```python
from app.modules.content import models  # noqa — so Alembic can see the tables
```

**4. Create and apply migration:**
```bash
docker compose exec backend alembic revision --autogenerate -m "add_content_module"
docker compose exec backend alembic upgrade head
```

**5. Mount the router:**
```python
# backend/app/api/router.py
from app.modules.content import router as content_router
api_router.include_router(content_router.router, prefix="/content")
```

**Done.** The module uses the shared AI Router, shared database, shared auth — nothing duplicated.

---

## 14. Foundation Readiness Checklist

The foundation is complete when:

- [ ] Docker Compose starts without errors (`docker compose ps` shows all Running)
- [ ] `GET /health` returns 200
- [ ] Supabase Auth configured, Google OAuth working
- [ ] Login via Google → redirect to `/dashboard` works
- [ ] Migrations applied (`alembic upgrade head` with no errors)
- [ ] Tables `organisations`, `users`, `companies`, `ai_usage` exist in DB
- [ ] AI Router responds to a test call (Claude or OpenAI)
- [ ] Celery worker is running and accepting tasks
- [ ] `GET /api/v1/companies` requires auth (returns 401 without token)
- [ ] After restart (`docker compose down && docker compose up -d`) data is preserved
