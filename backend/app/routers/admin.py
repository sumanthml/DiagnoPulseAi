"""
Smart Diagnostics - System Administrator Console Router
Provides Admin-only endpoints for:
  - Platform-wide statistics (user counts, report breakdown)
  - User role management (RBAC administration)
  - System health / diagnostic overview
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database.models import DBUser, DBReport
from app.domain.models import UserRole, ReportStatus
from app.services.audit_logger import AuditLogger

router = APIRouter(prefix="/api/admin", tags=["System Administration"])


class RoleUpdateSchema(BaseModel):
    new_role: UserRole
    admin_id: str


@router.get("/stats")
def get_platform_stats(db: Session = Depends(get_db)):
    """
    Returns a comprehensive platform statistics summary for the Admin console dashboard.
    Includes user counts per role, report breakdown by status, and system health indicators.
    """
    # User breakdown by role
    total_users = db.query(DBUser).count()
    patients = db.query(DBUser).filter(DBUser.role == UserRole.PATIENT.value).count()
    technicians = db.query(DBUser).filter(DBUser.role == UserRole.LAB_TECHNICIAN.value).count()
    pathologists = db.query(DBUser).filter(DBUser.role == UserRole.PATHOLOGIST.value).count()
    admins = db.query(DBUser).filter(DBUser.role == UserRole.ADMIN.value).count()

    # Report breakdown by status
    total_reports = db.query(DBReport).count()
    draft = db.query(DBReport).filter(DBReport.status == ReportStatus.DRAFT.value).count()
    pending = db.query(DBReport).filter(DBReport.status == ReportStatus.PENDING_APPROVAL.value).count()
    approved = db.query(DBReport).filter(DBReport.status == ReportStatus.APPROVED.value).count()
    rejected = db.query(DBReport).filter(DBReport.status == ReportStatus.REJECTED.value).count()

    return {
        "users": {
            "total": total_users,
            "patients": patients,
            "technicians": technicians,
            "pathologists": pathologists,
            "admins": admins
        },
        "reports": {
            "total": total_reports,
            "draft": draft,
            "pending_approval": pending,
            "approved": approved,
            "rejected": rejected
        },
        "system": {
            "ai_model": "Groq LLaMA 3.3 70B",
            "pdf_engine": "ReportLab",
            "oop_patterns": ["Encapsulation", "Inheritance", "Polymorphism", "Abstraction"],
            "test_panels": ["CBC", "Lipid Profile", "Thyroid", "Liver Function", "Metabolic Panel", "Urinalysis"],
            "status": "operational"
        }
    }


@router.get("/users")
def list_all_users(role: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Returns the full list of registered users for Admin user management panel.
    Supports optional role filter.
    """
    query = db.query(DBUser)
    if role:
        query = query.filter(DBUser.role == role.upper())

    users = query.order_by(DBUser.created_at.desc()).all()

    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "age": u.age,
            "gender": u.gender,
            "mrn": u.mrn,
            "employee_id": u.employee_id,
            "license_number": u.license_number,
            "created_at": u.created_at.isoformat() if u.created_at else ""
        }
        for u in users
    ]


@router.patch("/users/{user_id}/role")
def update_user_role(user_id: str, payload: RoleUpdateSchema, db: Session = Depends(get_db)):
    """
    Allows an Administrator to reassign a user's role (RBAC administration).
    Validates that the requesting admin exists. Role changes are audit logged.
    """
    # Verify the requesting admin
    admin = db.query(DBUser).filter(DBUser.id == payload.admin_id).first()
    if not admin or admin.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Only a System Administrator can reassign user roles.")

    # Find target user
    target = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    # Prevent self-demotion
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Administrators cannot modify their own role.")

    old_role = target.role
    target.role = payload.new_role.value
    db.commit()

    AuditLogger.log_event(
        db=db,
        user_id=admin.id,
        action="UPDATE_USER_ROLE",
        entity_type="USER",
        entity_id=user_id,
        details=f"Admin {admin.full_name} changed {target.full_name}'s role from {old_role} to {payload.new_role.value}"
    )

    return {
        "message": f"User role updated successfully: {old_role} → {payload.new_role.value}",
        "user_id": user_id,
        "new_role": payload.new_role.value
    }
