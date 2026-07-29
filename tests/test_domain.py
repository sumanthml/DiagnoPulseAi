"""
Smart Diagnostics - Domain Unit Tests
Verifies OOP design implementation:
1. Encapsulation & input boundary validation
2. User inheritance & role capability checks
3. Polymorphic strategy range evaluation
4. Report State Machine exception enforcement
5. PII Anonymization scrubbing
"""

import sys
import os
import pytest

# Add backend to sys path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.domain.models import (
    User, Patient, LabTechnician, Pathologist, Admin,
    MetricEntry, Report, UserRole, ReportStatus, FlagSeverity,
    InvalidStateTransitionException, InvalidMetricValueException, UnauthorizedRoleException
)
from app.domain.strategies import BloodTestStrategy, LipidProfileStrategy, StrategyFactory
from app.domain.anonymizer import AnonymizerService


def test_user_inheritance_and_encapsulation():
    """Verifies User hierarchy and capability polymorphism."""
    patient = Patient("pat-1", "pat@example.com", "John Doe", 40, "Male", "MRN-100")
    tech = LabTechnician("tech-1", "tech@example.com", "Alex Tech", "LT-001")
    pathologist = Pathologist("path-1", "path@example.com", "Dr. Roberts", "MD-999")
    admin = Admin("admin-1", "admin@example.com", "Admin User")

    assert patient.role == UserRole.PATIENT
    assert patient.can_perform("view_own_reports") is True
    assert patient.can_perform("approve_report") is False

    assert tech.can_perform("submit_for_approval") is True
    assert pathologist.can_perform("approve_report") is True
    assert admin.can_perform("view_audit_logs") is True

    # Test Encapsulation boundary validation
    with pytest.raises(InvalidMetricValueException):
        patient.age = 200 # Invalid age (> 150)


def test_metric_boundary_validation():
    """Verifies MetricEntry rejects negative physical metrics."""
    m_valid = MetricEntry("Hemoglobin", 14.5, "g/dL")
    assert m_valid.value == 14.5

    with pytest.raises(InvalidMetricValueException):
        MetricEntry("Hemoglobin", -5.0, "g/dL")


def test_polymorphic_strategy_evaluation():
    """Verifies strategy range flags for Blood Test (CBC)."""
    cbc_strategy = StrategyFactory.get_strategy("Complete Blood Count (CBC)")
    metrics = [
        MetricEntry("Hemoglobin", 10.5, "g/dL"), # Low for male
        MetricEntry("WBC", 6.0, "10^3/µL"),       # Normal
        MetricEntry("Platelets", 500.0, "10^3/µL") # High
    ]

    flags = cbc_strategy.evaluate_ranges(metrics, age=40, gender="Male")
    hb_flag = next(f for f in flags if f["metric_name"] == "Hemoglobin")
    wbc_flag = next(f for f in flags if f["metric_name"] == "WBC")
    plt_flag = next(f for f in flags if f["metric_name"] == "Platelets")

    assert hb_flag["severity"] == FlagSeverity.LOW.value
    assert wbc_flag["severity"] == FlagSeverity.NORMAL.value
    assert plt_flag["severity"] == FlagSeverity.HIGH.value


def test_report_state_machine_transitions():
    """Verifies strict state transitions and domain exception throwing."""
    tech = LabTechnician("tech-1", "tech@test.com", "Tech Name", "LT-100")
    pathologist = Pathologist("path-1", "doc@test.com", "Dr. Doc", "MD-100")
    patient = Patient("pat-1", "pat@test.com", "Patient Name", 30, "Female", "MRN-001")

    metrics = [MetricEntry("Hemoglobin", 12.5, "g/dL")]
    report = Report("rep-101", patient.user_id, tech.user_id, "CBC", metrics)

    assert report.status == ReportStatus.DRAFT

    # Illegal transition: Attempting to approve DRAFT directly must raise InvalidStateTransitionException
    with pytest.raises(InvalidStateTransitionException):
        report.approve(pathologist, "Direct approval attempt")

    # Missing AI summary prevents submission
    with pytest.raises(Exception):
        report.submit_for_approval(tech)

    # Valid flow: Attach AI Summary -> Submit -> Approve
    report.ai_summary = "Clinical summary indicates normal hemoglobin for female."
    report.submit_for_approval(tech)
    assert report.status == ReportStatus.PENDING_APPROVAL

    report.approve(pathologist, "Verified and signed.")
    assert report.status == ReportStatus.APPROVED
    assert report.approved_by_id == pathologist.user_id


def test_pii_anonymizer():
    """Verifies PII scrubbing prior to AI submission."""
    sanitized = AnonymizerService.sanitize_for_ai(
        test_type="Lipid Profile",
        patient_age=50,
        patient_gender="Female",
        metrics=[{"name": "Total Cholesterol", "value": 240, "unit": "mg/dL"}],
        evaluated_flags=[{"metric_name": "Total Cholesterol", "severity": "HIGH", "message": "Elevated"}]
    )

    # Ensure no patient name, MRN, address or SSN in payload
    payload_str = str(sanitized)
    assert "John Doe" not in payload_str
    assert "MRN" not in payload_str
    assert sanitized["patient_demographics"]["age"] == 50
