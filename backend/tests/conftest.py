import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci-only-0000000000000001")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-for-ci-only-00001")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://apex_user:pass@localhost:5432/apex")
os.environ.setdefault("POSTGRES_PASSWORD", "pass")
