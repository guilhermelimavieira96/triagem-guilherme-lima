class TriageController {
  constructor(state, dom, callbacks, priorityLabels) {
    this.state = state;
    this.dom = dom;
    this.callbacks = callbacks;
    this.priorityLabels = priorityLabels;
  }

  init() {
    this.dom.triagePatient.addEventListener("change", () => this.selectPatient());
    ["bloodPressure", "temperature", "oxygen", "heartRate"].forEach((id) => {
      const input = document.getElementById(id);
      input.addEventListener("input", () => {
        if (id === "bloodPressure") {
          input.value = this.formatBloodPressure(input.value);
        }
        if (id === "temperature") {
          input.value = this.formatTemperature(input.value);
        }
        if (id === "heartRate") {
          input.value = this.formatNumberRange(input.value, 20, 220);
        }
        if (id === "oxygen") {
          input.value = this.formatNumberRange(input.value, 50, 100);
        }
        this.renderVitalPreview();
      });
    });
    this.dom.suggestRisk.addEventListener("click", () => this.suggestRisk());
    this.dom.triageForm.addEventListener("submit", (event) => this.handleSubmit(event));
    this.dom.clearTriageForm.addEventListener("click", () => this.reset());
  }

  formatBloodPressure(value) {
    const digits = (value || "").replace(/[^\d]/g, "").slice(0, 6);
    if (!digits) return "";
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)}/${digits.slice(3, 6)}`;
  }

  formatTemperature(value) {
    const sanitized = (value || "").replace(",", ".").replace(/[^\d.]/g, "");
    const parts = sanitized.split(".");
    if (parts.length > 2) {
      return `${parts[0]}.${parts.slice(1).join("")}`.slice(0, 5);
    }
    return sanitized.slice(0, 5);
  }

  formatNumberRange(value, min, max) {
    const numeric = (value || "").replace(/[^\d]/g, "");
    if (!numeric) return "";
    const number = Number(numeric);
    if (Number.isNaN(number)) return "";
    return String(Math.min(Math.max(number, min), max));
  }

  selectPatient() {
    this.state.selectedPatientId = this.dom.triagePatient.value;
    this.renderPatientSummary();
  }

  parseBloodPressure(value) {
    const normalized = String(value || "").trim().replace(/\s+/g, "");
    if (!normalized) {
      return { systolic: NaN, diastolic: NaN };
    }

    const separator = normalized.includes("/") ? "/" : normalized.includes("-") ? "-" : null;
    if (!separator) {
      return { systolic: NaN, diastolic: NaN };
    }

    const [systolic, diastolic] = normalized.split(separator);
    return {
      systolic: Number(systolic),
      diastolic: Number(diastolic)
    };
  }

  normalizeClassification(value) {
    return value || "branco";
  }

  calculateSuggestion() {
    const pressure = this.parseBloodPressure(document.getElementById("bloodPressure").value);
    const temperature = Number(document.getElementById("temperature").value);
    const oxygen = Number(document.getElementById("oxygen").value);
    const symptoms = document.getElementById("symptoms").value.toLowerCase();
    const heartRate = Number(document.getElementById("heartRate").value);
    let risk = "verde";
    if (oxygen < 90 || pressure.systolic >= 180 || temperature >= 38.5 || symptoms.includes("dor no peito") || symptoms.includes("convuls")) {
      risk = "vermelho";
    } else if (oxygen < 94 || pressure.systolic >= 160 || temperature >= 37.8 || heartRate > 120 || symptoms.includes("falta de ar")) {
      risk = "amarelo";
    } else if (symptoms.includes("receita") || symptoms.includes("atestado")) {
      risk = "branco";
    }
    return risk;
  }

  suggestRisk() {
    const risk = this.calculateSuggestion();
    const riskInput = document.querySelector(`[name="classification"][value="${risk}"]`);
    if (riskInput) {
      riskInput.checked = true;
    }
    this.dom.riskSuggestion.textContent = `Sugestão: ${this.priorityLabels[risk]}`;
  }

  handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(this.dom.triageForm);
    const pressureText = String(data.get("bloodPressure") || "").trim();
    const temperatureValue = Number(data.get("temperature"));
    const oxygenValue = Number(data.get("oxygen"));
    const heartRateValue = Number(data.get("heartRate") || 0);
    const symptomsValue = String(data.get("symptoms") || "").trim();
    const classification = this.normalizeClassification(data.get("classification"));

    if (!this.state.selectedPatientId || !pressureText || !data.get("temperature") || !data.get("oxygen") || !symptomsValue) {
      this.callbacks.showMessage(this.dom.triageMessage, "Preencha todos os dados da triagem.");
      return;
    }

    if (this.state.triages.some((triage) => triage.patientId === this.state.selectedPatientId)) {
      this.callbacks.showMessage(this.dom.triageMessage, "Este paciente já realizou a triagem.");
      this.reset();
      return;
    }

    const pressure = this.parseBloodPressure(pressureText);
    if (Number.isNaN(pressure.systolic) || Number.isNaN(pressure.diastolic) || pressure.systolic < 40 || pressure.systolic > 250 || pressure.diastolic < 20 || pressure.diastolic > 150 || pressure.systolic < pressure.diastolic) {
      this.callbacks.showMessage(this.dom.triageMessage, "Pressão arterial inválida. Use o formato 120/80.");
      return;
    }

    if (!Number.isFinite(temperatureValue) || temperatureValue < 30 || temperatureValue > 45) {
      this.callbacks.showMessage(this.dom.triageMessage, "Temperatura inválida. Use valores entre 30°C e 45°C.");
      return;
    }

    if (!Number.isFinite(oxygenValue) || oxygenValue < 50 || oxygenValue > 100) {
      this.callbacks.showMessage(this.dom.triageMessage, "Oxigenação inválida. Use valores entre 50% e 100%.");
      return;
    }

    if (data.get("heartRate") && (!Number.isFinite(heartRateValue) || heartRateValue < 20 || heartRateValue > 220)) {
      this.callbacks.showMessage(this.dom.triageMessage, "Frequência cardíaca inválida. Use valores entre 20 e 220 bpm.");
      return;
    }

    this.state.triages.push({
      id: crypto.randomUUID(),
      patientId: this.state.selectedPatientId,
      bloodPressure: pressureText,
      temperature: String(temperatureValue),
      oxygen: String(oxygenValue),
      heartRate: data.get("heartRate") ? String(heartRateValue) : "",
      symptoms: symptomsValue,
      classification,
      time: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    });
    this.state.save();
    this.reset();
    this.callbacks.showMessage(this.dom.triageMessage, "Triagem registrada.");
    this.callbacks.renderAll();
  }

  reset() {
    this.dom.triageForm.reset();
    this.state.selectedPatientId = "";
    this.dom.riskSuggestion.textContent = "Sem sugestão";
    this.renderPatientOptions();
    this.renderPatientSummary();
    this.renderVitalPreview();
  }

  renderPatientOptions() {
    const eligiblePatients = this.state.patients.filter((patient) =>
      !this.state.triages.some((triage) => triage.patientId === patient.id)
    );

    if (!eligiblePatients.some((patient) => patient.id === this.state.selectedPatientId)) {
      this.state.selectedPatientId = "";
    }

    if (eligiblePatients.length === 0) {
      this.dom.triagePatient.innerHTML = `<option value="">Nenhum paciente aguardando triagem</option>`;
      return;
    }
    this.dom.triagePatient.innerHTML = `<option value="">Selecionar paciente</option>` + eligiblePatients.map((patient) => `
      <option value="${patient.id}">${this.state.getPatientName(patient)}</option>
    `).join("");
    this.dom.triagePatient.value = this.state.selectedPatientId;
  }

  renderPatientSummary() {
    const patient = this.state.getSelectedPatient();
    if (!patient) {
      this.dom.patientSummary.innerHTML = `<div class="empty-state">Selecione um paciente para ver o resumo.</div>`;
      return;
    }
    this.dom.patientSummary.innerHTML = `
      <div class="summary-row"><span>Nome</span><strong>${this.state.getPatientName(patient)}</strong></div>
      <div class="summary-row"><span>Idade</span><strong>${patient.age}</strong></div>
      <div class="summary-row"><span>Gênero</span><strong>${patient.gender}</strong></div>
      <div class="summary-row"><span>Convênio</span><strong>${patient.insuranceName}</strong></div>
      <div class="summary-row"><span>Plano</span><strong>${patient.insurancePlan}</strong></div>
    `;
  }

  renderVitalPreview() {
    const pressure = document.getElementById("bloodPressure").value || "--";
    const temperature = document.getElementById("temperature").value || "--";
    const oxygen = document.getElementById("oxygen").value || "--";
    const oxygenNumber = Number(oxygen);
    const oxygenClass = oxygenNumber < 90 ? "alert" : "";
    this.dom.vitalPreview.innerHTML = `
      <div class="vital-row"><span>Pressão</span><strong>${pressure}</strong></div>
      <div class="vital-row"><span>Temperatura</span><strong>${temperature} °C</strong></div>
      <div class="vital-row"><span>Oxigenação</span><strong class="${oxygenClass}">${oxygen}%</strong></div>
    `;
  }
}

window.TriageController = TriageController;
