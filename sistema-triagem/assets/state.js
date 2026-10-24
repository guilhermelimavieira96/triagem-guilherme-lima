class AppState {
  constructor(patientStorageKey, triageStorageKey) {
    this.patientStorageKey = patientStorageKey;
    this.triageStorageKey = triageStorageKey;
    this.patients = JSON.parse(localStorage.getItem(patientStorageKey) || "[]");
    this.triages = JSON.parse(localStorage.getItem(triageStorageKey) || "[]");
    this.activeScreen = "cadastro";
    this.selectedPatientId = "";
  }

  save() {
    localStorage.setItem(this.patientStorageKey, JSON.stringify(this.patients));
    localStorage.setItem(this.triageStorageKey, JSON.stringify(this.triages));
  }

  getPatientName(patient) {
    return `${patient.firstName} ${patient.lastName}`;
  }

  getSelectedPatient() {
    return this.patients.find((patient) => patient.id === this.selectedPatientId);
  }
}

window.AppState = AppState;
