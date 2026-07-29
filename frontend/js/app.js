/**
 * Smart Diagnostics - Application Controller
 * Patient-Centric & Dynamic Auth Overhaul
 */

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
    this.healthChart = null;

    // Plain-Language Explainer Dictionary
    this.glossaryDict = {
      "Hemoglobin": {
        title: "Hemoglobin (Hb)",
        meaning: "Carries oxygen from your lungs to the rest of your body.",
        normal: "Normal Range: 13.8 – 17.2 g/dL (Men) / 12.1 – 15.1 g/dL (Women)",
        whatItMeans: "If low: You may feel tired or short of breath (mild anemia). Iron-rich foods like spinach and lean meats help. If high: Blood may be thicker, often due to dehydration."
      },
      "Total Cholesterol": {
        title: "Total Cholesterol",
        meaning: "Measures blood fats essential for cell building and hormone production.",
        normal: "Desirable Target: Below 200 mg/dL",
        whatItMeans: "If elevated: Higher blood fat levels can build up in blood vessels. Exercise, reducing saturated fats, and staying active help maintain healthy levels."
      },
      "WBC": {
        title: "White Blood Cells (WBC)",
        meaning: "Your body's immune system defense forces that fight infections.",
        normal: "Normal Range: 4.5 – 11.0 10^3/µL",
        whatItMeans: "If elevated: Your immune system is actively fighting an infection or inflammation. If low: Immune defenses may be slightly weakened."
      },
      "Fasting Glucose": {
        title: "Fasting Blood Sugar (Glucose)",
        meaning: "Main source of energy for your body's cells derived from food.",
        normal: "Normal Target: 70 – 99 mg/dL",
        whatItMeans: "If elevated above 100 mg/dL: Indicates higher blood sugar levels. Staying hydrated and reducing refined sugars supports balanced glucose."
      },
      "TSH": {
        title: "Thyroid Stimulating Hormone (TSH)",
        meaning: "Controls your thyroid gland, regulating your body's energy & metabolism speed.",
        normal: "Normal Range: 0.45 – 4.5 mIU/L",
        whatItMeans: "If high: Your thyroid is underactive (sluggish metabolism). If low: Your thyroid is overactive (fast metabolism)."
      }
    };

    this.initFirebase();
    this.init();
  }

  initFirebase() {
    try {
      if (window.firebase && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        this.firebaseAuth = firebase.auth();

        this.firebaseAuth.onAuthStateChanged((user) => {
          if (user) {
            console.log("Firebase User Logged In:", user.email);
            // Hydrate active user state
            this.setLoggedInUser({
              id: user.uid,
              email: user.email,
              full_name: user.displayName || user.email.split('@')[0],
              role: this.activeRole
            });
            document.getElementById("authModal").classList.remove("active");
          }
        });
      }
    } catch (e) {
      console.warn("Firebase Auth Notice:", e);
    }
  }

  async init() {
    this.bindEvents();

    // Check stored user session
    const stored = localStorage.getItem("diagnopulse_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.setLoggedInUser(parsed);
        document.getElementById("authModal").classList.remove("active");
      } catch (e) {}
    }

    await this.loadInitialData();
    this.setRole(this.activeRole);
  }

  bindEvents() {
    document.querySelectorAll(".role-pill").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const role = e.currentTarget.dataset.role;
        this.setRole(role);
      });
    });

    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const view = e.currentTarget.dataset.view;
        this.setRole(view);
      });
    });

    const templateSelect = document.getElementById("selectTemplate");
    if (templateSelect) {
      templateSelect.addEventListener("change", () => this.renderMetricInputs());
    }

    const techForm = document.getElementById("techCreateReportForm");
    if (techForm) {
      techForm.addEventListener("submit", (e) => this.handleTechFormSubmit(e));
    }

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
    this.hideAuthError();
    document.getElementById("tabLogin").classList.toggle("active", tab === "login");
    document.getElementById("tabRegister").classList.toggle("active", tab === "register");
    document.getElementById("formLogin").classList.toggle("active", tab === "login");
    document.getElementById("formRegister").classList.toggle("active", tab === "register");
  }

  showAuthError(message) {
    const alertBox = document.getElementById("authErrorAlert");
    const msgSpan = document.getElementById("authErrorMsg");
    if (alertBox && msgSpan) {
      msgSpan.textContent = message;
      alertBox.style.display = "flex";
    }
  }

  hideAuthError() {
    const alertBox = document.getElementById("authErrorAlert");
    if (alertBox) alertBox.style.display = "none";
  }

  async handleLogin(e) {
    e.preventDefault();
    this.hideAuthError();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("btnLoginSubmit");

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;

    try {
      if (this.firebaseAuth) {
        await this.firebaseAuth.signInWithEmailAndPassword(email, password);
      }

      // Check if user exists in database
      const users = await window.api.getUsers();
      let match = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!match) {
        // Auto-provision user record if first login
        match = await window.api.createUser({
          email: email,
          full_name: email.split('@')[0].replace('.', ' '),
          role: "PATIENT",
          age: 30,
          gender: "Male"
        });
      }

      this.setLoggedInUser(match);
      this.showToast(`Welcome back, ${match.full_name}!`, "success");
      document.getElementById("authModal").classList.remove("active");
    } catch (err) {
      let friendlyMsg = err.message || "Failed to sign in.";
      if (friendlyMsg.includes("user-not-found") || friendlyMsg.includes("invalid-credential")) {
        friendlyMsg = "Account not found or password incorrect. Click 'Register Account' below to sign up!";
      }
      this.showAuthError(friendlyMsg);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Sign In to Portal`;
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    this.hideAuthError();
    const fullName = document.getElementById("regFullName").value.trim();
    const role = document.getElementById("regRole").value;
    const age = parseInt(document.getElementById("regAge").value) || 30;
    const gender = document.getElementById("regGender").value;
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const btn = document.getElementById("btnRegisterSubmit");

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...`;

    try {
      if (this.firebaseAuth) {
        await this.firebaseAuth.createUserWithEmailAndPassword(email, password);
      }

      const dbUser = await window.api.createUser({
        email: email,
        full_name: fullName,
        role: role,
        age: age,
        gender: gender
      });

      this.setLoggedInUser(dbUser);
      this.showToast("Account created successfully!", "success");
      document.getElementById("authModal").classList.remove("active");
      await this.loadInitialData();
      this.setRole(role);
    } catch (err) {
      let friendlyMsg = err.message || "Failed to register account.";
      if (friendlyMsg.includes("email-already-in-use")) {
        friendlyMsg = "This email is already registered. Click 'Sign In' tab to log in!";
      }
      this.showAuthError(friendlyMsg);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Create Firebase Account`;
    }
  }

  demoQuickLogin(role) {
    let mockUser = {
      id: role === "PATIENT" ? "pat-101" : role === "LAB_TECHNICIAN" ? "tech-201" : role === "PATHOLOGIST" ? "path-301" : "admin-401",
      full_name: role === "PATIENT" ? "John Doe" : role === "LAB_TECHNICIAN" ? "Alex Tech" : role === "PATHOLOGIST" ? "Dr. Eleanor Roberts, MD" : "System Admin",
      email: `${role.toLowerCase()}@diagnopulse.com`,
      role: role
    };

    this.setLoggedInUser(mockUser);
    document.getElementById("authModal").classList.remove("active");
    this.showToast(`Logged in as Persona: ${mockUser.full_name}`, "success");
  }

  setLoggedInUser(user) {
    this.activeUser = user;
    this.activeRole = user.role || "PATIENT";
    localStorage.setItem("diagnopulse_user", JSON.stringify(user));

    const name = user.full_name || "User";
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    document.getElementById("userNameLabel").textContent = name;
    document.getElementById("userRoleTag").textContent = this.activeRole;
    document.getElementById("userAvatar").textContent = initials;
  }

  handleSignOut() {
    if (this.firebaseAuth) this.firebaseAuth.signOut();
    localStorage.removeItem("diagnopulse_user");
    document.getElementById("authModal").classList.add("active");
    this.hideAuthError();
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

    let pct = 50;
    if (max > min) {
      pct = ((val - (min * 0.7)) / ((max * 1.3) - (min * 0.7))) * 100;
      pct = Math.max(5, Math.min(95, pct));
    }
    gaugeEl.style.left = `${pct}%`;

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

    document.querySelectorAll(".role-pill").forEach(btn => btn.classList.toggle("active", btn.dataset.role === role));
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === role));

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

  // --- 1. Patient View Controller ---
  async loadPatientView() {
    const container = document.getElementById("patientReportsList");
    container.innerHTML = `<div class="glass-card"><i class="fa-solid fa-spinner fa-spin"></i> Fetching your verified diagnostic reports...</div>`;

    try {
      const patientId = this.activeUser ? this.activeUser.id : "pat-101";
      const reports = await window.api.getReports(patientId, "APPROVED", "PATIENT");

      this.renderPatientHealthChart(reports);

      if (reports.length === 0) {
        container.innerHTML = `
          <div class="glass-card" style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:2.5rem;">
            <i class="fa-solid fa-folder-open" style="font-size:2.5rem; margin-bottom:0.75rem; color:var(--primary-cyan);"></i>
            <h3>No Verified Reports Found For Your Account</h3>
            <p style="font-size:0.85rem; margin-top:0.35rem;">When your clinic lab technician processes your test metrics, your plain-language report will appear here automatically!</p>
            <button class="btn btn-primary btn-sm" style="margin-top:1rem;" onclick="app.setRole('LAB_TECHNICIAN')">
              <i class="fa-solid fa-plus"></i> Switch to Lab Tech View to Create Test Report
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = reports.map(r => `
        <div class="glass-card report-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
            <div>
              <div style="font-family:var(--font-heading); font-size:1.15rem; font-weight:700;">${r.test_type}</div>
              <small class="text-muted"><i class="fa-regular fa-calendar"></i> Date: ${r.created_at.split('T')[0]}</small>
            </div>
            <span class="status-badge ${r.status}">${r.status}</span>
          </div>

          <div class="ai-highlight-box">
            <div class="ai-box-title"><i class="fa-solid fa-brain"></i> AI Plain-Language Explanation</div>
            <p style="font-size:0.825rem; line-height:1.45;">${r.ai_summary ? r.ai_summary.substring(0, 220) + '...' : 'No summary available.'}</p>
          </div>

          <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.5rem;">
            <i class="fa-solid fa-signature text-emerald"></i> Reviewed by: <strong>${r.approved_by_name || 'Dr. Eleanor Roberts, MD'}</strong>
          </div>

          <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
            <button class="btn btn-primary btn-sm" onclick="app.viewReportModal('${r.id}')"><i class="fa-solid fa-eye"></i> Plain-Language Details</button>
            <a href="${window.api.getPdfUrl(r.id)}" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-file-pdf"></i> Download PDF</a>
          </div>
        </div>
      `).join("");

    } catch (err) {
      container.innerHTML = `<div class="glass-card text-high">${err.message}</div>`;
    }
  }

  explainParameter(paramKey) {
    const item = this.glossaryDict[paramKey];
    const display = document.getElementById("plainExplainerDisplay");
    if (!item || !display) return;

    display.innerHTML = `
      <div class="ai-box-title"><i class="fa-solid fa-lightbulb text-cyan"></i> ${item.title} Explained</div>
      <p style="font-weight:600; color:#fff; margin-bottom:0.25rem;">What it does: ${item.meaning}</p>
      <p style="font-size:0.775rem; color:var(--primary-cyan); margin-bottom:0.35rem;">${item.normal}</p>
      <p style="font-size:0.8rem; color:var(--text-muted);">${item.whatItMeans}</p>
    `;
  }

  renderPatientHealthChart(reports) {
    const canvas = document.getElementById("healthTrendChart");
    if (!canvas) return;

    if (this.healthChart) this.healthChart.destroy();

    const ctx = canvas.getContext("2d");
    this.healthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Mar', 'May', 'Jul', 'Current Test'],
        datasets: [
          {
            label: 'Hemoglobin (g/dL)',
            data: [13.2, 12.8, 12.0, 11.5, 11.2],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Target Normal Min (13.8 g/dL)',
            data: [13.8, 13.8, 13.8, 13.8, 13.8],
            borderColor: '#10b981',
            borderDash: [5, 5],
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  // --- 2. Tech View Controller ---
  async loadTechView() {
    this.loadTechQueue();
  }

  async handleTechFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitTechReport");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Evaluating Ranges & Groq AI...`;

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
            Patient: ${r.patient_name} (${r.patient_mrn || 'MRN-884920'})
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

  // --- 3. Pathologist View Controller ---
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
              <textarea class="form-control" id="notes_${r.id}" rows="4" placeholder="Enter clinical observations..."></textarea>
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
            <small class="text-muted">Patient: ${r.patient.full_name} | MRN: ${r.patient.mrn || 'MRN-884920'}</small>
          </div>
          <span class="status-badge ${r.status}">${r.status}</span>
        </div>

        <div style="margin-top:1rem;">
          <strong style="font-size:0.85rem; color:var(--primary-cyan);">Measured Parameters & Range Flags:</strong>
          <table class="data-table" style="margin-top:0.5rem;">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Result</th>
                <th>Unit</th>
                <th>Status Flag</th>
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
          <div class="ai-box-title"><i class="fa-solid fa-brain"></i> Plain-Language AI Interpretation</div>
          <p style="font-size:0.825rem; line-height:1.5;">${r.ai_summary || 'No summary available.'}</p>
        </div>

        ${r.pathologist_notes ? `
          <div style="background:rgba(255,255,255,0.03); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); margin-top:0.75rem;">
            <strong style="font-size:0.8rem; color:var(--status-normal);"><i class="fa-solid fa-signature"></i> Pathologist Clinical Verification:</strong>
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
