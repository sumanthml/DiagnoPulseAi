/**
 * Smart Diagnostics - Application Controller (Firebase Auth & Live Gauge Engine)
 */

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAVWH58fyrMbiRK8kEsdDvqFs8qUI5O-kA",
  authDomain: "dagnoai.firebaseapp.com",
  projectId: "dagnoai",
  storageBucket: "dagnoai.firebasestorage.app",
  messagingSenderId: "931166501279",
  appId: "1:931166501279:web:ee4b449a3f52b97ec725aa",
  measurementId: "G-YSLWG8ED7H"
};

class AppController {
  constructor() {
    this.activeRole = "PATIENT";
    this.activeUser = null;
    this.testTemplates = [];
    this.patients = [];
    this.technicians = [];
    this.pathologists = [];
    this.firebaseAuth = null;

    this.initFirebase();
    this.init();
  }

  initFirebase() {
    try {
      if (window.firebase && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        this.firebaseAuth = firebase.auth();
        console.log("Firebase Auth SDK initialized successfully.");

        this.firebaseAuth.onAuthStateChanged((user) => {
          if (user) {
            console.log("Firebase Authenticated User:", user.email);
            document.getElementById("authModal").classList.remove("active");
          } else {
            console.log("No Firebase session. Showing Auth Modal.");
          }
        });
      }
    } catch (e) {
      console.warn("Firebase Auth Notice:", e);
    }
  }

  async init() {
    this.bindEvents();
    await this.loadInitialData();
    this.setRole(this.activeRole);
  }

  bindEvents() {
    // Role Pills Top Bar
    document.querySelectorAll(".role-pill").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const role = e.currentTarget.dataset.role;
        this.setRole(role);
      });
    });

    // Sidebar Nav Items
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const view = e.currentTarget.dataset.view;
        this.setRole(view);
      });
    });

    // Tech Form Select
    const templateSelect = document.getElementById("selectTemplate");
    if (templateSelect) {
      templateSelect.addEventListener("change", () => this.renderMetricInputs());
    }

    const techForm = document.getElementById("techCreateReportForm");
    if (techForm) {
      techForm.addEventListener("submit", (e) => this.handleTechFormSubmit(e));
    }

    // Auth Forms
    const loginForm = document.getElementById("formLogin");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => this.handleLogin(e));
    }

    const regForm = document.getElementById("formRegister");
    if (regForm) {
      regForm.addEventListener("submit", (e) => this.handleRegister(e));
    }
  }

  switchAuthTab(tab) {
    document.getElementById("tabLogin").classList.toggle("active", tab === "login");
    document.getElementById("tabRegister").classList.toggle("active", tab === "register");
    document.getElementById("formLogin").classList.toggle("active", tab === "login");
    document.getElementById("formRegister").classList.toggle("active", tab === "register");
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("btnLoginSubmit");

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;

    try {
      if (this.firebaseAuth) {
        await this.firebaseAuth.signInWithEmailAndPassword(email, password);
      }
      this.showToast("Signed in successfully via Firebase Auth!", "success");
      document.getElementById("authModal").classList.remove("active");
    } catch (err) {
      this.showToast(err.message || "Authentication failed.", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Sign In to Portal`;
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById("regFullName").value;
    const role = document.getElementById("regRole").value;
    const age = parseInt(document.getElementById("regAge").value) || 30;
    const gender = document.getElementById("regGender").value;
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;
    const btn = document.getElementById("btnRegisterSubmit");

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...`;

    try {
      if (this.firebaseAuth) {
        await this.firebaseAuth.createUserWithEmailAndPassword(email, password);
      }

      // Sync user profile to Supabase database
      await window.api.createUser({
        email: email,
        full_name: fullName,
        role: role,
        age: age,
        gender: gender
      });

      this.showToast("Firebase Account created & synced to Supabase!", "success");
      document.getElementById("authModal").classList.remove("active");
      await this.loadInitialData();
      this.setRole(role);
    } catch (err) {
      this.showToast(err.message || "Registration failed.", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Create Firebase Account`;
    }
  }

  demoQuickLogin(role) {
    this.setRole(role);
    document.getElementById("authModal").classList.remove("active");
    this.showToast(`Logged in as Quick Demo Persona: ${role}`, "success");
  }

  handleSignOut() {
    if (this.firebaseAuth) {
      this.firebaseAuth.signOut();
    }
    document.getElementById("authModal").classList.add("active");
    this.showToast("Signed out of session.", "info");
  }

  async loadInitialData() {
    try {
      this.patients = await window.api.getUsers("PATIENT");
      this.technicians = await window.api.getUsers("LAB_TECHNICIAN");
      this.pathologists = await window.api.getUsers("PATHOLOGIST");
      this.testTemplates = await window.api.getTestTemplates();

      this.populateTechFormSelects();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  populateTechFormSelects() {
    const patientSelect = document.getElementById("selectPatient");
    const templateSelect = document.getElementById("selectTemplate");

    if (patientSelect) {
      patientSelect.innerHTML = this.patients.map(p => 
        `<option value="${p.id}">${p.full_name} (${p.mrn || 'MRN-884920'}) - Age ${p.age || 30}</option>`
      ).join("");
    }

    if (templateSelect) {
      templateSelect.innerHTML = this.testTemplates.map(t => 
        `<option value="${t.name}">${t.name} (${t.code})</option>`
      ).join("");
      this.renderMetricInputs();
    }
  }

  renderMetricInputs() {
    const templateSelect = document.getElementById("selectTemplate");
    const container = document.getElementById("metricsInputContainer");
    if (!templateSelect || !container) return;

    const selectedName = templateSelect.value;
    const tpl = this.testTemplates.find(t => t.name === selectedName);
    if (!tpl || !tpl.metrics) return;

    const sampleDefaults = {
      "Hemoglobin": 11.2,
      "WBC": 6.8,
      "RBC": 4.1,
      "Platelets": 280.0,
      "Total Cholesterol": 224.0,
      "HDL Cholesterol": 38.0,
      "LDL Cholesterol": 135.0,
      "Triglycerides": 180.0,
      "TSH": 5.8,
      "Free T3": 3.1,
      "Free T4": 1.1,
      "ALT": 68.0,
      "AST": 42.0,
      "Total Bilirubin": 0.8,
      "Albumin": 4.1,
      "Fasting Glucose": 115.0,
      "Serum Creatinine": 1.1,
      "Sodium": 140.0,
      "Potassium": 4.2
    };

    container.innerHTML = tpl.metrics.map(m => {
      const defVal = sampleDefaults[m.metric_name] !== undefined ? sampleDefaults[m.metric_name] : 10.0;
      const min = m.ref_min !== null ? m.ref_min : 0;
      const max = m.ref_max !== null ? m.ref_max : 100;

      return `
        <div class="metric-gauge-card">
          <div class="gauge-header">
            <span class="gauge-title">${m.metric_name} (${m.unit})</span>
            <span class="severity-pill NORMAL" id="badge_${m.metric_name}">NORMAL</span>
          </div>

          <div style="display:flex; align-items:center; gap:0.75rem;">
            <input type="number" step="0.1" class="form-control metric-value-input" 
                   data-name="${m.metric_name}" data-unit="${m.unit}" data-min="${min}" data-max="${max}" 
                   value="${defVal}" required style="width:110px;"
                   oninput="app.updateLiveGauge(this)" />
            
            <div style="flex:1;">
              <div class="gauge-meter-bar">
                <div class="gauge-indicator" id="gauge_${m.metric_name}" style="left: 50%;"></div>
              </div>
              <div class="gauge-bounds">
                <span>Min: ${min} ${m.unit}</span>
                <span>Max: ${max} ${m.unit}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Initial calculation of gauges
    document.querySelectorAll(".metric-value-input").forEach(inp => this.updateLiveGauge(inp));
  }

  updateLiveGauge(input) {
    const val = parseFloat(input.value) || 0;
    const min = parseFloat(input.dataset.min) || 0;
    const max = parseFloat(input.dataset.max) || 100;
    const name = input.dataset.name;

    const gaugeEl = document.getElementById(`gauge_${name}`);
    const badgeEl = document.getElementById(`badge_${name}`);

    if (!gaugeEl || !badgeEl) return;

    // Calculate percentage range position (clamp between 5% and 95%)
    let pct = 50;
    if (max > min) {
      pct = ((val - (min * 0.7)) / ((max * 1.3) - (min * 0.7))) * 100;
      pct = Math.max(5, Math.min(95, pct));
    }
    gaugeEl.style.left = `${pct}%`;

    // Determine Live Severity Badge
    if (val < min) {
      badgeEl.className = "severity-pill LOW";
      badgeEl.textContent = "LOW";
    } else if (val > max) {
      badgeEl.className = "severity-pill HIGH";
      badgeEl.textContent = "HIGH";
    } else {
      badgeEl.className = "severity-pill NORMAL";
      badgeEl.textContent = "NORMAL";
    }
  }

  setRole(role) {
    this.activeRole = role;

    // Update Role Pills & Sidebar Nav
    document.querySelectorAll(".role-pill").forEach(btn => btn.classList.toggle("active", btn.dataset.role === role));
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === role));

    if (role === "PATIENT") {
      this.activeUser = this.patients[0] || { full_name: "John Doe", mrn: "MRN-884920" };
    } else if (role === "LAB_TECHNICIAN") {
      this.activeUser = this.technicians[0] || { full_name: "Alex Tech", employee_id: "LT-4091" };
    } else if (role === "PATHOLOGIST") {
      this.activeUser = this.pathologists[0] || { full_name: "Dr. Eleanor Roberts, MD" };
    } else {
      this.activeUser = { full_name: "System Admin" };
    }

    document.getElementById("userNameLabel").textContent = this.activeUser.full_name;
    document.getElementById("userRoleTag").textContent = role;
    document.getElementById("userAvatar").textContent = this.activeUser.full_name.split(' ').map(n => n[0]).join('').substring(0,2);

    document.querySelectorAll(".dashboard-view").forEach(el => el.classList.remove("active"));

    if (role === "PATIENT") {
      document.getElementById("viewPatient").classList.add("active");
      this.loadPatientView();
    } else if (role === "LAB_TECHNICIAN") {
      document.getElementById("viewTech").classList.add("active");
      this.loadTechView();
    } else if (role === "PATHOLOGIST") {
      document.getElementById("viewPathologist").classList.add("active");
      this.loadPathologistView();
    } else if (role === "ADMIN") {
      document.getElementById("viewAdmin").classList.add("active");
      this.loadAdminView();
    }
  }

  async loadPatientView() {
    const container = document.getElementById("patientReportsList");
    container.innerHTML = `<div class="glass-card"><i class="fa-solid fa-spinner fa-spin"></i> Loading verified reports...</div>`;

    try {
      const patientId = this.patients[0] ? this.patients[0].id : "pat-101";
      const reports = await window.api.getReports(patientId, "APPROVED", "PATIENT");

      document.getElementById("patientStatTotal").textContent = reports.length;

      if (reports.length === 0) {
        container.innerHTML = `
          <div class="glass-card" style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:2rem;">
            <i class="fa-solid fa-folder-open" style="font-size:2.5rem; margin-bottom:0.5rem;"></i>
            <p>No verified diagnostic reports available yet.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = reports.map(r => `
        <div class="glass-card report-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
            <div>
              <div style="font-family:var(--font-heading); font-size:1.15rem; font-weight:700;">${r.test_type}</div>
              <small class="text-muted"><i class="fa-regular fa-calendar"></i> ${r.created_at.split('T')[0]}</small>
            </div>
            <span class="status-badge ${r.status}">${r.status}</span>
          </div>

          <div class="ai-highlight-box">
            <div class="ai-box-title"><i class="fa-solid fa-brain"></i> AI Medical Interpretation Summary</div>
            <p>${r.ai_summary ? r.ai_summary.substring(0, 180) + '...' : 'No AI summary.'}</p>
          </div>

          <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.5rem;">
            <i class="fa-solid fa-signature text-emerald"></i> Pathologist: <strong>${r.approved_by_name || 'Dr. Eleanor Roberts, MD'}</strong>
          </div>

          <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
            <button class="btn btn-primary btn-sm" onclick="app.viewReportModal('${r.id}')"><i class="fa-solid fa-eye"></i> Details</button>
            <a href="${window.api.getPdfUrl(r.id)}" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-file-pdf"></i> Download PDF</a>
          </div>
        </div>
      `).join("");
    } catch (err) {
      container.innerHTML = `<div class="glass-card text-high">${err.message}</div>`;
    }
  }

  async loadTechView() {
    this.loadTechQueue();
  }

  async handleTechFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitTechReport");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Evaluating Ranges...`;

    try {
      const patientId = document.getElementById("selectPatient").value;
      const testType = document.getElementById("selectTemplate").value;
      const techId = this.technicians[0] ? this.technicians[0].id : "tech-201";

      const inputs = document.querySelectorAll(".metric-value-input");
      const metricsPayload = Array.from(inputs).map(inp => ({
        name: inp.dataset.name,
        value: parseFloat(inp.value),
        unit: inp.dataset.unit
      }));

      const res = await window.api.createReportDraft({
        patient_id: patientId,
        technician_id: techId,
        test_type: testType,
        metrics: metricsPayload
      });

      this.showToast(`Draft created! Running Groq AI summary engine...`, "success");
      await window.api.generateAiSummary(res.report_id);
      await window.api.submitForApproval(res.report_id);

      this.showToast(`Submitted to Pathologist queue!`, "success");
      this.loadTechQueue();
    } catch (err) {
      this.showToast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-microscope"></i> Evaluate Ranges & Save Draft`;
    }
  }

  async loadTechQueue() {
    const queueList = document.getElementById("techQueueList");
    if (!queueList) return;

    try {
      const reports = await window.api.getReports();
      if (reports.length === 0) {
        queueList.innerHTML = `<p class="text-muted" style="font-size:0.85rem;">No recent technician entries.</p>`;
        return;
      }

      queueList.innerHTML = reports.map(r => `
        <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); padding:0.75rem; border-radius:10px; margin-bottom:0.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <strong style="font-size:0.9rem;">${r.test_type}</strong>
            <span class="status-badge ${r.status}">${r.status}</span>
          </div>
          <div style="font-size:0.775rem; color:var(--text-muted);">
            Patient: ${r.patient_name} (${r.patient_mrn})
          </div>
          <div style="margin-top:0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="app.viewReportModal('${r.id}')"><i class="fa-solid fa-eye"></i> Details</button>
          </div>
        </div>
      `).join("");
    } catch (err) {
      queueList.innerHTML = `<p class="text-high">${err.message}</p>`;
    }
  }

  async loadPathologistView() {
    const queue = document.getElementById("pathologistQueueList");
    const badge = document.getElementById("pendingCountBadge");
    queue.innerHTML = `<div class="glass-card"><i class="fa-solid fa-spinner fa-spin"></i> Fetching pending reports...</div>`;

    try {
      const reports = await window.api.getReports(null, "PENDING_APPROVAL");
      badge.textContent = `${reports.length} Pending Approvals`;

      if (reports.length === 0) {
        queue.innerHTML = `
          <div class="glass-card" style="text-align:center; color:var(--text-muted); padding:2.5rem;">
            <i class="fa-solid fa-circle-check text-emerald" style="font-size:2.5rem; margin-bottom:0.5rem;"></i>
            <h3>All Reports Verified!</h3>
            <p>No reports currently awaiting pathologist review.</p>
          </div>
        `;
        return;
      }

      queue.innerHTML = reports.map(r => `
        <div class="glass-card" style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <h3 style="font-family:var(--font-heading); font-size:1.15rem;">${r.test_type}</h3>
              <span class="status-badge ${r.status}">${r.status}</span>
            </div>
            <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">
              <strong>Patient:</strong> ${r.patient_name} | <strong>Age/Gender:</strong> ${r.patient_age} / ${r.patient_gender}
            </div>

            <div class="ai-highlight-box" style="margin-bottom:1rem;">
              <div class="ai-box-title"><i class="fa-solid fa-brain"></i> Anonymized AI Summary (Groq LLaMA)</div>
              <p style="font-size:0.8rem; line-height:1.4;">${r.ai_summary || 'AI Summary pending.'}</p>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; justify-content:space-between; background:rgba(0,0,0,0.2); padding:1rem; border-radius:12px; border:1px solid var(--border-color);">
            <div>
              <label style="font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:0.35rem; display:block;">
                Pathologist Clinical Verification Notes
              </label>
              <textarea class="form-control" id="notes_${r.id}" rows="4" placeholder="Enter clinical notes..."></textarea>
            </div>

            <div style="display:flex; gap:0.75rem; margin-top:1rem;">
              <button class="btn btn-success" style="flex:1;" onclick="app.approveReport('${r.id}')">
                <i class="fa-solid fa-signature"></i> Sign & Approve
              </button>
              <button class="btn btn-danger" onclick="app.rejectReport('${r.id}')">
                <i class="fa-solid fa-circle-xmark"></i> Reject
              </button>
            </div>
          </div>
        </div>
      `).join("");
    } catch (err) {
      queue.innerHTML = `<div class="glass-card text-high">${err.message}</div>`;
    }
  }

  async approveReport(reportId) {
    try {
      const pathologistId = this.pathologists[0] ? this.pathologists[0].id : "path-301";
      const notesInp = document.getElementById(`notes_${reportId}`);
      const notes = notesInp ? notesInp.value : "";

      await window.api.approveReport(reportId, pathologistId, notes);
      this.showToast("Report approved & electronically signed by Pathologist!", "success");
      this.loadPathologistView();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  async rejectReport(reportId) {
    const reason = prompt("Enter rejection reason for lab re-testing:");
    if (!reason) return;

    try {
      const pathologistId = this.pathologists[0] ? this.pathologists[0].id : "path-301";
      await window.api.rejectReport(reportId, pathologistId, reason);
      this.showToast("Report rejected.", "error");
      this.loadPathologistView();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  async loadAdminView() {
    const tbody = document.getElementById("adminAuditLogTable");
    try {
      const logs = await window.api.getAuditLogs();
      tbody.innerHTML = logs.map(l => `
        <tr>
          <td><small>${l.timestamp.replace('T', ' ').substring(0, 19)}</small></td>
          <td><strong>${l.user_name}</strong></td>
          <td><span class="persona-badge">${l.user_role}</span></td>
          <td><strong style="color:var(--primary-cyan);">${l.action}</strong></td>
          <td>${l.entity_type} (${l.entity_id})</td>
          <td><small style="color:var(--text-muted);">${l.details}</small></td>
        </tr>
      `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-high">${err.message}</td></tr>`;
    }
  }

  async viewReportModal(reportId) {
    const modal = document.getElementById("reportModal");
    const body = document.getElementById("modalReportBody");
    modal.classList.add("active");
    body.innerHTML = `<p><i class="fa-solid fa-spinner fa-spin"></i> Fetching report details...</p>`;

    try {
      const r = await window.api.getReportDetails(reportId);

      body.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
          <div>
            <h4 style="font-size:1.1rem; color:#fff;">${r.test_type}</h4>
            <small class="text-muted">Patient: ${r.patient.full_name} | MRN: ${r.patient.mrn}</small>
          </div>
          <span class="status-badge ${r.status}">${r.status}</span>
        </div>

        <div style="margin-top:1rem;">
          <strong style="font-size:0.85rem; color:var(--primary-cyan);">Measured Metrics & Range Flags:</strong>
          <table class="data-table" style="margin-top:0.5rem;">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Result</th>
                <th>Unit</th>
                <th>Severity Flag</th>
              </tr>
            </thead>
            <tbody>
              ${r.metrics.map(m => `
                <tr>
                  <td><strong>${m.metric_name}</strong></td>
                  <td>${m.value}</td>
                  <td>${m.unit}</td>
                  <td><span class="severity-pill ${m.severity}">${m.severity}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <div class="ai-highlight-box" style="margin-top:1rem;">
          <div class="ai-box-title"><i class="fa-solid fa-brain"></i> AI Plain-Language Medical Interpretation Summary</div>
          <p style="font-size:0.825rem; line-height:1.5;">${r.ai_summary || 'No AI summary generated.'}</p>
        </div>

        ${r.pathologist_notes ? `
          <div style="background:rgba(255,255,255,0.03); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); margin-top:0.75rem;">
            <strong style="font-size:0.8rem; color:var(--status-normal);"><i class="fa-solid fa-signature"></i> Pathologist Clinical Notes:</strong>
            <p style="font-size:0.825rem; color:var(--text-muted); margin-top:0.25rem;">${r.pathologist_notes}</p>
          </div>
        ` : ''}
      `;

      document.getElementById("modalReportFooter").innerHTML = `
        <a href="${window.api.getPdfUrl(r.id)}" target="_blank" class="btn btn-primary"><i class="fa-solid fa-file-pdf"></i> Download Official PDF</a>
        <button class="btn btn-secondary" onclick="app.closeModal()">Close</button>
      `;

    } catch (err) {
      body.innerHTML = `<p class="text-high">${err.message}</p>`;
    }
  }

  closeModal() {
    document.getElementById("reportModal").classList.remove("active");
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new AppController();
});
