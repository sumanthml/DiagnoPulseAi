"""
Smart Diagnostics - Database Seeder
Seeds default system roles (Patients, Technicians, Pathologists, Admins)
and diagnostic test templates with clinical reference bounds.
"""

import uuid
from sqlalchemy.orm import Session
from app.database.connection import engine, Base, SessionLocal
from app.database.models import DBUser, DBTestTemplate, DBTemplateMetric, DBReport, DBReportMetric, DBAuditLog
from app.domain.models import UserRole, ReportStatus


def seed_database():
    """Initializes tables and populates seed data if empty."""
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 1. Update any existing legacy seed users (John Doe / Sarah Smith -> Sumanth Sunny)
        pat1 = db.query(DBUser).filter(DBUser.id == "pat-101").first()
        if pat1:
            pat1.full_name = "Sumanth Sunny"
            pat1.email = "sumanth.sunny@patient.com"
            db.commit()

        pat2 = db.query(DBUser).filter(DBUser.id == "pat-102").first()
        if pat2:
            pat2.full_name = "Alex Johnson"
            pat2.email = "alex.johnson@patient.com"
            db.commit()

        # 2. Seed Users if table is empty
        if db.query(DBUser).count() == 0:
            print("Seeding initial platform users...")
            users = [
                DBUser(
                    id="pat-101",
                    email="sumanth.sunny@patient.com",
                    full_name="Sumanth Sunny",
                    role=UserRole.PATIENT.value,
                    age=30,
                    gender="Male",
                    mrn="MRN-884920"
                ),
                DBUser(
                    id="pat-102",
                    email="alex.johnson@patient.com",
                    full_name="Alex Johnson",
                    role=UserRole.PATIENT.value,
                    age=28,
                    gender="Female",
                    mrn="MRN-773104"
                ),
                DBUser(
                    id="tech-201",
                    email="alex.tech@diagnopulse.com",
                    full_name="Alex Tech (Lab Tech)",
                    role=UserRole.LAB_TECHNICIAN.value,
                    employee_id="LT-4091"
                ),
                DBUser(
                    id="path-301",
                    email="dr.roberts@diagnopulse.com",
                    full_name="Dr. Eleanor Roberts, MD (Pathologist)",
                    role=UserRole.PATHOLOGIST.value,
                    license_number="MD-PATH-99302"
                ),
                DBUser(
                    id="admin-401",
                    email="admin@diagnopulse.com",
                    full_name="System Admin",
                    role=UserRole.ADMIN.value
                ),
            ]
            db.add_all(users)
            db.commit()

        # 3. Seed Test Templates if not present
        if db.query(DBTestTemplate).count() == 0:
            print("Seeding diagnostic test templates...")

            cbc = DBTestTemplate(
                id="tpl-cbc",
                name="Complete Blood Count (CBC)",
                code="CBC-001",
                category="Hematology",
                description="Evaluates overall health and detects blood disorders including anemia and infection."
            )
            cbc_metrics = [
                DBTemplateMetric(id="m-hb", template_id="tpl-cbc", metric_name="Hemoglobin", unit="g/dL", ref_min=13.8, ref_max=17.2),
                DBTemplateMetric(id="m-wbc", template_id="tpl-cbc", metric_name="WBC", unit="10^3/µL", ref_min=4.5, ref_max=11.0),
                DBTemplateMetric(id="m-rbc", template_id="tpl-cbc", metric_name="RBC", unit="10^6/µL", ref_min=4.3, ref_max=5.9),
                DBTemplateMetric(id="m-plt", template_id="tpl-cbc", metric_name="Platelets", unit="10^3/µL", ref_min=150.0, ref_max=450.0),
            ]

            lipid = DBTestTemplate(
                id="tpl-lipid",
                name="Lipid Profile",
                code="LIP-002",
                category="Cardiology / Biochemistry",
                description="Measures circulating cholesterol and triglycerides to assess cardiovascular risk."
            )
            lipid_metrics = [
                DBTemplateMetric(id="m-tc", template_id="tpl-lipid", metric_name="Total Cholesterol", unit="mg/dL", ref_min=120.0, ref_max=200.0),
                DBTemplateMetric(id="m-hdl", template_id="tpl-lipid", metric_name="HDL Cholesterol", unit="mg/dL", ref_min=40.0, ref_max=80.0),
                DBTemplateMetric(id="m-ldl", template_id="tpl-lipid", metric_name="LDL Cholesterol", unit="mg/dL", ref_min=50.0, ref_max=100.0),
                DBTemplateMetric(id="m-trig", template_id="tpl-lipid", metric_name="Triglycerides", unit="mg/dL", ref_min=40.0, ref_max=150.0),
            ]

            thyroid = DBTestTemplate(
                id="tpl-thyroid",
                name="Thyroid Profile",
                code="THY-003",
                category="Endocrinology",
                description="Assesses thyroid gland activity and metabolic hormone levels."
            )
            thyroid_metrics = [
                DBTemplateMetric(id="m-tsh", template_id="tpl-thyroid", metric_name="TSH", unit="mIU/L", ref_min=0.45, ref_max=4.5),
                DBTemplateMetric(id="m-ft3", template_id="tpl-thyroid", metric_name="Free T3", unit="pg/mL", ref_min=2.0, ref_max=4.4),
                DBTemplateMetric(id="m-ft4", template_id="tpl-thyroid", metric_name="Free T4", unit="ng/dL", ref_min=0.8, ref_max=1.8),
            ]

            liver = DBTestTemplate(
                id="tpl-liver",
                name="Liver Function Test",
                code="LFT-004",
                category="Hepatology",
                description="Evaluates hepatic enzymes, proteins, and bilirubin synthesis."
            )
            liver_metrics = [
                DBTemplateMetric(id="m-alt", template_id="tpl-liver", metric_name="ALT", unit="U/L", ref_min=7.0, ref_max=56.0),
                DBTemplateMetric(id="m-ast", template_id="tpl-liver", metric_name="AST", unit="U/L", ref_min=10.0, ref_max=40.0),
                DBTemplateMetric(id="m-bili", template_id="tpl-liver", metric_name="Total Bilirubin", unit="mg/dL", ref_min=0.1, ref_max=1.2),
                DBTemplateMetric(id="m-alb", template_id="tpl-liver", metric_name="Albumin", unit="g/dL", ref_min=3.4, ref_max=5.4),
            ]

            metabolic = DBTestTemplate(
                id="tpl-metabolic",
                name="Metabolic Panel",
                code="CMP-005",
                category="Biochemistry",
                description="Checks blood sugar balance, electrolyte equilibrium, and renal function."
            )
            metabolic_metrics = [
                DBTemplateMetric(id="m-glu", template_id="tpl-metabolic", metric_name="Fasting Glucose", unit="mg/dL", ref_min=70.0, ref_max=99.0),
                DBTemplateMetric(id="m-cre", template_id="tpl-metabolic", metric_name="Serum Creatinine", unit="mg/dL", ref_min=0.7, ref_max=1.3),
                DBTemplateMetric(id="m-na", template_id="tpl-metabolic", metric_name="Sodium", unit="mEq/L", ref_min=135.0, ref_max=145.0),
                DBTemplateMetric(id="m-k", template_id="tpl-metabolic", metric_name="Potassium", unit="mEq/L", ref_min=3.5, ref_max=5.0),
            ]

            urine = DBTestTemplate(
                id="tpl-urine",
                name="Urinalysis",
                code="URN-006",
                category="Nephrology / Biochemistry",
                description="Routine urine examination assessing kidney function, infection markers, and metabolic waste."
            )
            urine_metrics = [
                DBTemplateMetric(id="m-uph", template_id="tpl-urine", metric_name="Urine pH", unit="pH", ref_min=4.5, ref_max=8.0),
                DBTemplateMetric(id="m-usg", template_id="tpl-urine", metric_name="Specific Gravity", unit="SG", ref_min=1.005, ref_max=1.030),
                DBTemplateMetric(id="m-upro", template_id="tpl-urine", metric_name="Protein (Urine)", unit="mg/dL", ref_min=0.0, ref_max=14.0),
                DBTemplateMetric(id="m-uglu", template_id="tpl-urine", metric_name="Glucose (Urine)", unit="mg/dL", ref_min=0.0, ref_max=15.0),
                DBTemplateMetric(id="m-uwbc", template_id="tpl-urine", metric_name="WBC (Urine)", unit="cells/\u00b5L", ref_min=0.0, ref_max=5.0),
            ]

            db.add_all([cbc, lipid, thyroid, liver, metabolic, urine])
            db.add_all(cbc_metrics + lipid_metrics + thyroid_metrics + liver_metrics + metabolic_metrics + urine_metrics)
            db.commit()

        # 4. Seed Sample Approved Report for Sumanth Sunny if empty
        if db.query(DBReport).count() == 0:
            print("Seeding sample diagnostic report for Sumanth Sunny...")
            sample_report_id = "rep-sample-01"
            sample_report = DBReport(
                id=sample_report_id,
                patient_id="pat-101",
                technician_id="tech-201",
                approved_by_id="path-301",
                test_type="Complete Blood Count (CBC)",
                status=ReportStatus.APPROVED.value,
                ai_summary="Clinical Summary: The Hemoglobin level is slightly reduced at 11.2 g/dL (reference: 13.8-17.2 g/dL), indicating mild normocytic anemia. WBC count is normal at 6.8 10^3/µL, and Platelet count is well-preserved at 280 10^3/µL.",
                pathologist_notes="Verified diagnostic report for Sumanth Sunny."
            )

            metrics = [
                DBReportMetric(id=str(uuid.uuid4()), report_id=sample_report_id, metric_name="Hemoglobin", value=11.2, unit="g/dL", severity="LOW", message="Below normal threshold (13.8 g/dL)"),
                DBReportMetric(id=str(uuid.uuid4()), report_id=sample_report_id, metric_name="WBC", value=6.8, unit="10^3/µL", severity="NORMAL", message="Within reference limits"),
                DBReportMetric(id=str(uuid.uuid4()), report_id=sample_report_id, metric_name="RBC", value=4.1, unit="10^6/µL", severity="LOW", message="Below normal threshold (4.3 10^6/µL)"),
                DBReportMetric(id=str(uuid.uuid4()), report_id=sample_report_id, metric_name="Platelets", value=280.0, unit="10^3/µL", severity="NORMAL", message="Within reference limits")
            ]

            db.add(sample_report)
            db.add_all(metrics)
            db.commit()

        print("Database seeding completed successfully.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
