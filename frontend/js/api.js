/**
 * Smart Diagnostics - REST API Client Module
 */
const RENDER_BACKEND_URL = "https://diagnopulse-app.onrender.com";
const API_BASE = window.API_BASE || (window.location.hostname.includes("vercel.app") ? RENDER_BACKEND_URL : "");

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

  async getReports(patientId = null, statusFilter = null, roleView = null, technicianId = null) {
    let query = [];
    if (patientId) query.push(`patient_id=${encodeURIComponent(patientId)}`);
    if (statusFilter) query.push(`status_filter=${encodeURIComponent(statusFilter)}`);
    if (roleView) query.push(`role_view=${encodeURIComponent(roleView)}`);
    if (technicianId) query.push(`technician_id=${encodeURIComponent(technicianId)}`);

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

  async reopenReport(reportId) {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/reopen`, {
      method: "POST"
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to reopen report");
    }
    return await res.json();
  }

  async getReportStats() {
    const res = await fetch(`${API_BASE}/api/reports/stats`);
    if (!res.ok) throw new Error("Failed to fetch report statistics");
    return await res.json();
  }

  async getAdminStats() {
    const res = await fetch(`${API_BASE}/api/admin/stats`);
    if (!res.ok) throw new Error("Failed to fetch admin statistics");
    return await res.json();
  }

  async getAllAdminUsers(role = null) {
    const url = role ? `${API_BASE}/api/admin/users?role=${role}` : `${API_BASE}/api/admin/users`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch admin user list");
    return await res.json();
  }

  async updateUserRole(userId, newRole, adminId) {
    const res = await fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_role: newRole, admin_id: adminId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to update user role");
    }
    return await res.json();
  }

  async getTestTemplates() {
    const res = await fetch(`${API_BASE}/api/tests/templates`);
    if (!res.ok) throw new Error("Failed to fetch test templates");
    return await res.json();
  }

  async createTestTemplate(payload) {
    const res = await fetch(`${API_BASE}/api/tests/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create test template");
    }
    return await res.json();
  }

  async getAuditLogs(limit = 100) {
    const res = await fetch(`${API_BASE}/api/audit/logs?limit=${limit}`);
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
