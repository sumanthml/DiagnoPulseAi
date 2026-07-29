"""
Smart Diagnostics - Authentication & User Management Router
Supports case-insensitive email matching and idempotent profile creation.
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database.models import DBUser
from app.domain.models import UserRole
from app.services.audit_logger import AuditLogger

router = APIRouter(prefix="/api/auth", tags=["Auth & User Management"])


class UserCreateSchema(BaseModel):
    email: str
    full_name: str
    role: UserRole
    age: Optional[int] = None
    gender: Optional[str] = None
    mrn: Optional[str] = None
    employee_id: Optional[str] = None
    license_number: Optional[str] = None


class UserResponseSchema(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    age: Optional[int] = None
    gender: Optional[str] = None
    mrn: Optional[str] = None
    employee_id: Optional[str] = None
    license_number: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/users", response_model=List[UserResponseSchema])
def list_users(role: Optional[str] = None, email: Optional[str] = None, db: Session = Depends(get_db)):
    """Lists system users filtered by role or case-insensitive email."""
    query = db.query(DBUser)
    if role:
        query = query.filter(DBUser.role == role.upper())
    if email:
        query = query.filter(func.lower(DBUser.email) == email.strip().lower())
    return query.all()


@router.get("/users/{user_id}", response_model=UserResponseSchema)
def get_user(user_id: str, db: Session = Depends(get_db)):
    """Fetches user profile by ID."""
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@router.post("/users", response_model=UserResponseSchema)
def create_or_update_user(payload: UserCreateSchema, db: Session = Depends(get_db)):
    """Registers or updates a user profile cleanly without duplicate key errors."""
    clean_email = payload.email.strip().lower()
    existing = db.query(DBUser).filter(func.lower(DBUser.email) == clean_email).first()

    if existing:
        # Idempotently update full name and attributes
        if payload.full_name and payload.full_name.strip():
            existing.full_name = payload.full_name.strip()
        if payload.age:
            existing.age = payload.age
        if payload.gender:
            existing.gender = payload.gender
        db.commit()
        db.refresh(existing)
        return existing

    new_id = f"{payload.role.value.lower()[:4]}-{str(uuid.uuid4())[:8]}"
    db_user = DBUser(
        id=new_id,
        email=clean_email,
        full_name=payload.full_name.strip(),
        role=payload.role.value,
        age=payload.age,
        gender=payload.gender,
        mrn=payload.mrn or (f"MRN-{str(uuid.uuid4())[:6].upper()}" if payload.role == UserRole.PATIENT else None),
        employee_id=payload.employee_id,
        license_number=payload.license_number
    )
    db.add(db_user)
    db.commit()

    AuditLogger.log_event(
        db=db,
        user_id=new_id,
        action="USER_CREATED",
        entity_type="USER",
        entity_id=new_id,
        details=f"Created {payload.role.value} profile for {payload.full_name}"
    )

    return db_user
