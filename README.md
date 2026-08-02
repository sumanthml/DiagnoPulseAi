# 🏥 Smart Diagnostics: Lab Report & Test Management System
### *Using Object-Oriented Design — Capstone Project*

[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python-green)](https://fastapi.tiangolo.com/)
[![AI Engine](https://img.shields.io/badge/AI-Groq%20LLaMA%203.3%2070B-orange)](https://groq.com/)
[![OOP](https://img.shields.io/badge/OOP-Encapsulation%20%7C%20Inheritance%20%7C%20Polymorphism%20%7C%20Abstraction-blue)](#oop-architecture)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL%20%2B%20SQLite%20Fallback-blueviolet)](https://supabase.com/)
[![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JS%20%2B%20HTML%2FCSS-yellow)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

---

## 🌍 Problem Statement

Modern diagnostic labs generate reports written **for doctors**, not patients. Patients viewing raw values like `ALT: 55 U/L` often panic and misinterpret data from Google. Lab technicians waste hours manually cross-referencing reference range tables. Pathologists sign hundreds of reports without a standardized digital workflow.

**Smart Diagnostics solves this** with an AI-powered multi-role platform that translates raw lab data into plain-language health insights — with pathologist guardrails enforced through a strict Object-Oriented state machine.

---

## 🏗️ OOP Architecture

This system is built as a **showcase of all four OOP pillars**, implemented in production-quality Python.

### 1. 🔒 Encapsulation — `backend/app/domain/models.py`

All sensitive health data is stored in **private attributes** (single underscore prefix). Access is only possible through validated `@property` getters and setters:

```python
class Report:
    def __init__(self, ...):
        self._status = ReportStatus.DRAFT       # Private: cannot be set directly
        self._ai_summary = None                  # Private: only accessible via property
        self._patient_id = patient_id           # Private: enforces read-only access

    @property
    def status(self) -> ReportStatus:
        return self._status                      # Controlled read access

    @ai_summary.setter
    def ai_summary(self, summary: str):
        if self._status == ReportStatus.APPROVED:
            raise DomainException("Cannot edit an approved report.")
        self._ai_summary = summary              # Validated write access
```

### 2. 🧬 Inheritance — `backend/app/domain/models.py`

A `User` base class defines shared attributes. Four role subclasses extend it:

```
User (base)
├── Patient          → MRN, medical history
├── LabTechnician    → employee_id, equipment calibration
├── Pathologist      → license_number, sign-off authority
└── Admin            → system-level permissions
```

Each subclass overrides `can_perform(action)` to enforce role-specific permissions without conditional if/else trees in business logic.

### 3. 🔀 Polymorphism — `backend/app/domain/strategies.py`

The **Strategy Pattern** defines an abstract `DiagnosticAnalyzerStrategy` interface. Six concrete subclasses implement it for different clinical panels:

```python
class DiagnosticAnalyzerStrategy(ABC):
    @abstractmethod
    def evaluate_ranges(self, metrics, age, gender) -> List[Dict]: ...

class BloodTestStrategy(DiagnosticAnalyzerStrategy): ...    # CBC
class LipidProfileStrategy(DiagnosticAnalyzerStrategy): ... # Lipid Profile
class ThyroidProfileStrategy(DiagnosticAnalyzerStrategy): ... # Thyroid
class LiverFunctionStrategy(DiagnosticAnalyzerStrategy): ... # LFT
class MetabolicPanelStrategy(DiagnosticAnalyzerStrategy): ... # Metabolic
class UrineAnalysisStrategy(DiagnosticAnalyzerStrategy): ... # Urinalysis (6th)
```

New panels can be added without touching any existing code — true Open/Closed Principle.

### 4. 🪟 Abstraction — `backend/app/services/ai_interpreter.py`

The `IReportInterpreter` interface completely decouples the AI inference layer from business services:

```python
class IReportInterpreter(ABC):
    @abstractmethod
    def interpret(self, report_context: dict) -> str: ...

class GroqAIInterpreter(IReportInterpreter): ...   # Real inference (Groq LLaMA)
class LocalFallbackInterpreter(IReportInterpreter): ... # Offline fallback
```

Business services call `interpreter.interpret(context)` — they never know if Groq or local inference is running.

### 5. ⚙️ State Machine — `backend/app/domain/models.py`

The `Report` class implements a strict state machine for report lifecycle:

```
DRAFT ──→ PENDING_APPROVAL ──→ APPROVED
                │
                └──→ REJECTED ──→ DRAFT (via reopen())
```

Each transition is an explicit method with role-level and state-level validation:
- `submit_for_approval()` — Lab Technician only, from DRAFT
- `approve(pathologist)` — Pathologist only, from PENDING_APPROVAL
- `reject(pathologist, reason)` — Pathologist only, from PENDING_APPROVAL
- `reopen()` — any, from REJECTED → DRAFT (for metric recalibration)

---

## 🎭 Multi-Role System (4 User Personas)

| Role | Portal Features |
|---|---|
| **Patient** | View approved reports in plain English, health scorecard, parameter glossary, PDF download |
| **Lab Technician** | Create reports, enter metrics with real-time range gauge, file upload (OCR), AI summary generation, submit for approval, reopen rejected reports |
| **Pathologist** | Approve/reject pending reports with clinical notes, view anonymized AI summaries, electronic signature |
| **Admin** | Platform stats dashboard, user management + role assignment, test template configurator, immutable audit log |

---

## 🤖 AI Integration

- **Groq LLaMA 3.3 70B** — Zero-cost, ultra-fast inference for plain-language interpretation
- **PII Anonymization** — Patient identifiers stripped before sending to Groq via `AnonymizerService`
- **Structured Prompt Engineering** — Metric flags, severity levels, and reference ranges are formatted into a clinical prompt
- **Local Fallback** — If Groq is unavailable, a rule-based interpreter generates a deterministic summary

---

## 🧪 Diagnostic Test Panels (6 panels)

| Panel | Code | Category | Metrics |
|---|---|---|---|
| Complete Blood Count | CBC-001 | Hematology | Hb, WBC, RBC, Platelets |
| Lipid Profile | LIP-002 | Cardiology | Total Cholesterol, HDL, LDL, Triglycerides |
| Thyroid Profile | THY-003 | Endocrinology | TSH, Free T3, Free T4 |
| Liver Function Test | LFT-004 | Hepatology | ALT, AST, Bilirubin, Albumin |
| Metabolic Panel | CMP-005 | Biochemistry | Glucose, Creatinine, Sodium, Potassium |
| Urinalysis | URN-006 | Nephrology | Urine pH, Specific Gravity, Protein, Glucose, WBC |

---

## 📁 Project Structure

```
DiagnopulseAi/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI entry point + CORS
│   │   ├── database/
│   │   │   ├── connection.py           # Supabase + SQLite fallback
│   │   │   ├── models.py               # SQLAlchemy ORM schemas
│   │   │   └── seeder.py               # Auto-seeds 6 test panels + sample data
│   │   ├── domain/                     ← OOP Core
│   │   │   ├── models.py               # User hierarchy, Report state machine
│   │   │   ├── strategies.py           # DiagnosticAnalyzerStrategy (6 panels)
│   │   │   └── anonymizer.py           # PII anonymization
│   │   ├── routers/
│   │   │   ├── auth.py                 # User registration + login
│   │   │   ├── reports.py              # Report CRUD + state transitions
│   │   │   ├── tests.py                # Test template management
│   │   │   ├── audit.py                # HIPAA audit log queries
│   │   │   └── admin.py                # Admin console APIs
│   │   └── services/
│   │       ├── ai_interpreter.py       # IReportInterpreter abstraction
│   │       ├── pdf_generator.py        # ReportLab PDF generation
│   │       ├── ocr_parser.py           # Lab file OCR parsing
│   │       └── audit_logger.py         # Immutable event logger
├── frontend/
│   ├── index.html                      # Single-page app (all 4 portals)
│   ├── css/styles.css                  # Enterprise glassmorphism design system
│   └── js/
│       ├── app.js                      # AppController (role-based UI logic)
│       └── api.js                      # REST API client
├── schema.sql                          # PostgreSQL DDL + seed data (Supabase)
├── render.yaml                         # One-click Render deployment config
└── README.md                           # This file
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.10+
- A Groq API key (free at [console.groq.com](https://console.groq.com))

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd DiagnopulseAi

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set your GROQ_API_KEY
```

```env
GROQ_API_KEY=your_key_here
DATABASE_URL=          # Optional: Leave blank to use local SQLite
ALLOWED_ORIGINS=*      # In production: set to your frontend domain
```

### 3. Run Backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

The backend auto-seeds the database with 5 users, 6 test panels, and a sample approved CBC report.

### 4. Open Frontend

Simply open `frontend/index.html` in your browser, **or** access it via `http://localhost:8000` (served by FastAPI's static file mount).

---

## 🔐 Demo Credentials

| Role | Email / Login | Quick Demo |
|---|---|---|
| **Patient** | sumanth.sunny@patient.com | Click "Patient" demo button |
| **Lab Technician** | alex.tech@diagnopulse.com | Click "Lab Tech" demo button |
| **Pathologist** | dr.roberts@diagnopulse.com | Click "Pathologist" demo button |
| **Admin** | admin@diagnopulse.com | Click "Admin" demo button |

---

## 🌐 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/users` | Register a new user |
| `GET` | `/api/auth/users` | List users (with role filter) |
| `GET` | `/api/reports/stats` | Platform report statistics |
| `GET` | `/api/reports` | List reports (with patient/status/tech filter) |
| `POST` | `/api/reports` | Create a new DRAFT report |
| `GET` | `/api/reports/{id}` | Get full report details + metrics |
| `POST` | `/api/reports/{id}/generate-ai-summary` | Trigger Groq AI analysis |
| `POST` | `/api/reports/{id}/submit` | DRAFT → PENDING_APPROVAL |
| `POST` | `/api/reports/{id}/approve` | PENDING_APPROVAL → APPROVED |
| `POST` | `/api/reports/{id}/reject` | PENDING_APPROVAL → REJECTED |
| `POST` | `/api/reports/{id}/reopen` | REJECTED → DRAFT |
| `GET` | `/api/reports/{id}/pdf` | Download signed PDF report |
| `POST` | `/api/reports/upload-file` | OCR parse uploaded lab file |
| `GET` | `/api/tests/templates` | List diagnostic test templates |
| `POST` | `/api/tests/templates` | Create custom test template |
| `GET` | `/api/audit/logs` | Immutable HIPAA audit log |
| `GET` | `/api/admin/stats` | Full platform statistics |
| `GET` | `/api/admin/users` | All users (admin only) |
| `PATCH` | `/api/admin/users/{id}/role` | Reassign user role |

Interactive API docs: [`http://localhost:8000/docs`](http://localhost:8000/docs)

---

## 🏛️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | FastAPI (Python 3.10+) | REST API, dependency injection |
| **ORM** | SQLAlchemy | Database abstraction |
| **Database** | Supabase PostgreSQL | Cloud database |
| **DB Fallback** | SQLite | Local development |
| **AI Engine** | Groq LLaMA 3.3 70B | Plain-language interpretation |
| **PDF Engine** | ReportLab | Signed diagnostic PDFs |
| **Auth** | Firebase Auth | Multi-role authentication |
| **Frontend** | Vanilla JS + HTML/CSS | Zero-dependency SPA |
| **Design** | Glassmorphism + Inter fonts | Enterprise dark-mode UI |
| **Deployment** | Render + Vercel | Cloud hosting |

---

## 🛡️ Security Features

- **PII Anonymization** — Patient names stripped from AI prompts (HIPAA-adjacent)
- **Immutable Audit Logs** — Every state transition is logged with user, timestamp, entity
- **RBAC Enforcement** — Role checked at both domain layer (OOP) and HTTP layer (FastAPI)
- **State Machine Guards** — Invalid transitions raise `InvalidStateTransitionException`
- **Admin Self-demotion Prevention** — Admins cannot modify their own role
- **CORS Configuration** — Configurable via `ALLOWED_ORIGINS` environment variable

---

## 📊 Severity Classification System

| Severity | Trigger | Display |
|---|---|---|
| `NORMAL` | Value within reference range | Green pill |
| `LOW` | Value below ref_min | Amber pill |
| `HIGH` | Value above ref_max | Red pill |
| `CRITICAL` | Value beyond critical threshold (e.g., Hb < 7.0) | Red pulsing badge |

---

*Built with ❤️ as a capstone OOP project demonstrating production-grade software design principles in healthcare informatics.*
