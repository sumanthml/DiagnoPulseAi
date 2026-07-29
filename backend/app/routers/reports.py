"""
Smart Diagnostics - Diagnostic Reports Router
Handles full report lifecycle:
Creation -> Metric Evaluation (Strategies) -> AI Interpretation (Groq) -> Pathologist Approval -> PDF Download
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database.models import DBReport, DBReportMetric, DBUser, DBAuditLog
from app.domain.models import (
    ReportStatus, UserRole, MetricEntry, Report,
    Patient, LabTechnician, Pathologist, Admin,
    InvalidStateTransitionException, InvalidMetricValueException, UnauthorizedRoleException
)
from app.domain.strategies import StrategyFactory
from app.domain.anonymizer import AnonymizerService
from app.services.ai_interpreter import GroqAIInterpreter
from app.services.pdf_generator import PDFReportGenerator
from app.services.audit_logger import AuditLogger
from app.services.ocr_parser import LabFileParser

router = APIRouter(prefix="/api/reports", tags=["Diagnostic Reports"])
ai_interpreter = GroqAIInterpreter()


# --- Pydantic Schemas ---
class MetricInputSchema(BaseModel):
    name: str
    value: float
    unit: str


class CreateReportSchema(BaseModel):
    patient_id: str
    technician_id: str
    test_type: str
    metrics: List[MetricInputSchema]


class PathologistReviewSchema(BaseModel):
    pathologist_id: str
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None


@router.get("")
def list_reports(
    patient_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    role_view: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lists diagnostic reports filtered by role and status."""
    query = db.query(DBReport)

    if patient_id:
        query = query.filter(DBReport.patient_id == patient_id)

    if status_filter:
        query = query.filter(DBReport.status == status_filter.upper())

    # Patient RBAC enforcement: Patients can only view APPROVED reports
    if role_view and role_view.upper() == "PATIENT":
        query = query.filter(DBReport.status == ReportStatus.APPROVED.value)

    reports = query.order_by(DBReport.updated_at.desc()).all()

    result = []
    for r in reports:
        result.append({
            "id": r.id,
            "patient_id": r.patient_id,
            "patient_name": r.patient.full_name if r.patient else "Unknown Patient",
            "patient_mrn": r.patient.mrn if r.patient else "",
            "patient_age": r.patient.age if r.patient else 0,
            "patient_gender": r.patient.gender if r.patient else "",
            "technician_id": r.technician_id,
            "technician_name": r.technician.full_name if r.technician else "",
            "approved_by_name": r.approved_by.full_name if r.approved_by else None,
            "test_type": r.test_type,
            "status": r.status,
            "ai_summary": r.ai_summary,
            "pathologist_notes": r.pathologist_notes,
            "created_at": r.created_at.isoformat() if r.created_at else "",
            "updated_at": r.updated_at.isoformat() if r.updated_at else "",
            "metric_count": len(r.report_metrics)
        })
    return result


@router.get("/{report_id}")
def get_report_details(report_id: str, db: Session = Depends(get_db)):
    """Fetches comprehensive report details including evaluated metrics."""
    r = db.query(DBReport).filter(DBReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found.")

    metrics = []
    for m in r.report_metrics:
        metrics.append({
            "id": m.id,
            "metric_name": m.metric_name,
            "value": m.value,
            "unit": m.unit,
            "severity": m.severity,
            "message": m.message
        })

    return {
        "id": r.id,
        "patient": {
            "id": r.patient.id if r.patient else "",
            "full_name": r.patient.full_name if r.patient else "Unknown",
            "age": r.patient.age if r.patient else 0,
            "gender": r.patient.gender if r.patient else "",
            "mrn": r.patient.mrn if r.patient else ""
        },
        "technician_name": r.technician.full_name if r.technician else "",
        "approved_by_name": r.approved_by.full_name if r.approved_by else None,
        "test_type": r.test_type,
        "status": r.status,
        "ai_summary": r.ai_summary,
        "pathologist_notes": r.pathologist_notes,
        "created_at": r.created_at.isoformat() if r.created_at else "",
        "metrics": metrics
    }


@router.post("")
def create_report_draft(payload: CreateReportSchema, db: Session = Depends(get_db)):
    """Creates a new diagnostic report draft with metric inputs."""
    patient_user = db.query(DBUser).filter(DBUser.id == payload.patient_id).first()
    tech_user = db.query(DBUser).filter(DBUser.id == payload.technician_id).first()

    if not patient_user or patient_user.role != UserRole.PATIENT.value:
        raise HTTPException(status_code=400, detail="Invalid patient specified.")

    if not tech_user or tech_user.role != UserRole.LAB_TECHNICIAN.value:
        raise HTTPException(status_code=400, detail="Only lab technicians can create lab reports.")

    # 1. Instantiate OOP Domain Objects to validate input boundaries
    domain_metrics = []
    for m in payload.metrics:
        try:
            domain_metrics.append(MetricEntry(name=m.name, value=m.value, unit=m.unit))
        except InvalidMetricValueException as e:
            raise HTTPException(status_code=400, detail=str(e))

    # 2. Polymorphic Range Evaluation using Strategy Pattern
    strategy = StrategyFactory.get_strategy(payload.test_type)
    evaluated_flags = strategy.evaluate_ranges(
        metrics=domain_metrics,
        age=patient_user.age or 30,
        gender=patient_user.gender or "Male"
    )

    # 3. Create DB Entities
    report_id = f"rep-{str(uuid.uuid4())[:8]}"
    db_report = DBReport(
        id=report_id,
        patient_id=payload.patient_id,
        technician_id=payload.technician_id,
        test_type=payload.test_type,
        status=ReportStatus.DRAFT.value
    )
    db.add(db_report)

    db_metrics = []
    for flag in evaluated_flags:
        db_metrics.append(DBReportMetric(
            id=str(uuid.uuid4()),
            report_id=report_id,
            metric_name=flag["metric_name"],
            value=flag["value"],
            unit=flag["unit"],
            severity=flag["severity"],
            message=flag["message"]
        ))
    db.add_all(db_metrics)
    db.commit()

    AuditLogger.log_event(
        db=db,
        user_id=payload.technician_id,
        action="CREATE_REPORT_DRAFT",
        entity_type="REPORT",
        entity_id=report_id,
        details=f"Lab Technician created draft report for {payload.test_type}"
    )

    return {"message": "Draft report created successfully", "report_id": report_id, "flags": evaluated_flags}


@router.post("/{report_id}/generate-ai-summary")
async def generate_ai_summary(report_id: str, db: Session = Depends(get_db)):
    """Triggers PII anonymization pipeline and Groq AI inference to generate patient summary."""
    r = db.query(DBReport).filter(DBReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found.")

    if r.status not in [ReportStatus.DRAFT.value, ReportStatus.PENDING_APPROVAL.value]:
        raise HTTPException(status_code=400, detail=f"Cannot generate AI summary in status '{r.status}'.")

    # 1. Gather metrics
    metrics_list = []
    flags_list = []
    for m in r.report_metrics:
        metrics_list.append({"name": m.metric_name, "value": m.value, "unit": m.unit})
        flags_list.append({
            "metric_name": m.metric_name,
            "severity": m.severity,
            "message": m.message,
            "ref_min": 0,
            "ref_max": 0,
            "unit": m.unit
        })

    # 2. Scrub PII via Anonymizer Service
    anonymized_payload = AnonymizerService.sanitize_for_ai(
        test_type=r.test_type,
        patient_age=r.patient.age if r.patient else 30,
        patient_gender=r.patient.gender if r.patient else "Unknown",
        metrics=metrics_list,
        evaluated_flags=flags_list
    )

    # 3. Call Groq AI Interpreter abstraction
    summary_text = await ai_interpreter.interpret(anonymized_payload)
    r.ai_summary = summary_text
    db.commit()

    AuditLogger.log_event(
        db=db,
        user_id=r.technician_id,
        action="GENERATE_AI_SUMMARY",
        entity_type="REPORT",
        entity_id=report_id,
        details="Generated anonymized AI clinical interpretation summary via Groq LLaMA."
    )

    return {"message": "AI summary generated successfully", "ai_summary": summary_text}


@router.post("/{report_id}/submit")
def submit_report(report_id: str, db: Session = Depends(get_db)):
    """Transitions DRAFT -> PENDING_APPROVAL."""
    r = db.query(DBReport).filter(DBReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found.")

    tech = db.query(DBUser).filter(DBUser.id == r.technician_id).first()
    tech_domain = LabTechnician(tech.id, tech.email, tech.full_name, tech.employee_id or "LT-001")

    # Reconstruct domain entity to enforce State Machine exceptions
    metrics = [MetricEntry(m.metric_name, m.value, m.unit) for m in r.report_metrics]
    report_domain = Report(r.id, r.patient_id, r.technician_id, r.test_type, metrics)
    report_domain._status = ReportStatus(r.status)
    report_domain._ai_summary = r.ai_summary

    try:
        report_domain.submit_for_approval(tech_domain)
        r.status = report_domain.status.value
        db.commit()

        AuditLogger.log_event(
            db=db,
            user_id=r.technician_id,
            action="SUBMIT_FOR_APPROVAL",
            entity_type="REPORT",
            entity_id=report_id,
            details="Submitted draft report to Pathologist review queue."
        )
        return {"message": "Report submitted for Pathologist approval", "status": r.status}

    except (InvalidStateTransitionException, UnauthorizedRoleException, DomainException) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{report_id}/approve")
def approve_report(report_id: str, payload: PathologistReviewSchema, db: Session = Depends(get_db)):
    """Transitions PENDING_APPROVAL -> APPROVED (Pathologist Digital Sign-off)."""
    r = db.query(DBReport).filter(DBReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found.")

    doctor = db.query(DBUser).filter(DBUser.id == payload.pathologist_id).first()
    if not doctor or doctor.role != UserRole.PATHOLOGIST.value:
        raise HTTPException(status_code=403, detail="Only a certified Pathologist can approve reports.")

    doctor_domain = Pathologist(doctor.id, doctor.email, doctor.full_name, doctor.license_number or "MD-999")

    metrics = [MetricEntry(m.metric_name, m.value, m.unit) for m in r.report_metrics]
    report_domain = Report(r.id, r.patient_id, r.technician_id, r.test_type, metrics)
    report_domain._status = ReportStatus(r.status)

    try:
        report_domain.approve(doctor_domain, clinical_notes=payload.notes)
        r.status = report_domain.status.value
        r.approved_by_id = doctor.id
        r.pathologist_notes = payload.notes or "Verified diagnostic metrics and AI summary. No critical deviations."
        db.commit()

        AuditLogger.log_event(
            db=db,
            user_id=doctor.id,
            action="APPROVE_REPORT",
            entity_type="REPORT",
            entity_id=report_id,
            details=f"Pathologist {doctor.full_name} approved report."
        )

        return {"message": "Report approved successfully!", "status": r.status}

    except (InvalidStateTransitionException, UnauthorizedRoleException, DomainException) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{report_id}/reject")
def reject_report(report_id: str, payload: PathologistReviewSchema, db: Session = Depends(get_db)):
    """Transitions PENDING_APPROVAL -> REJECTED."""
    r = db.query(DBReport).filter(DBReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found.")

    doctor = db.query(DBUser).filter(DBUser.id == payload.pathologist_id).first()
    if not doctor or doctor.role != UserRole.PATHOLOGIST.value:
        raise HTTPException(status_code=403, detail="Only a Pathologist can reject reports.")

    doctor_domain = Pathologist(doctor.id, doctor.email, doctor.full_name, doctor.license_number or "MD-999")

    metrics = [MetricEntry(m.metric_name, m.value, m.unit) for m in r.report_metrics]
    report_domain = Report(r.id, r.patient_id, r.technician_id, r.test_type, metrics)
    report_domain._status = ReportStatus(r.status)

    try:
        reason = payload.rejection_reason or "Metrics require re-testing or recalibration."
        report_domain.reject(doctor_domain, reason=reason)
        r.status = report_domain.status.value
        r.approved_by_id = doctor.id
        r.pathologist_notes = f"REJECTED: {reason}"
        db.commit()

        AuditLogger.log_event(
            db=db,
            user_id=doctor.id,
            action="REJECT_REPORT",
            entity_type="REPORT",
            entity_id=report_id,
            details=f"Pathologist rejected report: {reason}"
        )

        return {"message": "Report rejected.", "status": r.status}

    except (InvalidStateTransitionException, UnauthorizedRoleException, DomainException) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{report_id}/pdf")
def download_pdf_report(report_id: str, db: Session = Depends(get_db)):
    """Generates and streams publication-grade clinical PDF lab report."""
    r = db.query(DBReport).filter(DBReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found.")

    metrics = []
    for m in r.report_metrics:
        metrics.append({
            "metric_name": m.metric_name,
            "value": m.value,
            "unit": m.unit,
            "severity": m.severity,
            "message": m.message,
            "ref_min": "10", # Default visual fallback
            "ref_max": "100"
        })

    patient_name = r.patient.full_name if r.patient else "Patient"
    patient_age = r.patient.age if r.patient else 0
    patient_gender = r.patient.gender if r.patient else "N/A"
    mrn = r.patient.mrn if r.patient else "N/A"
    doctor_name = r.approved_by.full_name if r.approved_by else "Dr. Eleanor Roberts, MD"

    pdf_bytes = PDFReportGenerator.generate_pdf(
        report_id=r.id,
        patient_name=patient_name,
        patient_age=patient_age,
        patient_gender=patient_gender,
        mrn=mrn,
        test_type=r.test_type,
        metrics=metrics,
        ai_summary=r.ai_summary or "",
        pathologist_name=doctor_name,
        pathologist_notes=r.pathologist_notes or "Verified diagnostic report.",
        status=r.status
    )

    filename = f"Diagnopulse_LabReport_{r.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/upload-file")
async def upload_report_file(file: UploadFile = File(...)):
    """
    Accepts PDF, PNG, JPG file uploads of lab reports,
    extracts numerical parameters, and returns parsed metric data for form auto-fill.
    """
    try:
        content = await file.read()
        # Decode text content from file (supports plain text, OCR, or PDF text streams)
        raw_text = content.decode("utf-8", errors="ignore")
        
        parsed_metrics = LabFileParser.parse_text_content(raw_text)
        return {
            "message": f"Successfully parsed uploaded file '{file.filename}'",
            "filename": file.filename,
            "metrics": parsed_metrics
        }
    except Exception as err:
        raise HTTPException(status_code=400, detail=f"Failed to parse uploaded file: {str(err)}")

