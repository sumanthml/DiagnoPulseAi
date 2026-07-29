"""
Smart Diagnostics - Audit Logger Service
Records immutable audit logs of platform events (Report creation, AI summaries, Sign-offs, Template updates)
supporting medical compliance & security standards.
"""

import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.database.models import DBAuditLog


class AuditLogger:
    """Audit Logging Helper."""

    @staticmethod
    def log_event(
        db: Session,
        user_id: str,
        action: str,
        entity_type: str,
        entity_id: str,
        details: str
    ):
        """Creates an audit log entry in database."""
        try:
            audit = DBAuditLog(
                id=str(uuid.uuid4()),
                user_id=user_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                details=details,
                timestamp=datetime.utcnow()
            )
            db.add(audit)
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Failed to record audit log: {e}")
