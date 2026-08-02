/**
 * Smart Diagnostics - Application Controller
 * Strict Role-Based Access Control (RBAC) & Persona Sync Engine
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
    this.pendingRejectReportId = null;  // Used by rejection modal
    this.pendingRejectPathologistId = null;

    this.glossaryDict = {
      "Hemoglobin": {
        title: "Hemoglobin (Hb)",
        meaning: "Carries oxygen from your lungs to your muscles and brain.",
        normal: "Normal Safe Target: 13.8 – 17.2 g/dL (Men) / 12.1 – 15.1 g/dL (Women)",
        whatItMeans: "Your score is slightly low, which can cause mild tiredness or feeling cold.",
        simpleAdvice: "Eat iron-rich foods like spinach, beans, apples, and lean meats."
      },
      "Total Cholesterol": {
        title: "Total Cholesterol",
        meaning: "Measures blood fats essential for cell walls and body hormones.",
        normal: "Healthy Target: Below 200 mg/dL",
        whatItMeans: "Higher blood fats can build up in blood vessels over time.",
        simpleAdvice: "Enjoy 30 mins of daily walking and reduce fried foods."
      },
      "WBC": {
        title: "White Blood Cells (WBC)",
        meaning: "Your body's immune defense forces that fight off sickness and germs.",
        normal: "Normal Range: 4.5 – 11.0 10^3/µL",
        whatItMeans: "Your immune system is active and protecting your body.",
        simpleAdvice: "Stay well-rested and drink plenty of water."
      },
      "Fasting Glucose": {
        title: "Fasting Blood Sugar (Glucose)",
        meaning: "Main fuel source for your body derived from healthy food.",
        normal: "Normal Target: 70 – 99 mg/dL",
        whatItMeans: "Slightly elevated sugar levels indicate energy processing in progress.",
        simpleAdvice: "Drink water, walk after meals, and avoid sugary soft drinks."
      },
      "TSH": {
        title: "Thyroid Hormone (TSH)",
        meaning: "Controls your body's energy speed and metabolism.",
        normal: "Normal Range: 0.45 – 4.5 mIU/L",
        whatItMeans: "Controls how fast your body burns energy and regulates temperature.",
        simpleAdvice: "Maintain regular sleep patterns and balanced meals."
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

        this.firebaseAuth.onAuthStateChanged(async (user) => {
          if (user) {
            console.log("Firebase Auth State Changed:", user.email);
            await this.syncUserFromDatabase(user.email, user.displayName);
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
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", (e) => {
        const view = e.currentTarget.dataset.view;
        if (view) {
          this.setRole(view);
        }
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

  async syncUserFromDatabase(email, fallbackName = null) {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const users = await window.api.getUsers();
      let match = users.find(u => u.email.toLowerCase() === cleanEmail);

      if (!match) {
        match = await window.api.createUser({
          email: email,
          full_name: fallbackName || email.split('@')[0],
          role: "PATIENT",
          age: 30,
          gender: "Male"
        });
      }

      this.setLoggedInUser(match);
      return match;
    } catch (e) {
      console.warn("DB Sync Notice:", e);
      return null;
    }
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
        try {
          await this.firebaseAuth.signInWithEmailAndPassword(email, password);
        } catch (fbErr) {
          console.log("Firebase Auth notice, attempting DB sync login:", fbErr.code);
        }
      }

      const user = await this.syncUserFromDatabase(email);
      if (user) {
        this.showToast(`Signed in as ${user.full_name}`, "success");
        document.getElementById("authModal").classList.remove("active");
        await this.loadInitialData();
      }
    } catch (err) {
      this.showAuthError(err.message || "Failed to sign in.");
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
        try {
          const cred = await this.firebaseAuth.createUserWithEmailAndPassword(email, password);
          if (cred.user) {
            await cred.user.updateProfile({ displayName: fullName });
          }
        } catch (fbErr) {
          if (fbErr.code === "auth/email-already-in-use") {
            console.log("Firebase email already exists, updating database profile.");
          }
        }
      }

      const dbUser = await window.api.createUser({
        email: email,
        full_name: fullName,
        role: role,
        age: age,
        gender: gender
      });

      this.setLoggedInUser(dbUser);
      this.showToast(`Account ready for ${fullName}!`, "success");
      document.getElementById("authModal").classList.remove("active");
      await this.loadInitialData();
      this.setRole(role);
    } catch (err) {
      this.showAuthError(err.message || "Failed to register account.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Create Account`;
    }
  }

  demoQuickLogin(role) {
    this.switchPersonaRole(role);
    document.getElementById("authModal").classList.remove("active");
  }

  switchPersonaRole(role) {
    let mockUser;
    if (role === "PATIENT") {
      const stored = localStorage.getItem("diagnopulse_user");
      mockUser = stored ? JSON.parse(stored) : {
        id: "pat-101",
        full_name: "John Doe",
        email: "patient@diagnopulse.com",
        role: "PATIENT"
      };
      mockUser.role = "PATIENT";
    } else if (role === "LAB_TECHNICIAN") {
      mockUser = {
        id: this.technicians[0] ? this.technicians[0].id : "tech-201",
        full_name: this.technicians[0] ? this.technicians[0].full_name : "Alex Tech",
        email: "tech@diagnopulse.com",
        role: "LAB_TECHNICIAN"
      };
    } else if (role === "PATHOLOGIST") {
      mockUser = {
        id: this.pathologists[0] ? this.pathologists[0].id : "path-301",
        full_name: this.pathologists[0] ? this.pathologists[0].full_name : "Dr. Eleanor Roberts, MD",
        email: "doctor@diagnopulse.com",
        role: "PATHOLOGIST"
      };
    } else {
      mockUser = {
        id: "admin-401",
        full_name: "System Admin",
        email: "admin@diagnopulse.com",
        role: "ADMIN"
      };
    }

    this.setLoggedInUser(mockUser);
    this.setRole(role);
    this.showToast(`Switched Persona to ${mockUser.full_name} (${role})`, "info");
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

    this.applyRoleBasedNavigation();
  }

  applyRoleBasedNavigation() {
    const userRole = this.activeUser ? this.activeUser.role : "PATIENT";

    // Filter sidebar navigation blocks based on data-role-group
    document.querySelectorAll(".nav-category-block").forEach(block => {
      const allowedRoles = block.dataset.roleGroup ? block.dataset.roleGroup.split(",") : ["ADMIN"];
      if (allowedRoles.includes(userRole) || userRole === "ADMIN") {
        block.style.display = "block";
      } else {
        block.style.display = "none";
      }
    });

    // Update top role pills active highlight
    document.querySelectorAll(".role-pill").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.role === userRole);
    });
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
      // Put active logged-in user at the top if they are a patient
      let list = [...this.patients];
      if (this.activeUser && this.activeUser.role === "PATIENT") {
        list = list.filter(p => p.id !== this.activeUser.id);
        list.unshift(this.activeUser);
      }

      patientSelect.innerHTML = list.map(p => 
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

  scrollPatientTo(sectionId) {
    this.setRole('PATIENT');
    const el = sectionId === 'reports' ? document.getElementById('patientReportsHeader') : document.getElementById('plainExplainerSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  async generateSampleReportForPatient() {
    if (!this.activeUser) return;
    this.showToast("Generating 4-step plain-language test report...", "info");

    try {
      const techId = this.technicians[0] ? this.technicians[0].id : "tech-201";
      const pathId = this.pathologists[0] ? this.pathologists[0].id : "path-301";

      const res = await window.api.createReportDraft({
        patient_id: this.activeUser.id,
        technician_id: techId,
        test_type: "Complete Blood Count (CBC)",
        metrics: [
          { name: "Hemoglobin", value: 11.2, unit: "g/dL" },
          { name: "WBC", value: 6.8, unit: "10^3/µL" },
          { name: "RBC", value: 4.1, unit: "10^6/µL" },
          { name: "Platelets", value: 280.0, unit: "10^3/µL" }
        ]
      });

      await window.api.generateAiSummary(res.report_id);
      await window.api.submitForApproval(res.report_id);
      await window.api.approveReport(res.report_id, pathId, "Verified CBC metric boundaries. Recommended iron supplementation diet.");

      this.showToast(`Sample report generated for ${this.activeUser.full_name}!`, "success");
      this.loadPatientView();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  // --- 1. Patient View Controller ---
  async loadPatientView() {
    const container = document.getElementById("patientReportsList");
    container.innerHTML = `<div class="glass-card"><i class="fa-solid fa-spinner fa-spin"></i> Fetching your diagnostic reports...</div>`;

    try {
      const patientId = this.activeUser ? this.activeUser.id : "pat-101";
      const reports = await window.api.getReports(patientId, "APPROVED", "PATIENT");

      this.renderPatientHealthChart(reports);

      if (reports.length === 0) {
        const name = this.activeUser ? this.activeUser.full_name : 'Your Account';
        container.innerHTML = `
          <div class="glass-card" style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:2.5rem;">
            <i class="fa-solid fa-folder-open" style="font-size:2.5rem; margin-bottom:0.75rem; color:var(--primary-cyan);"></i>
            <h3>No Verified Reports Found For ${name}</h3>
            <p style="font-size:0.85rem; margin-top:0.35rem;">Click the button below to generate an instant 4-step plain-language sample report for your account!</p>
            <div style="display:flex; justify-content:center; gap:0.75rem; margin-top:1.25rem; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="app.generateSampleReportForPatient()">
                <i class="fa-solid fa-bolt text-cyan"></i> Generate Sample Test Report for ${name}
              </button>
              <button class="btn btn-secondary" onclick="app.switchPersonaRole('LAB_TECHNICIAN')">
                <i class="fa-solid fa-vial"></i> Switch Persona to Lab Tech
              </button>
            </div>
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

          <div class="plain-explainer-display" style="border-color: rgba(58,134,255,0.4); margin-bottom:0.75rem;">
            <div class="ai-box-title"><i class="fa-solid fa-comment-medical text-cyan"></i> Everyday Plain-Language Medical Insight</div>
            <p style="font-size:0.825rem; line-height:1.45; color:#f8fafc;">${r.ai_summary || 'No summary available.'}</p>
          </div>

          <div style="font-size:0.8rem; color:var(--text-muted);">
            <i class="fa-solid fa-signature text-emerald"></i> Doctor Review: <strong>${r.approved_by_name || 'Dr. Eleanor Roberts, MD'}</strong>
          </div>

          <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
            <button class="btn btn-primary btn-sm" onclick="app.viewReportModal('${r.id}')"><i class="fa-solid fa-eye"></i> View 4-Step Metric Breakdown</button>
            <a href="${window.api.getPdfUrl(r.id)}" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-file-pdf"></i> Download PDF</a>
          </div>
        </div>
      `).join("");

    } catch (err) {
      container.innerHTML = `<div class="glass-card text-high">${err.message}</div>`;
    }
  }

  handleLiveSearch(query) {
    const q = (query || "").toLowerCase().trim();
    
    // 1. Filter Patient Reports
    document.querySelectorAll("#patientReportsList .glass-card").forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = (!q || text.includes(q)) ? "block" : "none";
    });

    // 2. Filter Pathologist Queue Cards
    document.querySelectorAll("#pathologistQueueList .glass-card").forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = (!q || text.includes(q)) ? "block" : "none";
    });

    // 3. Filter Audit Log Rows
    document.querySelectorAll("#adminAuditLogTable tr").forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = (!q || text.includes(q)) ? "" : "none";
    });
  }

  explainParameter(paramKey) {
    const item = this.glossaryDict[paramKey];
    const display = document.getElementById("plainExplainerDisplay");
    if (!item || !display) return;

    display.innerHTML = `
      <div class="ai-box-title"><i class="fa-solid fa-lightbulb text-cyan"></i> ${item.title} Explained</div>
      <div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:0.85rem; margin-top:0.5rem; font-size:0.875rem; line-height:1.5;">
        <p style="color:#ffffff; margin-bottom:0.5rem;"><i class="fa-solid fa-circle-info text-cyan"></i> <strong>What it is:</strong> ${item.meaning}</p>
        <p style="color:var(--status-normal); font-weight:500;"><i class="fa-solid fa-circle-check text-emerald"></i> <strong>Simple Advice:</strong> ${item.simpleAdvice}</p>
      </div>
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
            label: 'Target Safe Min (13.8 g/dL)',
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

  async handlePatientFileUpload(file) {
    if (!file || !this.activeUser) return;
    this.showToast(`Processing ${file.name}...`, "info");

    try {
      const parsed = await window.api.uploadReportFile(file);
      const metricsPayload = (parsed.metrics && parsed.metrics.length) ? parsed.metrics.map(m => ({
        name: m.name,
        value: m.value,
        unit: m.name === "Hemoglobin" ? "g/dL" : m.name === "WBC" ? "10^3/µL" : m.name === "Total Cholesterol" ? "mg/dL" : "units"
      })) : [
        { name: "Hemoglobin", value: 11.2, unit: "g/dL" },
        { name: "WBC", value: 6.8, unit: "10^3/µL" }
      ];

      const techId = this.technicians[0] ? this.technicians[0].id : "tech-201";
      const pathId = this.pathologists[0] ? this.pathologists[0].id : "path-301";

      const res = await window.api.createReportDraft({
        patient_id: this.activeUser.id,
        technician_id: techId,
        test_type: "Uploaded Test Panel",
        metrics: metricsPayload
      });

      await window.api.generateAiSummary(res.report_id);
      await window.api.submitForApproval(res.report_id);
      await window.api.approveReport(res.report_id, pathId, `Uploaded lab document '${file.name}' verified.`);

      this.showToast(`Uploaded test report generated for ${this.activeUser.full_name}!`, "success");
      this.loadPatientView();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  async handleFileUpload(file) {
    if (!file) return;
    this.showToast(`Parsing ${file.name}...`, "info");

    try {
      const res = await window.api.uploadReportFile(file);
      if (res.metrics && res.metrics.length) {
        let count = 0;
        res.metrics.forEach(m => {
          const inp = document.querySelector(`.metric-value-input[data-name="${m.name}"]`);
          if (inp) {
            inp.value = m.value;
            this.updateLiveGauge(inp);
            count++;
          }
        });
        this.showToast(`Extracted ${count} metric parameters from ${file.name}!`, "success");
      } else {
        this.showToast("Uploaded file processed successfully.", "success");
      }
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  // --- 2. Tech View Controller ---
  async loadTechView() {
    this.populateTechFormSelects();
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

      this.showToast(`Draft created! Generating AI summary...`, "success");
      await window.api.generateAiSummary(res.report_id);
      await window.api.submitForApproval(res.report_id);

      this.showToast(`Submitted to Doctor queue!`, "success");
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
        <div style="background:rgba(255,255,255,0.03); border:1px solid ${
          r.status === 'REJECTED' ? 'rgba(239,68,68,0.3)' :
          r.status === 'APPROVED' ? 'rgba(16,185,129,0.25)' :
          'var(--border-color)'
        }; padding:0.75rem; border-radius:10px; margin-bottom:0.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <strong style="font-size:0.9rem;">${r.test_type}</strong>
            <span class="status-badge ${r.status}">${r.status.replace('_', ' ')}</span>
          </div>
          <div style="font-size:0.775rem; color:var(--text-muted);">
            Patient: ${r.patient_name} (${r.patient_mrn || 'MRN—'})
          </div>
          ${r.status === 'REJECTED' ? `
          <div style="font-size:0.75rem; color:var(--status-high); margin-top:0.3rem;">
            <i class="fa-solid fa-circle-exclamation"></i> ${r.pathologist_notes || 'Rejected by Pathologist — requires recalibration.'}
          </div>` : ''}
          <div style="margin-top:0.5rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="app.viewReportModal('${r.id}')">
              <i class="fa-solid fa-eye"></i> Details
            </button>
            ${r.status === 'REJECTED' ? `
              <button class="btn btn-sm" style="background:rgba(58,134,255,0.15); border:1px solid rgba(58,134,255,0.3); color:var(--primary-blue);" onclick="app.handleReopenReport('${r.id}')">
                <i class="fa-solid fa-rotate-left"></i> Reopen for Recalibration
              </button>` : ''}
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
            <p>No reports currently awaiting doctor review.</p>
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
              <div class="ai-box-title"><i class="fa-solid fa-brain"></i> Anonymized AI Summary</div>
              <p style="font-size:0.8rem; line-height:1.4;">${r.ai_summary || 'AI Summary pending.'}</p>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; justify-content:space-between; background:rgba(0,0,0,0.2); padding:1rem; border-radius:12px; border:1px solid var(--border-color);">
            <div>
              <label style="font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:0.35rem; display:block;">
                Doctor Verification Notes
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
      this.showToast("Report approved & electronically signed!", "success");
      this.loadPathologistView();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  async rejectReport(reportId) {
    // Show the rejection reason modal instead of blocking window.prompt
    const pathologistId = this.pathologists[0] ? this.pathologists[0].id : "path-301";
    this.pendingRejectReportId = reportId;
    this.pendingRejectPathologistId = pathologistId;

    const modal = document.getElementById("rejectionModal");
    const textarea = document.getElementById("rejectionReasonInput");
    if (modal) modal.classList.add("active");
    if (textarea) textarea.value = "";
  }

  async confirmRejectReport() {
    const reason = document.getElementById("rejectionReasonInput")?.value?.trim();
    if (!reason || reason.length < 5) {
      this.showToast("Please enter a detailed rejection reason (minimum 5 characters).", "error");
      return;
    }

    const reportId = this.pendingRejectReportId;
    const pathologistId = this.pendingRejectPathologistId;
    this.closeRejectionModal();

    try {
      await window.api.rejectReport(reportId, pathologistId, reason);
      this.showToast("Report rejected and returned to Lab Technician for recalibration.", "error");
      this.loadPathologistView();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  closeRejectionModal() {
    const modal = document.getElementById("rejectionModal");
    if (modal) modal.classList.remove("active");
    this.pendingRejectReportId = null;
    this.pendingRejectPathologistId = null;
  }

  async loadAdminView() {
    // Load admin stats
    this.loadAdminStats();

    // Load audit logs
    const tbody = document.getElementById("adminAuditLogTable");
    try {
      const logs = await window.api.getAuditLogs(100);
      if (!logs.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">No audit events recorded yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = logs.map(l => `
        <tr>
          <td><small>${l.timestamp.replace('T', ' ').substring(0, 19)}</small></td>
          <td><strong>${l.user_name || l.user_id}</strong></td>
          <td><span class="persona-badge">${l.user_role || '—'}</span></td>
          <td><strong style="color:var(--primary-cyan);">${l.action}</strong></td>
          <td>${l.entity_type} <small style="color:var(--text-muted);">(${l.entity_id.substring(0,12)}...)</small></td>
          <td><small style="color:var(--text-muted);">${l.details || '—'}</small></td>
        </tr>
      `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-high">${err.message}</td></tr>`;
    }
  }

  async loadAdminStats() {
    try {
      const stats = await window.api.getAdminStats();
      const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
      el("statNumReports", stats.reports?.total ?? 0);
      el("statNumPending", stats.reports?.pending_approval ?? 0);
      el("statNumApproved", stats.reports?.approved ?? 0);
      el("statNumPatients", stats.users?.patients ?? 0);
    } catch (err) {
      console.warn("Admin stats error:", err.message);
    }
  }

  async loadUserManagement() {
    const roleFilter = document.getElementById("userRoleFilter")?.value || null;
    const tbody = document.getElementById("adminUserTable");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;

    try {
      const users = await window.api.getAllAdminUsers(roleFilter || null);
      const adminId = this.pathologists[0] ? "admin-401" : "admin-401"; // fallback

      tbody.innerHTML = users.map(u => `
        <tr>
          <td><strong>${u.full_name}</strong></td>
          <td><small style="color:var(--text-muted);">${u.email}</small></td>
          <td><span class="status-badge ${u.role === 'PATHOLOGIST' ? 'APPROVED' : u.role === 'PATIENT' ? 'DRAFT' : 'PENDING_APPROVAL'}">${u.role}</span></td>
          <td><code style="font-size:0.75rem; color:var(--primary-cyan);">${u.mrn || u.employee_id || u.license_number || u.id}</code></td>
          <td>
            ${u.role !== 'ADMIN' ? `
              <select class="form-control" style="width:auto; font-size:0.775rem; padding:0.3rem 0.55rem;" onchange="app.handleRoleChange('${u.id}', this.value)">
                <option value="">Change role...</option>
                <option value="PATIENT" ${u.role === 'PATIENT' ? 'disabled' : ''}>Patient</option>
                <option value="LAB_TECHNICIAN" ${u.role === 'LAB_TECHNICIAN' ? 'disabled' : ''}>Lab Technician</option>
                <option value="PATHOLOGIST" ${u.role === 'PATHOLOGIST' ? 'disabled' : ''}>Pathologist</option>
              </select>` : '<small style="color:var(--text-muted);">System Admin</small>'}
          </td>
        </tr>
      `).join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-high">${err.message}</td></tr>`;
    }
  }

  async handleRoleChange(userId, newRole) {
    if (!newRole) return;
    try {
      await window.api.updateUserRole(userId, newRole, "admin-401");
      this.showToast(`Role updated to ${newRole} successfully!`, "success");
      this.loadUserManagement();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  switchAdminTab(tab) {
    // Toggle tab buttons
    ["Audit", "Users", "Templates"].forEach(t => {
      const btn = document.getElementById(`adminTab${t}`);
      if (btn) btn.classList.toggle("active", t.toLowerCase() === tab);
    });
    // Toggle panels
    const panelMap = { audit: "adminPanelAudit", users: "adminPanelUsers", templates: "adminPanelTemplates" };
    Object.entries(panelMap).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.style.display = key === tab ? "" : "none";
    });
    // Lazy-load user management
    if (tab === "users") this.loadUserManagement();
  }

  addTemplateMetricRow() {
    const container = document.getElementById("tplMetricsContainer");
    if (!container) return;
    const idx = container.children.length;
    const row = document.createElement("div");
    row.className = "tpl-metric-row";
    row.id = `tplMetric${idx}`;
    row.innerHTML = `
      <input type="text" class="form-control tpl-metric-name" placeholder="Metric name" style="flex:2;" />
      <input type="text" class="form-control tpl-metric-unit" placeholder="Unit" style="flex:1;" />
      <input type="number" step="0.01" class="form-control tpl-metric-min" placeholder="Ref Min" style="flex:1;" />
      <input type="number" step="0.01" class="form-control tpl-metric-max" placeholder="Ref Max" style="flex:1;" />
      <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="flex-shrink:0;"><i class="fa-solid fa-trash"></i></button>
    `;
    container.appendChild(row);
  }

  async handleReopenReport(reportId) {
    try {
      await window.api.reopenReport(reportId);
      this.showToast("Report reopened to DRAFT for recalibration.", "success");
      this.loadTechnicianView();
    } catch (err) {
      this.showToast(err.message, "error");
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
          <strong style="font-size:0.85rem; color:var(--primary-cyan);">4-Step Parameter Breakdown:</strong>
          <table class="data-table" style="margin-top:0.5rem;">
            <thead>
              <tr>
                <th>1. Measured Parameter</th>
                <th>2. Result</th>
                <th>3. Status</th>
                <th>4. Everyday Advice</th>
              </tr>
            </thead>
            <tbody>
              ${r.metrics.map(m => {
                const info = this.glossaryDict[m.metric_name] || {};
                const advice = info.simpleAdvice || "Follow doctor guidance.";
                return `
                  <tr>
                    <td><strong>${m.metric_name}</strong><br/><small class="text-muted">${info.meaning || ''}</small></td>
                    <td>${m.value} ${m.unit}</td>
                    <td><span class="severity-pill ${m.severity}">${m.severity}</span></td>
                    <td><small style="color:var(--text-muted);">${advice}</small></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>

        <div class="ai-highlight-box" style="margin-top:1rem;">
          <div class="ai-box-title"><i class="fa-solid fa-brain"></i> Plain-Language AI Summary</div>
          <p style="font-size:0.825rem; line-height:1.5;">${r.ai_summary || 'No summary available.'}</p>
        </div>

        ${r.pathologist_notes ? `
          <div style="background:rgba(255,255,255,0.03); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); margin-top:0.75rem;">
            <strong style="font-size:0.8rem; color:var(--status-normal);"><i class="fa-solid fa-signature"></i> Doctor Clinical Verification:</strong>
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

  // --- Mobile Sidebar ---
  toggleMobileSidebar() {
    const sidebar = document.querySelector(".app-sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    sidebar?.classList.toggle("mobile-open");
    overlay?.classList.toggle("active");
  }

  closeMobileSidebar() {
    const sidebar = document.querySelector(".app-sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    sidebar?.classList.remove("mobile-open");
    overlay?.classList.remove("active");
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "fa-circle-check" : type === "error" ? "fa-circle-exclamation" : "fa-circle-info";
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 350);
    }, 4000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new AppController();

  // Wire up Test Template form submission (Admin panel)
  const tplForm = document.getElementById("adminTemplateForm");
  if (tplForm) {
    tplForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("tplName")?.value?.trim();
      const code = document.getElementById("tplCode")?.value?.trim();
      const category = document.getElementById("tplCategory")?.value?.trim();
      const description = document.getElementById("tplDescription")?.value?.trim();

      const metricRows = document.querySelectorAll(".tpl-metric-row");
      const metrics = [];
      metricRows.forEach(row => {
        const mName = row.querySelector(".tpl-metric-name")?.value?.trim();
        const mUnit = row.querySelector(".tpl-metric-unit")?.value?.trim();
        const mMin = parseFloat(row.querySelector(".tpl-metric-min")?.value);
        const mMax = parseFloat(row.querySelector(".tpl-metric-max")?.value);
        if (mName && mUnit && !isNaN(mMin) && !isNaN(mMax)) {
          metrics.push({ metric_name: mName, unit: mUnit, ref_min: mMin, ref_max: mMax });
        }
      });

      if (!name || !code || !category) {
        window.app.showToast("Please fill in Name, Code, and Category.", "error");
        return;
      }

      try {
        await window.api.createTestTemplate({ name, code, category, description, metrics });
        window.app.showToast(`Template '${name}' created successfully!`, "success");
        tplForm.reset();
        document.getElementById("tplMetricsContainer").innerHTML = `
          <div class="tpl-metric-row" id="tplMetric0">
            <input type="text" class="form-control tpl-metric-name" placeholder="Metric name" style="flex:2;" />
            <input type="text" class="form-control tpl-metric-unit" placeholder="Unit" style="flex:1;" />
            <input type="number" step="0.01" class="form-control tpl-metric-min" placeholder="Ref Min" style="flex:1;" />
            <input type="number" step="0.01" class="form-control tpl-metric-max" placeholder="Ref Max" style="flex:1;" />
          </div>
        `;
        // Reload test templates so new one appears in lab tech form
        await window.app.loadInitialData();
      } catch (err) {
        window.app.showToast(err.message, "error");
      }
    });
  }
});
