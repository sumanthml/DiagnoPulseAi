"""
Smart Diagnostics - Diagnostic Test Templates Router
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database.models import DBTestTemplate, DBTemplateMetric
from app.services.audit_logger import AuditLogger

router = APIRouter(prefix="/api/tests", tags=["Test Templates"])


class MetricSpecSchema(BaseModel):
    metric_name: str
    unit: str
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None


class TemplateCreateSchema(BaseModel):
    name: str
    code: str
    category: str
    description: str
    metrics: List[MetricSpecSchema]


@router.get("/templates")
def list_test_templates(db: Session = Depends(get_db)):
    """Lists all available diagnostic test templates."""
    templates = db.query(DBTestTemplate).all()
    result = []
    for t in templates:
        metrics = []
        for m in t.metrics:
            metrics.append({
                "id": m.id,
                "metric_name": m.metric_name,
                "unit": m.unit,
                "ref_min": m.ref_min,
                "ref_max": m.ref_max
            })
        result.append({
            "id": t.id,
            "name": t.name,
            "code": t.code,
            "category": t.category,
            "description": t.description,
            "metrics": metrics
        })
    return result


@router.post("/templates")
def create_test_template(payload: TemplateCreateSchema, db: Session = Depends(get_db)):
    """Allows Admins to create new diagnostic test templates."""
    existing = db.query(DBTestTemplate).filter(DBTestTemplate.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Template code already exists.")

    template_id = f"tpl-{str(uuid.uuid4())[:8]}"
    tpl = DBTestTemplate(
        id=template_id,
        name=payload.name,
        code=payload.code,
        category=payload.category,
        description=payload.description
    )
    db.add(tpl)

    metrics = []
    for m in payload.metrics:
        metrics.append(DBTemplateMetric(
            id=str(uuid.uuid4()),
            template_id=template_id,
            metric_name=m.metric_name,
            unit=m.unit,
            ref_min=m.ref_min,
            ref_max=m.ref_max
        ))
    db.add_all(metrics)
    db.commit()

    AuditLogger.log_event(
        db=db,
        user_id="admin-401",
        action="CREATE_TEST_TEMPLATE",
        entity_type="TEST_TEMPLATE",
        entity_id=template_id,
        details=f"Created new test template: {payload.name} ({payload.code})"
    )

    return {"message": "Test template created successfully", "template_id": template_id}
