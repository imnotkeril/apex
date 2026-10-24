"""
Supabase JWT verification for Foundation.

Uses HS256 with SUPABASE_JWT_SECRET (Dashboard → Settings → API).
If your project uses asymmetric JWTs only, extend this module to fetch JWKS.
"""

from typing import Any

import jwt
from fastapi import HTTPException, status


def decode_supabase_jwt(token: str, jwt_secret: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        ) from None
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from None

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: no subject",
        )
    return payload
