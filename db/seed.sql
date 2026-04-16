USE smarthealth;

INSERT INTO doctors (Name, Specialty, Department) VALUES
  ('Dr. Alice Tran',   'Cardiology',       'Cardiology'),
  ('Dr. Ben Ortiz',    'General Practice', 'Primary Care'),
  ('Dr. Clara Singh',  'Endocrinology',    'Internal Medicine'),
  ('Dr. Daniel Park',  'Neurology',        'Neuroscience'),
  ('Dr. Emma Lee',     'Pediatrics',       'Pediatrics');

INSERT INTO nurses (Name, Department) VALUES
  ('Nurse Riya Patel',  'Cardiology'),
  ('Nurse Marco Diaz',  'Primary Care'),
  ('Nurse Sara Kim',    'Pediatrics'),
  ('Nurse Tom Becker',  'Neuroscience');

INSERT INTO treatments (TreatmentCode, Description, Cost) VALUES
  ('T-CONS',    'General consultation',          75.00),
  ('T-ECG',     'Electrocardiogram',            150.00),
  ('T-BLOOD',   'Comprehensive blood panel',    120.00),
  ('T-XRAY',    'X-ray imaging',                200.00),
  ('T-VACC',    'Vaccination',                   45.00),
  ('T-PHYSIO',  'Physical therapy session',      90.00);

-- Some Administers links so a doctor "is qualified" to give certain treatments.
INSERT INTO administers (TreatmentCode, DoctorID) VALUES
  ('T-CONS',  1), ('T-CONS',  2), ('T-CONS', 3), ('T-CONS', 4), ('T-CONS', 5),
  ('T-ECG',   1),
  ('T-BLOOD', 2), ('T-BLOOD', 3),
  ('T-XRAY',  1), ('T-XRAY',  4),
  ('T-VACC',  2), ('T-VACC',  5),
  ('T-PHYSIO', 4);

INSERT INTO assists (NurseID, DoctorID) VALUES
  (1, 1),
  (2, 2),
  (3, 5),
  (4, 4),
  (1, 3);
