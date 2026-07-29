"""
Smart Diagnostics - Immutable Audit Log Router
"""

from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database.models import DBAuditLog

router = APIRouter(prefix="/api/audit", tags=["Audit Logs"])


@router.get("/logs")
def get_audit_logs(limit: int = 50, action_filter: Optional[str] = None, db: Session = Depends(get_db)):
    """Retrieves system audit log entries for Administrative compliance audit."""
    query = db.query(DBAuditLog)
    if action_filter:
        query = query.filter(DBAuditLog.action == action_filter.upper())

    logs = query.order_by(DBAuditLog.timestamp.desc()).limit(limit).all()

    result = []
    for l in logs:
        result.append({
            "id": l.id,
            "user_id": l.user_id,
            "user_name": l.user.full_name if l.user else "System",
            "user_role": l.user.role if l.user else "SYSTEM",
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "details": l.details,
            "timestamp": l.timestamp.isoformat() if l.timestamp else ""
        })
    return result
