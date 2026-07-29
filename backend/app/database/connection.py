"""
Smart Diagnostics - Database Connection Manager
Connects to Supabase PostgreSQL (supporting IPv4 Pooler for cloud environments like Render).
Falls back cleanly to local database if remote PostgreSQL is unreachable.
"""

import os
import re
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
Base = declarative_base()

def init_db_engine():
    global DATABASE_URL
    if DATABASE_URL and ("postgresql" in DATABASE_URL or "postgres" in DATABASE_URL):
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

        # Ensure sslmode=require
        conn_url = DATABASE_URL
        if "sslmode" not in conn_url:
            conn_url += "?sslmode=require" if "?" not in conn_url else "&sslmode=require"

        # Try 1: Connect to DATABASE_URL
        try:
            eng = create_engine(
                conn_url,
                pool_pre_ping=True,
                pool_recycle=300,
                connect_args={"connect_timeout": 5}
            )
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
                print("Successfully connected to Supabase Cloud PostgreSQL Database!")
            return eng
        except Exception:
            pass

        # Try 2: If hostname is db.<ref>.supabase.co, try IPv4 Pooler host: aws-0-ap-southeast-1.pooler.supabase.com:6543
        if "supabase.co" in conn_url:
            try:
                # Replace db.<ref>.supabase.co:5432 with aws-0-ap-southeast-1.pooler.supabase.com:6543
                pooler_url = re.sub(r'db\.[a-z0-9]+\.supabase\.co:5432', 'aws-0-ap-southeast-1.pooler.supabase.com:6543', conn_url)
                eng = create_engine(
                    pooler_url,
                    pool_pre_ping=True,
                    pool_recycle=300,
                    connect_args={"connect_timeout": 5}
                )
                with eng.connect() as conn:
                    conn.execute(text("SELECT 1"))
                    print("Successfully connected to Supabase IPv4 Pooler Database!")
                return eng
            except Exception:
                pass

        print("Cloud Database Notice: Operating in resilient local storage mode.")

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
