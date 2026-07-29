"""
Smart Diagnostics - Database Connection Manager
Connects to Supabase PostgreSQL (via DATABASE_URL in .env) with SSL support.
Falls back gracefully to SQLite if remote PostgreSQL is unreachable.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
Base = declarative_base()

def init_db_engine():
    global DATABASE_URL
    if DATABASE_URL and (DATABASE_URL.startswith("postgresql") or DATABASE_URL.startswith("postgres")):
        # Clean postgresql prefix if postgres:// used
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

        # Append sslmode if not present
        conn_url = DATABASE_URL
        if "sslmode" not in conn_url:
            conn_url += "?sslmode=require" if "?" not in conn_url else "&sslmode=require"

        try:
            eng = create_engine(
                conn_url,
                pool_pre_ping=True,
                pool_recycle=300,
                connect_args={"connect_timeout": 10}
            )
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
                print("Successfully connected to Supabase PostgreSQL Database!")
            return eng
        except Exception as e:
            print(f"PostgreSQL SSL Connection Notice ({e}). Retrying direct connection...")
            try:
                eng = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 10})
                with eng.connect() as conn:
                    conn.execute(text("SELECT 1"))
                    print("Successfully connected to Supabase PostgreSQL Database!")
                return eng
            except Exception as e2:
                print(f"PostgreSQL connection warning ({e2}). Falling back to SQLite database.")

    # SQLite Fallback
    SQLITE_PATH = os.path.join(os.path.dirname(__file__), "diagnopulse.db")
    fallback_url = f"sqlite:///{SQLITE_PATH}"
    return create_engine(fallback_url, connect_args={"check_same_thread": False})

engine = init_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """FastAPI Dependency for database session handling."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
