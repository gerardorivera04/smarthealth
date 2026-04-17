# SmartHealth — Hospital Management System

A database-driven, web-based hospital management system. React frontend,
Express.js REST API, MySQL backend (run in Docker).

## Schema (per ER diagram)

**Entities (6):** Patient, Appointment, Doctor, Nurse, Treatment, Bill
**Relationships (5):** Admitted, Generates, Occurs, Administers, Assists

```
Patient(PatientID PK, Name, DOB, Email, Phone)
Appointment(AppointmentID PK, Date, Time, Status, doctor_id FK→Doctor)
Doctor(DoctorID PK, Name, Specialty, Department)
Nurse(NurseID PK, Name, Department)
Treatment(TreatmentCode PK, Description, Cost)
Bill(Bill_ID PK, Payment_Status, Total_Amount)

Admitted(AppointmentID FK, PatientID FK)         -- 1 patient per appointment
Generates(Bill_ID FK, AppointmentID FK)          -- 1:1 bill ↔ appointment
Occurs(AppointmentID FK, TreatmentCode FK)       -- M:N appointment ↔ treatment
Administers(TreatmentCode FK, DoctorID FK)       -- M:N doctor ↔ treatment
Assists(NurseID FK, DoctorID FK)                 -- M:N nurse ↔ doctor
```

A view `v_patient_visit_stats` rolls up per-patient visit counts, no-shows, and
last-visit date. It powers the Patient Risk Analysis advanced function.

A `users` table (email + bcrypt password + role) sits behind the patient record
to support login. It's not part of the ERD but is required by the user
authentication system requirement. Each `patients.user_id` links back to it.

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS, React Router
- **Backend:** Express 5, mysql2, JWT auth, bcryptjs
- **Database:** MySQL 8 (built and run from `db/Dockerfile`)

## Quick start

```bash
docker compose up -d --build
```

This single command starts all three services:

| Service    | Container                | URL                    |
|------------|--------------------------|------------------------|
| MySQL 8    | smarthealth-mysql        | localhost:3306         |
| Backend    | smarthealth-backend      | localhost:3001         |
| Frontend   | smarthealth-frontend     | **localhost:5173**     |

Open **http://localhost:5173** in a browser and sign up.

### Verify services are running

```bash
docker compose ps
docker compose logs -f backend
```

`docker compose ps` should show `mysql`, `backend`, and `frontend` as `Up`.

### Stopping and resetting

```bash
docker compose down        # stop containers, keep database data
docker compose down -v     # stop containers AND wipe the database (fresh reset)
```

After `down -v`, the next `up --build` re-runs
[db/init.sql](db/init.sql) and [db/seed.sql](db/seed.sql) from scratch.

### Make yourself an admin (optional)

Sign up through the UI (creates a `users` row + `patients` row), then promote:

```bash
docker exec -it smarthealth-mysql mysql -u smarthealth -psmarthealth_pw smarthealth \
  -e "UPDATE users SET role='admin' WHERE email='you@example.com';"
```

Admin accounts get extra tabs (Patients, Staffing) and can see all
appointments, manage doctors/nurses/treatments, and generate bills.

## Functionality

### Basic functions (covered in the demo checklist)

- **Insert** — every entity has create forms in the dashboard.
- **Search** — patients (by ID/name/phone/email), doctors (by name/department/
  specialty), nurses (by name/department), treatments (by code/description),
  appointments (by status).
- **Multi-table join query** — `GET /api/appointments` joins
  `appointments ⨝ doctors ⨝ admitted ⨝ patients ⨝ generates ⨝ bills`.
- **Aggregate query** — `GET /api/reports/doctor-load` groups by doctor with
  `COUNT(*)`, `SUM(...)` for completed appointments and billed totals.
- **Update** — every list row has an Edit button.
- **Delete** — every list row has a Delete button. FK violations return
  human-readable errors (e.g. cannot delete a doctor with appointments).

Other system requirements covered:

- **Doctor double-booking prevented** — `appointments` has a
  `UNIQUE (doctor_id, Date, Time)` constraint and the API surfaces the conflict.
- **Auto-billing** — `POST /api/bills` with no `Total_Amount` sums the costs
  of all `Treatments` linked to the appointment via `Occurs`.

### Advanced function: Patient Risk Analysis

`GET /api/insights/risk/:patientId` returns a 0–100 risk score with a
`low / medium / high` band and a recommended health plan. The score combines:

1. **Total appointments** from `v_patient_visit_stats` (joins
   `patients ⨝ admitted ⨝ appointments ⨝ occurs`).
2. **Recent activity** — appointments in the last 90 days.
3. **No-show rate** — `no_shows / total_appts`.
4. **Treatment diversity** — `COUNT(DISTINCT TreatmentCode)`.
5. **Recency of last visit** — days since `MAX(Date)`.

A per-factor breakdown and a tailored health plan are shown on the Overview
tab.

## API summary

All endpoints except signup/login require `Authorization: Bearer <token>`.
Endpoints marked **(admin)** require `role='admin'`.

| Method | Path                                          | Notes                                           |
|--------|-----------------------------------------------|-------------------------------------------------|
| POST   | /api/auth/signup                              | creates user + linked patient                   |
| POST   | /api/auth/login                               |                                                 |
| GET    | /api/auth/me                                  | user + patient                                  |
| GET    | /api/patients                                 | scoped to self for patients                     |
| POST   | /api/patients                                 | (admin)                                         |
| PUT    | /api/patients/:id                             | self or admin                                   |
| DELETE | /api/patients/:id                             | (admin)                                         |
| CRUD   | /api/doctors                                  | read for all, write (admin)                     |
| CRUD   | /api/nurses                                   | read for all, write (admin)                     |
| CRUD   | /api/treatments                               | read for all, write (admin)                     |
| CRUD   | /api/appointments                             | scoped to self for patients                     |
| GET/POST/DELETE | /api/appointments/:id/treatments     | manage Occurs                                   |
| CRUD   | /api/bills                                    | read scoped, write (admin); auto-sum from Occurs|
| GET/POST/DELETE | /api/administers                     | manage Administers M:N (admin write)            |
| GET/POST/DELETE | /api/assists                         | manage Assists M:N (admin write)                |
| GET    | /api/reports/doctor-load                      | aggregate report (admin)                        |
| GET    | /api/insights/risk/:patientId                 | **advanced function** — patient risk analysis   |

## Project structure

```
smarthealth/
├── docker-compose.yml         # single command runs all 3 services
├── db/                        # MySQL Docker image
│   ├── Dockerfile
│   ├── init.sql               # entities + relationship tables + view
│   └── seed.sql               # doctors, nurses, treatments, M:N seeds
├── UserServer/                # Express + mysql2 backend
│   ├── Dockerfile
│   ├── index.js
│   └── .env.example
└── UserDashboard/             # React + Vite frontend
    ├── Dockerfile             # multi-stage: build → nginx
    ├── nginx.conf             # serves SPA, proxies /api to backend
    └── src/
        ├── api.js
        ├── pages/             # Landing, Login, Signup, Dashboard
        └── components/        # one tab per entity / feature
```
