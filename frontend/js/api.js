/**
 * Smart Diagnostics - REST API Client Module
 */
const API_BASE = window.API_BASE || ""; // Production Render Backend API URL or relative origin

class ApiService {
  async getUsers(role = null) {
    const url = role ? `${API_BASE}/api/auth/users?role=${role}` : `${API_BASE}/api/auth/users`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch users");
    return await res.json();
  }

  async createUser(payload) {
    const res = await fetch(`${API_BASE}/api/auth/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create user account");
    }
    return await res.json();
  }

  async getReports(patientId = null, statusFilter = null, roleView = null) {
    let query = [];
    if (patientId) query.push(`patient_id=${encodeURIComponent(patientId)}`);
    if (statusFilter) query.push(`status_filter=${encodeURIComponent(statusFilter)}`);
    if (roleView) query.push(`role_view=${encodeURIComponent(roleView)}`);

    const queryString = query.length ? `?${query.join("&")}` : "";
    const res = await fetch(`${API_BASE}/api/reports${queryString}`);
    if (!res.ok) throw new Error("Failed to fetch reports");
    return await res.json();
  }

  async getReportDetails(reportId) {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}`);
    if (!res.ok) throw new Error("Failed to fetch report details");
    return await res.json();
  }

  async createReportDraft(payload) {
    const res = await fetch(`${API_BASE}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create draft report");
    }
    return await res.json();
  }

  async generateAiSummary(reportId) {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/generate-ai-summary`, {
      method: "POST"
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to generate AI summary");
    }
    return await res.json();
  }

  async submitForApproval(reportId) {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/submit`, {
      method: "POST"
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to submit report");
    }
    return await res.json();
  }

  async approveReport(reportId, pathologistId, notes = "") {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathologist_id: pathologistId, notes: notes })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to approve report");
    }
    return await res.json();
  }

  async rejectReport(reportId, pathologistId, reason = "") {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathologist_id: pathologistId, rejection_reason: reason })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to reject report");
    }
    return await res.json();
  }

  async getTestTemplates() {
    const res = await fetch(`${API_BASE}/api/tests/templates`);
    if (!res.ok) throw new Error("Failed to fetch test templates");
    return await res.json();
  }

  async getAuditLogs() {
    const res = await fetch(`${API_BASE}/api/audit/logs`);
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return await res.json();
  }

  async uploadReportFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/reports/upload-file`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to parse lab file upload");
    }
    return await res.json();
  }

  getPdfUrl(reportId) {
    return `${API_BASE}/api/reports/${reportId}/pdf`;
  }
}

window.api = new ApiService();
