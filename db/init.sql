-- Hospital Management System schema
-- 6 entities: Patient, Appointment, Doctor, Nurse, Treatment, Bill
-- 5 relationships: Admitted, Generates, Occurs, Administers, Assists
-- (Appointment also has a doctor_id FK per ERD line "Appointment — Doctor")

USE smarthealth;

-- Auth table: not in the ERD, but required for login. Each Patient row links
-- back to a users row so the patient can sign in and view their own records.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('patient', 'admin') NOT NULL DEFAULT 'patient',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----- Entities -----

CREATE TABLE IF NOT EXISTS patients (
  PatientID INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE NULL,
  Name VARCHAR(255) NOT NULL,
  DOB DATE NULL,
  Email VARCHAR(255) UNIQUE NOT NULL,
  Phone VARCHAR(32) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS doctors (
  DoctorID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(255) NOT NULL,
  Specialty VARCHAR(128) NOT NULL,
  Department VARCHAR(128) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nurses (
  NurseID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(255) NOT NULL,
  Department VARCHAR(128) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS treatments (
  TreatmentCode VARCHAR(32) PRIMARY KEY,
  Description VARCHAR(512) NOT NULL,
  Cost DECIMAL(10,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointments (
  AppointmentID INT AUTO_INCREMENT PRIMARY KEY,
  Date DATE NOT NULL,
  Time TIME NOT NULL,
  Status ENUM('Scheduled', 'Completed', 'Cancelled', 'No-show') NOT NULL DEFAULT 'Scheduled',
  doctor_id INT NOT NULL,
  FOREIGN KEY (doctor_id) REFERENCES doctors(DoctorID) ON DELETE RESTRICT,
  INDEX idx_appt_doctor_when (doctor_id, Date, Time),
  -- prevent doctor double-booking on the same date/time
  UNIQUE KEY uq_doctor_slot (doctor_id, Date, Time)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bills (
  Bill_ID INT AUTO_INCREMENT PRIMARY KEY,
  Payment_Status ENUM('Unpaid', 'Partially Paid', 'Paid') NOT NULL DEFAULT 'Unpaid',
  Total_Amount DECIMAL(10,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ----- Relationships -----

-- Admitted: Patient — Appointment (1:N from patient → appointments)
-- Each appointment is admitted for exactly one patient; modeled as a join
-- table per the schema you provided. UNIQUE on AppointmentID enforces 1:1 on
-- appointment side (one patient per appointment).
CREATE TABLE IF NOT EXISTS admitted (
  AppointmentID INT NOT NULL UNIQUE,
  PatientID INT NOT NULL,
  PRIMARY KEY (AppointmentID, PatientID),
  FOREIGN KEY (AppointmentID) REFERENCES appointments(AppointmentID) ON DELETE CASCADE,
  FOREIGN KEY (PatientID) REFERENCES patients(PatientID) ON DELETE CASCADE,
  INDEX idx_admitted_patient (PatientID)
) ENGINE=InnoDB;

-- Generates: Bill — Appointment (1:1)
CREATE TABLE IF NOT EXISTS generates (
  Bill_ID INT NOT NULL UNIQUE,
  AppointmentID INT NOT NULL UNIQUE,
  PRIMARY KEY (Bill_ID, AppointmentID),
  FOREIGN KEY (Bill_ID) REFERENCES bills(Bill_ID) ON DELETE CASCADE,
  FOREIGN KEY (AppointmentID) REFERENCES appointments(AppointmentID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Occurs: Appointment — Treatment (M:N)
CREATE TABLE IF NOT EXISTS occurs (
  AppointmentID INT NOT NULL,
  TreatmentCode VARCHAR(32) NOT NULL,
  PRIMARY KEY (AppointmentID, TreatmentCode),
  FOREIGN KEY (AppointmentID) REFERENCES appointments(AppointmentID) ON DELETE CASCADE,
  FOREIGN KEY (TreatmentCode) REFERENCES treatments(TreatmentCode) ON DELETE RESTRICT,
  INDEX idx_occurs_treatment (TreatmentCode)
) ENGINE=InnoDB;

-- Administers: Treatment — Doctor (M:N per your relational schema)
CREATE TABLE IF NOT EXISTS administers (
  TreatmentCode VARCHAR(32) NOT NULL,
  DoctorID INT NOT NULL,
  PRIMARY KEY (TreatmentCode, DoctorID),
  FOREIGN KEY (TreatmentCode) REFERENCES treatments(TreatmentCode) ON DELETE CASCADE,
  FOREIGN KEY (DoctorID) REFERENCES doctors(DoctorID) ON DELETE CASCADE,
  INDEX idx_administers_doctor (DoctorID)
) ENGINE=InnoDB;

-- Assists: Nurse — Doctor (M:N)
CREATE TABLE IF NOT EXISTS assists (
  NurseID INT NOT NULL,
  DoctorID INT NOT NULL,
  PRIMARY KEY (NurseID, DoctorID),
  FOREIGN KEY (NurseID) REFERENCES nurses(NurseID) ON DELETE CASCADE,
  FOREIGN KEY (DoctorID) REFERENCES doctors(DoctorID) ON DELETE CASCADE,
  INDEX idx_assists_doctor (DoctorID)
) ENGINE=InnoDB;

-- ----- View used by patient risk analysis -----
-- Per-patient visit counts and last visit date, used by the Risk Analysis
-- module to identify high-risk patients.
CREATE OR REPLACE VIEW v_patient_visit_stats AS
SELECT
  p.PatientID,
  p.Name,
  COUNT(a.AppointmentID)                                                AS total_appts,
  SUM(CASE WHEN a.Status = 'Completed' THEN 1 ELSE 0 END)               AS completed_appts,
  SUM(CASE WHEN a.Status = 'No-show'   THEN 1 ELSE 0 END)               AS no_shows,
  MAX(a.Date)                                                           AS last_visit,
  COUNT(DISTINCT o.TreatmentCode)                                       AS distinct_treatments
FROM patients p
LEFT JOIN admitted ad ON ad.PatientID = p.PatientID
LEFT JOIN appointments a ON a.AppointmentID = ad.AppointmentID
LEFT JOIN occurs o ON o.AppointmentID = a.AppointmentID
GROUP BY p.PatientID, p.Name;
