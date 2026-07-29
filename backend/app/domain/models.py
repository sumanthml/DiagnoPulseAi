"""
Smart Diagnostics - Domain Models (Core OOP Architecture)
Demonstrates:
- Encapsulation: Private properties with getters/setters and range boundaries validation.
- Inheritance: Base User class extended by Patient, LabTechnician, Pathologist, and Admin.
- State Machine: Strict status transitions for diagnostic reports with custom exceptions.
"""

from enum import Enum
from typing import Dict, List, Optional
from datetime import datetime


# ==========================================
# Domain Exceptions
# ==========================================
class DomainException(Exception):
    """Base domain exception for Smart Diagnostics."""
    pass


class InvalidStateTransitionException(DomainException):
    """Raised when an illegal report status transition is attempted."""
    pass


class InvalidMetricValueException(DomainException):
    """Raised when metric inputs violate physical/clinical boundaries."""
    pass


class UnauthorizedRoleException(DomainException):
    """Raised when a user attempts an action not allowed for their role."""
    pass


# ==========================================
# Domain Enums
# ==========================================
class UserRole(str, Enum):
    PATIENT = "PATIENT"
    LAB_TECHNICIAN = "LAB_TECHNICIAN"
    PATHOLOGIST = "PATHOLOGIST"
    ADMIN = "ADMIN"


class ReportStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class FlagSeverity(str, Enum):
    NORMAL = "NORMAL"
    LOW = "LOW"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# ==========================================
# User Hierarchy (Inheritance & Encapsulation)
# ==========================================
class User:
    """Base User Entity illustrating encapsulation."""
    def __init__(self, user_id: str, email: str, full_name: str, role: UserRole):
        self._user_id = user_id
        self._email = email
        self._full_name = full_name
        self._role = role
        self._created_at = datetime.utcnow()

    @property
    def user_id(self) -> str:
        return self._user_id

    @property
    def email(self) -> str:
        return self._email

    @email.setter
    def email(self, value: str):
        if "@" not in value or "." not in value:
            raise ValueError("Invalid email format.")
        self._email = value

    @property
    def full_name(self) -> str:
        return self._full_name

    @full_name.setter
    def full_name(self, value: str):
        if not value or len(value.strip()) < 2:
            raise ValueError("Name must be at least 2 characters.")
        self._full_name = value.strip()

    @property
    def role(self) -> UserRole:
        return self._role

    def can_perform(self, action: str) -> bool:
        """Base permission check for actions."""
        return False


class Patient(User):
    """Patient Domain Entity."""
    def __init__(
        self,
        user_id: str,
        email: str,
        full_name: str,
        age: int,
        gender: str,
        medical_record_number: str
    ):
        super().__init__(user_id, email, full_name, UserRole.PATIENT)
        self._age = age
        self._gender = gender
        self._mrn = medical_record_number

    @property
    def age(self) -> int:
        return self._age

    @age.setter
    def age(self, value: int):
        if value < 0 or value > 150:
            raise InvalidMetricValueException("Age must be between 0 and 150.")
        self._age = value

    @property
    def gender(self) -> str:
        return self._gender

    @property
    def mrn(self) -> str:
        return self._mrn

    def can_perform(self, action: str) -> bool:
        allowed = {"view_own_reports", "download_pdf"}
        return action in allowed


class LabTechnician(User):
    """Lab Technician Domain Entity."""
    def __init__(self, user_id: str, email: str, full_name: str, employee_id: str):
        super().__init__(user_id, email, full_name, UserRole.LAB_TECHNICIAN)
        self._employee_id = employee_id

    @property
    def employee_id(self) -> str:
        return self._employee_id

    def can_perform(self, action: str) -> bool:
        allowed = {"create_draft", "enter_metrics", "evaluate_ranges", "request_ai_summary", "submit_for_approval"}
        return action in allowed


class Pathologist(User):
    """Pathologist/Doctor Domain Entity."""
    def __init__(self, user_id: str, email: str, full_name: str, license_number: str):
        super().__init__(user_id, email, full_name, UserRole.PATHOLOGIST)
        self._license_number = license_number

    @property
    def license_number(self) -> str:
        return self._license_number

    def can_perform(self, action: str) -> bool:
        allowed = {"view_pending_reports", "review_flags", "add_clinical_notes", "approve_report", "reject_report"}
        return action in allowed


class Admin(User):
    """Administrator Domain Entity."""
    def __init__(self, user_id: str, email: str, full_name: str):
        super().__init__(user_id, email, full_name, UserRole.ADMIN)

    def can_perform(self, action: str) -> bool:
        allowed = {"manage_users", "manage_templates", "view_audit_logs", "view_all_reports"}
        return action in allowed


# ==========================================
# Metric Domain Value Object
# ==========================================
class MetricEntry:
    """Encapsulates a single lab metric value and boundary validation."""
    def __init__(self, name: str, value: float, unit: str):
        if value < 0:
            raise InvalidMetricValueException(f"Metric '{name}' value cannot be negative ({value}).")
        self._name = name
        self._value = value
        self._unit = unit

    @property
    def name(self) -> str:
        return self._name

    @property
    def value(self) -> float:
        return self._value

    @property
    def unit(self) -> str:
        return self._unit

    def to_dict(self) -> dict:
        return {"name": self._name, "value": self._value, "unit": self._unit}


# ==========================================
# Report Domain Entity (State Machine)
# ==========================================
class Report:
    """
    Diagnostic Report Domain Entity.
    Strictly controls status state machine:
    DRAFT -> PENDING_APPROVAL -> APPROVED or REJECTED
    """
    def __init__(
        self,
        report_id: str,
        patient_id: str,
        technician_id: str,
        test_type: str,
        metrics: List[MetricEntry]
    ):
        self._report_id = report_id
        self._patient_id = patient_id
        self._technician_id = technician_id
        self._test_type = test_type
        self._metrics = metrics
        self._evaluated_flags: List[dict] = []
        self._ai_summary: Optional[str] = None
        self._pathologist_notes: Optional[str] = None
        self._approved_by_id: Optional[str] = None
        self._status = ReportStatus.DRAFT
        self._created_at = datetime.utcnow()
        self._updated_at = datetime.utcnow()

    @property
    def report_id(self) -> str:
        return self._report_id

    @property
    def patient_id(self) -> str:
        return self._patient_id

    @property
    def test_type(self) -> str:
        return self._test_type

    @property
    def metrics(self) -> List[MetricEntry]:
        return self._metrics

    @property
    def status(self) -> ReportStatus:
        return self._status

    @property
    def evaluated_flags(self) -> List[dict]:
        return self._evaluated_flags

    @evaluated_flags.setter
    def evaluated_flags(self, flags: List[dict]):
        self._evaluated_flags = flags

    @property
    def ai_summary(self) -> Optional[str]:
        return self._ai_summary

    @ai_summary.setter
    def ai_summary(self, summary: str):
        if not summary or len(summary.strip()) < 10:
            raise ValueError("AI summary must contain valid medical interpretation.")
        self._ai_summary = summary.strip()

    @property
    def pathologist_notes(self) -> Optional[str]:
        return self._pathologist_notes

    @property
    def approved_by_id(self) -> Optional[str]:
        return self._approved_by_id

    # ----------------------------------------------------
    # State Machine Transitions
    # ----------------------------------------------------
    def submit_for_approval(self, technician: LabTechnician):
        """Transition DRAFT -> PENDING_APPROVAL."""
        if not technician.can_perform("submit_for_approval"):
            raise UnauthorizedRoleException("Only a Lab Technician can submit reports for approval.")

        if self._status != ReportStatus.DRAFT:
            raise InvalidStateTransitionException(
                f"Cannot submit report in '{self._status.value}' state. Must be in DRAFT state."
            )

        if not self._metrics:
            raise DomainException("Cannot submit report without raw metrics.")

        if not self._ai_summary:
            raise DomainException("Cannot submit report for approval without AI medical summary.")

        self._status = ReportStatus.PENDING_APPROVAL
        self._updated_at = datetime.utcnow()

    def approve(self, pathologist: Pathologist, clinical_notes: Optional[str] = None):
        """Transition PENDING_APPROVAL -> APPROVED."""
        if not pathologist.can_perform("approve_report"):
            raise UnauthorizedRoleException("Only a Pathologist can approve lab reports.")

        if self._status != ReportStatus.PENDING_APPROVAL:
            raise InvalidStateTransitionException(
                f"Cannot approve report in '{self._status.value}' state. Must be PENDING_APPROVAL."
            )

        self._status = ReportStatus.APPROVED
        self._approved_by_id = pathologist.user_id
        self._pathologist_notes = clinical_notes
        self._updated_at = datetime.utcnow()

    def reject(self, pathologist: Pathologist, reason: str):
        """Transition PENDING_APPROVAL -> REJECTED."""
        if not pathologist.can_perform("reject_report"):
            raise UnauthorizedRoleException("Only a Pathologist can reject lab reports.")

        if self._status != ReportStatus.PENDING_APPROVAL:
            raise InvalidStateTransitionException(
                f"Cannot reject report in '{self._status.value}' state. Must be PENDING_APPROVAL."
            )

        if not reason or len(reason.strip()) < 5:
            raise DomainException("A valid rejection reason must be provided.")

        self._status = ReportStatus.REJECTED
        self._approved_by_id = pathologist.user_id
        self._pathologist_notes = f"REJECTED: {reason.strip()}"
        self._updated_at = datetime.utcnow()
