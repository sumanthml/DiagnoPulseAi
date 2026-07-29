"""
Smart Diagnostics - Database Connection Manager
Connects to Supabase PostgreSQL (via DATABASE_URL in .env)
Falls back gracefully to local SQLite if remote PostgreSQL is unreachable.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Prepare SQLAlchemy engine
Base = declarative_base()

try:
    if DATABASE_URL and DATABASE_URL.startswith("postgresql"):
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 5}
        )
        # Test connection
        with engine.connect() as conn:
            print("Successfully connected to Supabase PostgreSQL Database!")
    else:
        raise ValueError("DATABASE_URL not set or not postgresql.")
except Exception as e:
    print(f"PostgreSQL connection warning ({e}). Falling back to local SQLite database.")
    SQLITE_PATH = os.path.join(os.path.dirname(__file__), "diagnopulse.db")
    DATABASE_URL = f"sqlite:///{SQLITE_PATH}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI Dependency for database session handling."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
