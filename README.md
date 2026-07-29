# Smart Diagnostics: Lab Report & Test Management System

Smart Diagnostics is an enterprise-grade medical lab management and AI-assisted diagnostic interpretation platform.

## 🚀 Key Features

1. **Multi-Role Workspace & Persona Switcher**:
   - **Patient Portal**: Track pending lab tests, read plain-language AI diagnosis summaries, download publication-grade clinical PDF reports.
   - **Lab Technician Portal**: Select patient orders, enter raw lab metrics, trigger dynamic reference range checks, and generate Groq AI summaries.
   - **Pathologist Verification**: Inspect flag warnings, review AI findings, add clinical notes, and electronically sign/approve reports.
   - **Administrator Portal**: Manage diagnostic test templates and query immutable HIPAA audit logs.

2. **Core OOP Architecture**:
   - **Encapsulation**: Private class attributes with input boundary validation.
   - **Inheritance**: Base `User` class extended by `Patient`, `LabTechnician`, `Pathologist`, and `Admin`.
   - **Polymorphism (Strategy Pattern)**: `DiagnosticAnalyzerStrategy` subclasses (`BloodTestStrategy`, `LipidProfileStrategy`, `ThyroidProfileStrategy`, `LiverFunctionStrategy`, `MetabolicPanelStrategy`).
   - **Report State Machine**: Strict status transitions (`DRAFT` $\rightarrow$ `PENDING_APPROVAL` $\rightarrow$ `APPROVED`/`REJECTED`) with explicit domain exceptions.

3. **Cloud Stack Integration**:
   - **AI Inference**: Groq API (`llama-3.3-70b-versatile`) with PII Anonymization engine.
   - **Database**: Supabase PostgreSQL database connection with automatic database seeder.
   - **Storage & Auth**: Firebase Auth/Storage configuration.

---

## 🛠️ How to Run

### Start the Application
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

Open your browser to:
- **Web Application Dashboard**: [http://localhost:8000](http://localhost:8000)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧪 Running Automated Tests
```bash
pytest tests/
```
