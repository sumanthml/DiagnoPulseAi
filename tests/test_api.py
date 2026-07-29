"""
Smart Diagnostics - API & Integration Tests
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_list_users():
    response = client.get("/api/auth/users")
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 4


def test_list_test_templates():
    response = client.get("/api/tests/templates")
    assert response.status_code == 200
    templates = response.json()
    assert len(templates) >= 4


def test_list_reports():
    response = client.get("/api/reports")
    assert response.status_code == 200
    reports = response.json()
    assert isinstance(reports, list)


def test_pdf_report_download():
    # Fetch sample report ID
    response = client.get("/api/reports")
    reports = response.json()
    if reports:
        rep_id = reports[0]["id"]
        pdf_res = client.get(f"/api/reports/{rep_id}/pdf")
        assert pdf_res.status_code == 200
        assert pdf_res.headers["content-type"] == "application/pdf"
        assert pdf_res.content.startswith(b"%PDF")
