from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os


# ==================================================
# DATABASE CONFIGURATION
# ==================================================

DATABASE_URL = os.getenv(
    "FOODAI_DATABASE_URL",
    "sqlite:///./foodai.db"
)


# ==================================================
# DATABASE ENGINE
# ==================================================

if DATABASE_URL.startswith("sqlite"):

    engine = create_engine(
        DATABASE_URL,
        connect_args={
            "check_same_thread": False
        }
    )

else:

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True
    )


# ==================================================
# DATABASE SESSION
# ==================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# ==================================================
# SQLALCHEMY BASE
# ==================================================

Base = declarative_base()