"""
Smart Diagnostics - Main Application Entrypoint
Integrates FastAPI REST routers, database initialization/seeder, CORS middleware,
and static frontend distribution.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database.connection import engine, Base
from app.database.seeder import seed_database
from app.routers import auth, reports, tests, audit, admin

app = FastAPI(
    title="Smart Diagnostics: Lab Report & Test Management System",
    description="Enterprise-grade medical lab management & AI diagnostic interpretation backend powered by Groq LLaMA 3.3 and Supabase PostgreSQL.",
    version="1.0.0"
)

# CORS Configuration — allows frontend (Vercel) + local dev
# In production, restrict to your deployed frontend domain via ALLOWED_ORIGINS env var
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "*"  # Default: open for local dev. Set to specific URL in production.
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Ensure database tables and initial seed data exist
try:
    seed_database()
except Exception as e:
    print(f"Database initialization warning: {e}")

# Include Routers
app.include_router(auth.router)
app.include_router(reports.router)
app.include_router(tests.router)
app.include_router(audit.router)
app.include_router(admin.router)

# Mount Frontend Static Directory
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend"))

if os.path.exists(FRONTEND_DIR):
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")

    @app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    def serve_frontend_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.api_route("/health", methods=["GET", "HEAD"], tags=["Health"])
def health_check():
    return {"status": "healthy", "service": "Smart Diagnostics API"}
