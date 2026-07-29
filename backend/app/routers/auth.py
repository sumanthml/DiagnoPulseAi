"""
Smart Diagnostics - Authentication & User Management Router
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
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
def list_users(role: Optional[str] = None, db: Session = Depends(get_db)):
    """Lists system users filtered by role."""
    query = db.query(DBUser)
    if role:
        query = query.filter(DBUser.role == role.upper())
    return query.all()


@router.get("/users/{user_id}", response_model=UserResponseSchema)
def get_user(user_id: str, db: Session = Depends(get_db)):
    """Fetches user profile by ID."""
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@router.post("/users", response_model=UserResponseSchema)
def create_user(payload: UserCreateSchema, db: Session = Depends(get_db)):
    """Registers a new user into system."""
    existing = db.query(DBUser).filter(DBUser.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    new_id = f"{payload.role.value.lower()[:4]}-{str(uuid.uuid4())[:8]}"
    db_user = DBUser(
        id=new_id,
        email=payload.email,
        full_name=payload.full_name,
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
