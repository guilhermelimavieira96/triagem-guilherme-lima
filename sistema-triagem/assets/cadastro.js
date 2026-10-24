class PatientRegistration {
  constructor(state, dom, callbacks) {
    this.state = state;
    this.dom = dom;
    this.callbacks = callbacks;
  }

  init() {
    this.dom.patientForm.addEventListener("submit", (event) => this.handleSubmit(event));
    this.dom.clearPatientForm.addEventListener("click", () => this.reset());
    this.dom.patientSearch.addEventListener("input", () => this.render());
    this.dom.patientList.addEventListener("click", (event) => this.handleListClick(event));
    this.dom.insurancePlan.addEventListener("change", () => this.updateInsuranceValidityVisibility());
    this.updateInsuranceValidityVisibility();

    const ageInput = document.getElementById("age");
    ageInput.addEventListener("input", () => {
      ageInput.value = ageInput.value.replace(/\D/g, "").slice(0, 3);
    });

    const firstNameInput = document.getElementById("firstName");
    const lastNameInput = document.getElementById("lastName");

    [firstNameInput, lastNameInput].forEach((input) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\d/g, "").replace(/\s{2,}/g, " ");
      });
    });
  }

  updateInsuranceValidityVisibility() {
    const validityInput = document.getElementById("insuranceValidUntil");
    const validityLabel = validityInput.closest("label");
    const isPublicHealthPlan = this.dom.insurancePlan.value === "SUS";

    validityLabel.hidden = isPublicHealthPlan;
    validityInput.disabled = isPublicHealthPlan;
    if (isPublicHealthPlan) {
      validityInput.value = "";
    }
  }

  handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(this.dom.patientForm);
    const rawAge = Number(data.get("age"));
    const firstName = String(data.get("firstName") || "").trim();
    const lastName = String(data.get("lastName") || "").trim();
    const patient = {
      id: crypto.randomUUID(),
      firstName,
      lastName,
      age: data.get("age"),
      gender: data.get("gender"),
      address: data.get("address").trim(),
      insuranceName: data.get("insuranceName").trim(),
      insuranceCard: data.get("insuranceCard").trim(),
      insuranceValidUntil: data.get("insuranceValidUntil"),
      insurancePlan: data.get("insurancePlan"),
      createdAt: new Date().toISOString()
    };

    if (!firstName || !lastName || !patient.age || !patient.gender || !patient.address || !patient.insuranceName || !patient.insuranceCard) {
      this.callbacks.showMessage(this.dom.patientMessage, "Preencha os campos obrigatórios.");
      return;
    }

    if (!/^[A-Za-zÀ-ÿ\s]+$/.test(firstName) || !/^[A-Za-zÀ-ÿ\s]+$/.test(lastName)) {
      this.callbacks.showMessage(this.dom.patientMessage, "Nome e sobrenome devem conter apenas letras e espaços.");
      return;
    }

    if (!Number.isInteger(rawAge) || rawAge < 0 || rawAge > 120) {
      this.callbacks.showMessage(this.dom.patientMessage, "Idade inválida. Use um valor entre 0 e 120 anos.");
      return;
    }

    if (patient.insuranceValidUntil) {
      const validUntil = new Date(`${patient.insuranceValidUntil}-01T00:00:00`);
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      if (Number.isNaN(validUntil.getTime()) || validUntil < currentMonth) {
        this.callbacks.showMessage(this.dom.patientMessage, "A validade do convênio deve ser igual ou posterior ao mês atual.");
        return;
      }
    }

    patient.age = String(rawAge);
    this.state.patients.push(patient);
    this.state.selectedPatientId = patient.id;
    this.state.save();
    this.reset();
    this.callbacks.showMessage(this.dom.patientMessage, "Paciente cadastrado.");
    this.callbacks.renderAll();
  }

  handleListClick(event) {
    const selectButton = event.target.closest("[data-select-patient]");
    const deleteButton = event.target.closest("[data-delete-patient]");
    if (selectButton) {
      this.state.selectedPatientId = selectButton.dataset.selectPatient;
      this.callbacks.setScreen("triagem");
      this.callbacks.renderAll();
    }
    if (deleteButton) {
      const index = Number(deleteButton.dataset.deletePatient);
      const removed = this.state.patients.splice(index, 1)[0];
      if (removed) {
        this.state.triages = this.state.triages.filter((triage) => triage.patientId !== removed.id);
      }
      this.state.save();
      this.callbacks.renderAll();
    }
  }

  reset() {
    this.dom.patientForm.reset();
    this.updateInsuranceValidityVisibility();
  }

  render() {
    const search = (this.dom.patientSearch.value || "").trim().toLowerCase();
    const patients = this.state.patients.filter((patient) => {
      const firstName = (patient.firstName || "").toLowerCase();
      const lastName = (patient.lastName || "").toLowerCase();
      const fullName = this.state.getPatientName(patient).toLowerCase();

      return !search || firstName.includes(search) || lastName.includes(search) || fullName.includes(search);
    });

    if (patients.length === 0) {
      this.dom.patientList.innerHTML = `<div class="empty-state">Nenhum paciente na recepção.</div>`;
      return;
    }
    this.dom.patientList.innerHTML = patients.map((patient, index) => `
      <article class="patient-card">
        <header>
          <div>
            <strong>${this.state.getPatientName(patient)}</strong>
            <small>${patient.age} anos · ${patient.gender}</small>
          </div>
          <span class="tag">${patient.insurancePlan}</span>
        </header>
        <div class="meta-line">${patient.address}</div>
        <div class="meta-line">${patient.insuranceName} · ${patient.insuranceCard}</div>
        <div class="patient-actions">
          <button class="small-button" data-select-patient="${patient.id}" type="button">Triar</button>
          <button class="small-button danger-button" data-delete-patient="${index}" type="button">Remover</button>
        </div>
      </article>
    `).join("");
  }
}

window.PatientRegistration = PatientRegistration;
