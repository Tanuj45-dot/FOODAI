from datetime import datetime, timedelta, timezone
import os

import bcrypt
from jose import JWTError, jwt


# ==================================================
# ENVIRONMENT
# ==================================================

ENVIRONMENT = os.getenv(
    "FOODAI_ENVIRONMENT",
    "development"
)


# ==================================================
# JWT CONFIGURATION
# ==================================================

DEFAULT_DEV_SECRET = (
    "foodai-development-secret-"
    "change-before-deployment"
)

SECRET_KEY = os.getenv(
    "FOODAI_SECRET_KEY",
    DEFAULT_DEV_SECRET
)

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "FOODAI_ACCESS_TOKEN_EXPIRE_MINUTES",
        "60"
    )
)


# ==================================================
# PRODUCTION SECURITY CHECK
# ==================================================

if (
    ENVIRONMENT.lower() == "production"
    and SECRET_KEY == DEFAULT_DEV_SECRET
):
    raise RuntimeError(
        "FOODAI_SECRET_KEY must be configured "
        "before running FoodAI in production."
    )


# ==================================================
# PASSWORD HASHING
# ==================================================

def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")

    hashed_password = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    )

    return hashed_password.decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:

    password_bytes = plain_password.encode("utf-8")
    hashed_password_bytes = hashed_password.encode("utf-8")

    return bcrypt.checkpw(
        password_bytes,
        hashed_password_bytes
    )


# ==================================================
# CREATE JWT ACCESS TOKEN
# ==================================================

def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None
) -> str:

    to_encode = data.copy()

    if expires_delta:
        expire = (
            datetime.now(timezone.utc)
            + expires_delta
        )
    else:
        expire = (
            datetime.now(timezone.utc)
            + timedelta(
                minutes=ACCESS_TOKEN_EXPIRE_MINUTES
            )
        )

    to_encode.update({
        "exp": expire
    })

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt


# ==================================================
# DECODE JWT ACCESS TOKEN
# ==================================================

def decode_access_token(token: str):

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return payload

    except JWTError:

        return None