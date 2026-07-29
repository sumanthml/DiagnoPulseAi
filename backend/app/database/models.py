"""
Smart Diagnostics - SQLAlchemy ORM Database Schemas
Mirrors Supabase PostgreSQL relational schema.
"""

from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database.connection import Base


class DBUser(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False, index=True) # PATIENT, LAB_TECHNICIAN, PATHOLOGIST, ADMIN
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    mrn = Column(String, nullable=True) # Patient Medical Record Number
    employee_id = Column(String, nullable=True) # Tech ID
    license_number = Column(String, nullable=True) # Doctor License
    created_at = Column(DateTime, default=datetime.utcnow)


class DBTestTemplate(Base):
    __tablename__ = "test_templates"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    category = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    metrics = relationship("DBTemplateMetric", back_populates="template", cascade="all, delete-orphan")


class DBTemplateMetric(Base):
    __tablename__ = "template_metrics"

    id = Column(String, primary_key=True, index=True)
    template_id = Column(String, ForeignKey("test_templates.id"), nullable=False)
    metric_name = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    ref_min = Column(Float, nullable=True)
    ref_max = Column(Float, nullable=True)

    template = relationship("DBTestTemplate", back_populates="metrics")


class DBReport(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("users.id"), nullable=False)
    technician_id = Column(String, ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    test_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="DRAFT", index=True)
    ai_summary = Column(Text, nullable=True)
    pathologist_notes = Column(Text, nullable=True)
    pdf_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("DBUser", foreign_keys=[patient_id])
    technician = relationship("DBUser", foreign_keys=[technician_id])
    approved_by = relationship("DBUser", foreign_keys=[approved_by_id])
    report_metrics = relationship("DBReportMetric", back_populates="report", cascade="all, delete-orphan")


class DBReportMetric(Base):
    __tablename__ = "report_metrics"

    id = Column(String, primary_key=True, index=True)
    report_id = Column(String, ForeignKey("reports.id"), nullable=False)
    metric_name = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="NORMAL") # NORMAL, LOW, HIGH, CRITICAL
    message = Column(String, nullable=True)

    report = relationship("DBReport", back_populates="report_metrics")


class DBAuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("DBUser")
