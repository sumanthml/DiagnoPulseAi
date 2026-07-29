-- =============================================================================
-- SMART DIAGNOSTICS: SUPABASE POSTGRESQL DATABASE SCHEMA (schema.sql)
-- Copy and paste this script directly into your Supabase SQL Editor and click "Run".
-- =============================================================================

-- 1. Drop existing tables if re-initializing
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS report_metrics CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS template_metrics CASCADE;
DROP TABLE IF EXISTS test_templates CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Create Platform Users Table
CREATE TABLE users (
    id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('PATIENT', 'LAB_TECHNICIAN', 'PATHOLOGIST', 'ADMIN')),
    age INT CHECK (age >= 0 AND age <= 150),
    gender VARCHAR(20),
    mrn VARCHAR(100),
    employee_id VARCHAR(100),
    license_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 3. Create Diagnostic Test Templates Table
CREATE TABLE test_templates (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT
);

-- 4. Create Template Metric Reference Ranges Table
CREATE TABLE template_metrics (
    id VARCHAR(100) PRIMARY KEY,
    template_id VARCHAR(100) NOT NULL REFERENCES test_templates(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    ref_min DOUBLE PRECISION,
    ref_max DOUBLE PRECISION
);

CREATE INDEX idx_template_metrics_template_id ON template_metrics(template_id);

-- 5. Create Diagnostic Reports Table
CREATE TABLE reports (
    id VARCHAR(100) PRIMARY KEY,
    patient_id VARCHAR(100) NOT NULL REFERENCES users(id),
    technician_id VARCHAR(100) NOT NULL REFERENCES users(id),
    approved_by_id VARCHAR(100) REFERENCES users(id),
    test_type VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    ai_summary TEXT,
    pathologist_notes TEXT,
    pdf_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_patient_id ON reports(patient_id);
CREATE INDEX idx_reports_status ON reports(status);

-- 6. Create Report Metrics Table
CREATE TABLE report_metrics (
    id VARCHAR(100) PRIMARY KEY,
    report_id VARCHAR(100) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(50) NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'NORMAL' CHECK (severity IN ('NORMAL', 'LOW', 'HIGH', 'CRITICAL')),
    message TEXT
);

CREATE INDEX idx_report_metrics_report_id ON report_metrics(report_id);

-- 7. Create Immutable Audit Logs Table
CREATE TABLE audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- =============================================================================
-- SEED DATA POPULATION
-- =============================================================================

-- Seed System Users
INSERT INTO users (id, email, full_name, role, age, gender, mrn, employee_id, license_number) VALUES
('pat-101', 'john.doe@patient.com', 'John Doe', 'PATIENT', 42, 'Male', 'MRN-884920', NULL, NULL),
('pat-102', 'sarah.smith@patient.com', 'Sarah Smith', 'PATIENT', 35, 'Female', 'MRN-773104', NULL, NULL),
('tech-201', 'alex.tech@diagnopulse.com', 'Alex Tech (Lab Tech)', 'LAB_TECHNICIAN', NULL, NULL, NULL, 'LT-4091', NULL),
('path-301', 'dr.roberts@diagnopulse.com', 'Dr. Eleanor Roberts, MD', 'PATHOLOGIST', NULL, NULL, NULL, NULL, 'MD-PATH-99302'),
('admin-401', 'admin@diagnopulse.com', 'System Admin', 'ADMIN', NULL, NULL, NULL, NULL, NULL);

-- Seed Diagnostic Test Templates
INSERT INTO test_templates (id, name, code, category, description) VALUES
('tpl-cbc', 'Complete Blood Count (CBC)', 'CBC-001', 'Hematology', 'Evaluates overall health and detects blood disorders including anemia and infection.'),
('tpl-lipid', 'Lipid Profile', 'LIP-002', 'Cardiology / Biochemistry', 'Measures circulating cholesterol and triglycerides to assess cardiovascular risk.'),
('tpl-thyroid', 'Thyroid Profile', 'THY-003', 'Endocrinology', 'Assesses thyroid gland activity and metabolic hormone levels.'),
('tpl-liver', 'Liver Function Test', 'LFT-004', 'Hepatology', 'Evaluates hepatic enzymes, proteins, and bilirubin synthesis.'),
('tpl-metabolic', 'Metabolic Panel', 'CMP-005', 'Biochemistry', 'Checks blood sugar balance, electrolyte equilibrium, and renal function.');

-- Seed Template Metrics
INSERT INTO template_metrics (id, template_id, metric_name, unit, ref_min, ref_max) VALUES
('m-hb', 'tpl-cbc', 'Hemoglobin', 'g/dL', 13.8, 17.2),
('m-wbc', 'tpl-cbc', 'WBC', '10^3/µL', 4.5, 11.0),
('m-rbc', 'tpl-cbc', 'RBC', '10^6/µL', 4.3, 5.9),
('m-plt', 'tpl-cbc', 'Platelets', '10^3/µL', 150.0, 450.0),
('m-tc', 'tpl-lipid', 'Total Cholesterol', 'mg/dL', 120.0, 200.0),
('m-hdl', 'tpl-lipid', 'HDL Cholesterol', 'mg/dL', 40.0, 80.0),
('m-ldl', 'tpl-lipid', 'LDL Cholesterol', 'mg/dL', 50.0, 100.0),
('m-trig', 'tpl-lipid', 'Triglycerides', 'mg/dL', 40.0, 150.0),
('m-tsh', 'tpl-thyroid', 'TSH', 'mIU/L', 0.45, 4.5),
('m-ft3', 'tpl-thyroid', 'Free T3', 'pg/mL', 2.0, 4.4),
('m-ft4', 'tpl-thyroid', 'Free T4', 'ng/dL', 0.8, 1.8),
('m-alt', 'tpl-liver', 'ALT', 'U/L', 7.0, 56.0),
('m-ast', 'tpl-liver', 'AST', 'U/L', 10.0, 40.0),
('m-bili', 'tpl-liver', 'Total Bilirubin', 'mg/dL', 0.1, 1.2),
('m-alb', 'tpl-liver', 'Albumin', 'g/dL', 3.4, 5.4),
('m-glu', 'tpl-metabolic', 'Fasting Glucose', 'mg/dL', 70.0, 99.0),
('m-cre', 'tpl-metabolic', 'Serum Creatinine', 'mg/dL', 0.7, 1.3),
('m-na', 'tpl-metabolic', 'Sodium', 'mEq/L', 135.0, 145.0),
('m-k', 'tpl-metabolic', 'Potassium', 'mEq/L', 3.5, 5.0);

-- Seed Sample Report
INSERT INTO reports (id, patient_id, technician_id, approved_by_id, test_type, status, ai_summary, pathologist_notes) VALUES
('rep-sample-01', 'pat-101', 'tech-201', 'path-301', 'Complete Blood Count (CBC)', 'APPROVED', 
'Clinical Summary: The Hemoglobin level is slightly reduced at 11.2 g/dL (reference: 13.8-17.2 g/dL), indicating mild normocytic anemia. WBC count is normal at 6.8 10^3/µL, and Platelet count is well-preserved at 280 10^3/µL.',
'Verified mild anemia pattern. Agreed with AI summary recommendations. Recommended iron profile follow-up in 4 weeks.');

INSERT INTO report_metrics (id, report_id, metric_name, value, unit, severity, message) VALUES
('rm-1', 'rep-sample-01', 'Hemoglobin', 11.2, 'g/dL', 'LOW', 'Below normal threshold (13.8 g/dL)'),
('rm-2', 'rep-sample-01', 'WBC', 6.8, '10^3/µL', 'NORMAL', 'Within reference limits'),
('rm-3', 'rep-sample-01', 'RBC', 4.1, '10^6/µL', 'LOW', 'Below normal threshold (4.3 10^6/µL)'),
('rm-4', 'rep-sample-01', 'Platelets', 280.0, '10^3/µL', 'NORMAL', 'Within reference limits');

INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details) VALUES
('aud-01', 'path-301', 'APPROVE_REPORT', 'REPORT', 'rep-sample-01', 'Pathologist approved CBC diagnostic report with clinical notes.');
