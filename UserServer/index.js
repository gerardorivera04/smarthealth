require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "smarthealth-dev-secret-change-in-production";

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "smarthealth",
  password: process.env.DB_PASSWORD || "smarthealth_pw",
  database: process.env.DB_NAME || "smarthealth",
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  dateStrings: true,
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ---------- Auth ----------

// Signup creates a users row + a linked patients row in one transaction.
app.post("/api/auth/signup", asyncHandler(async (req, res) => {
  const { email, name, password, dob, phone } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: "email, name, and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const role = email.toLowerCase().endsWith("@smarthealth.com") ? "admin" : "patient";

    const hashed = await bcrypt.hash(password, 10);
    const [u] = await conn.query(
      "INSERT INTO users (email, password, role) VALUES (?, ?, ?)",
      [email, hashed, role]
    );

    const [p] = await conn.query(
      "INSERT INTO patients (user_id, Name, DOB, Email, Phone) VALUES (?, ?, ?, ?, ?)",
      [u.insertId, name, dob || null, email, phone || null]
    );

    await conn.commit();

    const token = jwt.sign(
      { id: u.insertId, email, role, patientId: p.insertId, name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.status(201).json({
      token,
      user: { id: u.insertId, email, role, patientId: p.insertId, name },
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Invalid email or password" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  // Find linked patient (admins may not have one)
  const [pRows] = await pool.query(
    "SELECT PatientID, Name FROM patients WHERE user_id = ?",
    [user.id]
  );
  const patient = pRows[0];

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      patientId: patient?.PatientID || null,
      name: patient?.Name || user.email,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      patientId: patient?.PatientID || null,
      name: patient?.Name || user.email,
    },
  });
}));

app.get("/api/auth/me", authenticateToken, asyncHandler(async (req, res) => {
  const [[u]] = await pool.query(
    "SELECT id, email, role FROM users WHERE id = ?",
    [req.user.id]
  );
  if (!u) return res.status(404).json({ error: "Not found" });
  const [[patient]] = await pool.query(
    "SELECT * FROM patients WHERE user_id = ?",
    [req.user.id]
  );
  res.json({ user: u, patient: patient || null });
}));

// ---------- Patients ----------

// Patients can only see/edit their own row. Admins can see/edit all.
app.get("/api/patients", authenticateToken, asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    const [rows] = await pool.query("SELECT * FROM patients WHERE user_id = ?", [req.user.id]);
    return res.json(rows);
  }
  const { q } = req.query;
  let sql = "SELECT * FROM patients";
  const params = [];
  if (q) {
    sql += " WHERE PatientID = ? OR Name LIKE ? OR Phone LIKE ? OR Email LIKE ?";
    const like = `%${q}%`;
    params.push(Number.isNaN(Number(q)) ? -1 : Number(q), like, like, like);
  }
  sql += " ORDER BY Name";
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

app.get("/api/patients/:id", authenticateToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role !== "admin" && req.user.patientId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const [[row]] = await pool.query("SELECT * FROM patients WHERE PatientID = ?", [id]);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
}));

app.post("/api/patients", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  // Admin creates a patient record without an account (e.g. walk-in registration).
  const { Name, DOB, Email, Phone } = req.body;
  if (!Name || !Email) return res.status(400).json({ error: "Name and Email required" });
  try {
    const [r] = await pool.query(
      "INSERT INTO patients (Name, DOB, Email, Phone) VALUES (?, ?, ?, ?)",
      [Name, DOB || null, Email, Phone || null]
    );
    const [[row]] = await pool.query("SELECT * FROM patients WHERE PatientID = ?", [r.insertId]);
    res.status(201).json(row);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "A patient with that email already exists" });
    }
    throw err;
  }
}));

app.put("/api/patients/:id", authenticateToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role !== "admin" && req.user.patientId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { Name, DOB, Email, Phone } = req.body;
  const [r] = await pool.query(
    `UPDATE patients
        SET Name = COALESCE(?, Name),
            DOB = ?,
            Email = COALESCE(?, Email),
            Phone = ?
      WHERE PatientID = ?`,
    [Name ?? null, DOB || null, Email ?? null, Phone || null, id]
  );
  if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
  const [[row]] = await pool.query("SELECT * FROM patients WHERE PatientID = ?", [id]);
  res.json(row);
}));

app.delete("/api/patients/:id", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const [r] = await pool.query("DELETE FROM patients WHERE PatientID = ?", [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
}));

// ---------- Doctors (admin write, all read) ----------

app.get("/api/doctors", authenticateToken, asyncHandler(async (req, res) => {
  const { q, department, specialty } = req.query;
  let sql = "SELECT * FROM doctors WHERE 1=1";
  const params = [];
  if (q) {
    sql += " AND Name LIKE ?";
    params.push(`%${q}%`);
  }
  if (department) {
    sql += " AND Department = ?";
    params.push(department);
  }
  if (specialty) {
    sql += " AND Specialty = ?";
    params.push(specialty);
  }
  sql += " ORDER BY Name";
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

app.post("/api/doctors", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { Name, Specialty, Department } = req.body;
  if (!Name || !Specialty) return res.status(400).json({ error: "Name and Specialty required" });
  const [r] = await pool.query(
    "INSERT INTO doctors (Name, Specialty, Department) VALUES (?, ?, ?)",
    [Name, Specialty, Department || null]
  );
  const [[row]] = await pool.query("SELECT * FROM doctors WHERE DoctorID = ?", [r.insertId]);
  res.status(201).json(row);
}));

app.put("/api/doctors/:id", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { Name, Specialty, Department } = req.body;
  await pool.query(
    `UPDATE doctors
        SET Name = COALESCE(?, Name),
            Specialty = COALESCE(?, Specialty),
            Department = ?
      WHERE DoctorID = ?`,
    [Name ?? null, Specialty ?? null, Department || null, req.params.id]
  );
  const [[row]] = await pool.query("SELECT * FROM doctors WHERE DoctorID = ?", [req.params.id]);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
}));

app.delete("/api/doctors/:id", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const [r] = await pool.query("DELETE FROM doctors WHERE DoctorID = ?", [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({ error: "Doctor still referenced by appointments" });
    }
    throw err;
  }
}));

// ---------- Nurses (admin write, all read) ----------

app.get("/api/nurses", authenticateToken, asyncHandler(async (req, res) => {
  const { q, department } = req.query;
  let sql = "SELECT * FROM nurses WHERE 1=1";
  const params = [];
  if (q) {
    sql += " AND Name LIKE ?";
    params.push(`%${q}%`);
  }
  if (department) {
    sql += " AND Department = ?";
    params.push(department);
  }
  sql += " ORDER BY Name";
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

app.post("/api/nurses", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { Name, Department } = req.body;
  if (!Name) return res.status(400).json({ error: "Name required" });
  const [r] = await pool.query(
    "INSERT INTO nurses (Name, Department) VALUES (?, ?)",
    [Name, Department || null]
  );
  const [[row]] = await pool.query("SELECT * FROM nurses WHERE NurseID = ?", [r.insertId]);
  res.status(201).json(row);
}));

app.put("/api/nurses/:id", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { Name, Department } = req.body;
  await pool.query(
    "UPDATE nurses SET Name = COALESCE(?, Name), Department = ? WHERE NurseID = ?",
    [Name ?? null, Department || null, req.params.id]
  );
  const [[row]] = await pool.query("SELECT * FROM nurses WHERE NurseID = ?", [req.params.id]);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
}));

app.delete("/api/nurses/:id", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const [r] = await pool.query("DELETE FROM nurses WHERE NurseID = ?", [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
}));

// ---------- Treatments (admin write, all read) ----------

app.get("/api/treatments", authenticateToken, asyncHandler(async (req, res) => {
  const { q } = req.query;
  let sql = "SELECT * FROM treatments";
  const params = [];
  if (q) {
    sql += " WHERE TreatmentCode LIKE ? OR Description LIKE ?";
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY TreatmentCode";
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

app.post("/api/treatments", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { TreatmentCode, Description, Cost } = req.body;
  if (!TreatmentCode || !Description) {
    return res.status(400).json({ error: "TreatmentCode and Description required" });
  }
  try {
    await pool.query(
      "INSERT INTO treatments (TreatmentCode, Description, Cost) VALUES (?, ?, ?)",
      [TreatmentCode, Description, Cost ?? 0]
    );
    const [[row]] = await pool.query("SELECT * FROM treatments WHERE TreatmentCode = ?", [
      TreatmentCode,
    ]);
    res.status(201).json(row);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "TreatmentCode already exists" });
    }
    throw err;
  }
}));

app.put("/api/treatments/:code", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { Description, Cost } = req.body;
  await pool.query(
    "UPDATE treatments SET Description = COALESCE(?, Description), Cost = COALESCE(?, Cost) WHERE TreatmentCode = ?",
    [Description ?? null, Cost ?? null, req.params.code]
  );
  const [[row]] = await pool.query("SELECT * FROM treatments WHERE TreatmentCode = ?", [
    req.params.code,
  ]);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
}));

app.delete(
  "/api/treatments/:code",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      const [r] = await pool.query("DELETE FROM treatments WHERE TreatmentCode = ?", [
        req.params.code,
      ]);
      if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
      res.status(204).end();
    } catch (err) {
      if (err.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({ error: "Treatment is referenced by appointments" });
      }
      throw err;
    }
  })
);

// ---------- Appointments ----------
//
// Joins users + patients + doctors via the Admitted relationship.
// Patients see only their own; admins see all.

const APPT_BASE_QUERY = `
  SELECT a.AppointmentID, a.Date, a.Time, a.Status,
         d.DoctorID, d.Name AS DoctorName, d.Specialty AS DoctorSpecialty,
         p.PatientID, p.Name AS PatientName, p.Email AS PatientEmail,
         b.Bill_ID, b.Total_Amount, b.Payment_Status
    FROM appointments a
    JOIN doctors d   ON d.DoctorID = a.doctor_id
    JOIN admitted ad ON ad.AppointmentID = a.AppointmentID
    JOIN patients p  ON p.PatientID = ad.PatientID
    LEFT JOIN generates g ON g.AppointmentID = a.AppointmentID
    LEFT JOIN bills b     ON b.Bill_ID = g.Bill_ID`;

app.get("/api/appointments", authenticateToken, asyncHandler(async (req, res) => {
  const { patientId, doctorId, status } = req.query;
  let sql = APPT_BASE_QUERY + " WHERE 1=1";
  const params = [];

  if (req.user.role !== "admin") {
    sql += " AND p.PatientID = ?";
    params.push(req.user.patientId);
  } else if (patientId) {
    sql += " AND p.PatientID = ?";
    params.push(Number(patientId));
  }
  if (doctorId) {
    sql += " AND d.DoctorID = ?";
    params.push(Number(doctorId));
  }
  if (status) {
    sql += " AND a.Status = ?";
    params.push(status);
  }
  sql += " ORDER BY a.Date DESC, a.Time DESC";

  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

app.post("/api/appointments", authenticateToken, asyncHandler(async (req, res) => {
  const { Date: apptDate, Time: apptTime, Status, doctor_id, PatientID } = req.body;
  if (!apptDate || !apptTime || !doctor_id) {
    return res.status(400).json({ error: "Date, Time, and doctor_id are required" });
  }

  // Patients can only book for themselves; admins must specify a patient.
  let targetPatientId;
  if (req.user.role === "admin") {
    if (!PatientID) return res.status(400).json({ error: "PatientID required" });
    targetPatientId = Number(PatientID);
  } else {
    targetPatientId = req.user.patientId;
    if (!targetPatientId) return res.status(400).json({ error: "No patient profile linked" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let r;
    try {
      [r] = await conn.query(
        "INSERT INTO appointments (Date, Time, Status, doctor_id) VALUES (?, ?, ?, ?)",
        [apptDate, apptTime, Status || "Scheduled", doctor_id]
      );
    } catch (err) {
      await conn.rollback();
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Doctor is already booked at that date and time" });
      }
      throw err;
    }
    await conn.query(
      "INSERT INTO admitted (AppointmentID, PatientID) VALUES (?, ?)",
      [r.insertId, targetPatientId]
    );
    await conn.commit();

    const [[row]] = await pool.query(APPT_BASE_QUERY + " WHERE a.AppointmentID = ?", [r.insertId]);
    res.status(201).json(row);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

app.put("/api/appointments/:id", authenticateToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  // Authorization: patient can only modify their own appointment
  const [[owner]] = await pool.query(
    "SELECT PatientID FROM admitted WHERE AppointmentID = ?",
    [id]
  );
  if (!owner) return res.status(404).json({ error: "Not found" });
  if (req.user.role !== "admin" && owner.PatientID !== req.user.patientId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { Date: apptDate, Time: apptTime, Status, doctor_id } = req.body;
  try {
    const [r] = await pool.query(
      `UPDATE appointments
          SET Date = COALESCE(?, Date),
              Time = COALESCE(?, Time),
              Status = COALESCE(?, Status),
              doctor_id = COALESCE(?, doctor_id)
        WHERE AppointmentID = ?`,
      [apptDate ?? null, apptTime ?? null, Status ?? null, doctor_id ?? null, id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Doctor is already booked at that date and time" });
    }
    throw err;
  }
  const [[row]] = await pool.query(APPT_BASE_QUERY + " WHERE a.AppointmentID = ?", [id]);
  res.json(row);
}));

app.delete("/api/appointments/:id", authenticateToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const [[owner]] = await pool.query(
    "SELECT PatientID FROM admitted WHERE AppointmentID = ?",
    [id]
  );
  if (!owner) return res.status(404).json({ error: "Not found" });
  if (req.user.role !== "admin" && owner.PatientID !== req.user.patientId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await pool.query("DELETE FROM appointments WHERE AppointmentID = ?", [id]);
  res.status(204).end();
}));

// ---------- Occurs (treatments per appointment) ----------

app.get("/api/appointments/:id/treatments", authenticateToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const [[owner]] = await pool.query(
    "SELECT PatientID FROM admitted WHERE AppointmentID = ?",
    [id]
  );
  if (!owner) return res.status(404).json({ error: "Not found" });
  if (req.user.role !== "admin" && owner.PatientID !== req.user.patientId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const [rows] = await pool.query(
    `SELECT t.TreatmentCode, t.Description, t.Cost
       FROM occurs o JOIN treatments t ON t.TreatmentCode = o.TreatmentCode
      WHERE o.AppointmentID = ?
      ORDER BY t.TreatmentCode`,
    [id]
  );
  res.json(rows);
}));

// Add a treatment to an appointment (doctors/admin scenario; we allow any
// authenticated user who owns/manages the appointment).
app.post("/api/appointments/:id/treatments", authenticateToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { TreatmentCode } = req.body;
  if (!TreatmentCode) return res.status(400).json({ error: "TreatmentCode required" });

  const [[owner]] = await pool.query(
    "SELECT PatientID FROM admitted WHERE AppointmentID = ?",
    [id]
  );
  if (!owner) return res.status(404).json({ error: "Not found" });
  if (req.user.role !== "admin" && owner.PatientID !== req.user.patientId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    await pool.query(
      "INSERT INTO occurs (AppointmentID, TreatmentCode) VALUES (?, ?)",
      [id, TreatmentCode]
    );
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Treatment already on this appointment" });
    }
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ error: "Unknown TreatmentCode" });
    }
    throw err;
  }
  res.status(201).json({ AppointmentID: id, TreatmentCode });
}));

app.delete(
  "/api/appointments/:id/treatments/:code",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[owner]] = await pool.query(
      "SELECT PatientID FROM admitted WHERE AppointmentID = ?",
      [id]
    );
    if (!owner) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && owner.PatientID !== req.user.patientId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const [r] = await pool.query(
      "DELETE FROM occurs WHERE AppointmentID = ? AND TreatmentCode = ?",
      [id, req.params.code]
    );
    if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  })
);

// ---------- Bills ----------

app.get("/api/bills", authenticateToken, asyncHandler(async (req, res) => {
  let sql = `
    SELECT b.Bill_ID, b.Total_Amount, b.Payment_Status,
           a.AppointmentID, a.Date, a.Time,
           p.PatientID, p.Name AS PatientName
      FROM bills b
      JOIN generates g ON g.Bill_ID = b.Bill_ID
      JOIN appointments a ON a.AppointmentID = g.AppointmentID
      JOIN admitted ad ON ad.AppointmentID = a.AppointmentID
      JOIN patients p ON p.PatientID = ad.PatientID`;
  const params = [];
  if (req.user.role !== "admin") {
    sql += " WHERE p.PatientID = ?";
    params.push(req.user.patientId);
  }
  sql += " ORDER BY a.Date DESC";
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

// Create a bill for an appointment. Total auto-computed from its treatments.
app.post("/api/bills", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { AppointmentID, Payment_Status, Total_Amount } = req.body;
  if (!AppointmentID) return res.status(400).json({ error: "AppointmentID required" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let total = Total_Amount;
    if (total == null) {
      const [[sumRow]] = await conn.query(
        `SELECT COALESCE(SUM(t.Cost), 0) AS s
           FROM occurs o JOIN treatments t ON t.TreatmentCode = o.TreatmentCode
          WHERE o.AppointmentID = ?`,
        [AppointmentID]
      );
      total = Number(sumRow.s);
    }

    const [b] = await conn.query(
      "INSERT INTO bills (Payment_Status, Total_Amount) VALUES (?, ?)",
      [Payment_Status || "Unpaid", total]
    );
    try {
      await conn.query(
        "INSERT INTO generates (Bill_ID, AppointmentID) VALUES (?, ?)",
        [b.insertId, AppointmentID]
      );
    } catch (err) {
      await conn.rollback();
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Appointment already has a bill" });
      }
      throw err;
    }
    await conn.commit();
    const [[row]] = await pool.query("SELECT * FROM bills WHERE Bill_ID = ?", [b.insertId]);
    res.status(201).json({ ...row, AppointmentID });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

app.put("/api/bills/:id", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { Payment_Status, Total_Amount } = req.body;
  await pool.query(
    "UPDATE bills SET Payment_Status = COALESCE(?, Payment_Status), Total_Amount = COALESCE(?, Total_Amount) WHERE Bill_ID = ?",
    [Payment_Status ?? null, Total_Amount ?? null, req.params.id]
  );
  const [[row]] = await pool.query("SELECT * FROM bills WHERE Bill_ID = ?", [req.params.id]);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
}));

app.post("/api/bills/:id/pay", authenticateToken, asyncHandler(async (req, res) => {
  const billId = req.params.id;
  const [[bill]] = await pool.query(
    `SELECT b.Bill_ID, b.Payment_Status, p.PatientID
       FROM bills b
       JOIN generates g ON g.Bill_ID = b.Bill_ID
       JOIN admitted ad ON ad.AppointmentID = g.AppointmentID
       JOIN patients p ON p.PatientID = ad.PatientID
      WHERE b.Bill_ID = ?`,
    [billId]
  );
  if (!bill) return res.status(404).json({ error: "Bill not found" });
  if (req.user.role !== "admin" && bill.PatientID !== req.user.patientId) {
    return res.status(403).json({ error: "Not your bill" });
  }
  if (bill.Payment_Status === "Paid") {
    return res.status(400).json({ error: "Bill is already paid" });
  }
  await pool.query("UPDATE bills SET Payment_Status = 'Paid' WHERE Bill_ID = ?", [billId]);
  const [[updated]] = await pool.query("SELECT * FROM bills WHERE Bill_ID = ?", [billId]);
  res.json(updated);
}));

app.delete("/api/bills/:id", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const [r] = await pool.query("DELETE FROM bills WHERE Bill_ID = ?", [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
}));

// ---------- Administers (treatment ↔ doctor) ----------

app.get("/api/administers", authenticateToken, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ad.TreatmentCode, t.Description, ad.DoctorID, d.Name AS DoctorName, d.Specialty
       FROM administers ad
       JOIN treatments t ON t.TreatmentCode = ad.TreatmentCode
       JOIN doctors d    ON d.DoctorID = ad.DoctorID
      ORDER BY t.TreatmentCode, d.Name`
  );
  res.json(rows);
}));

app.post("/api/administers", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { TreatmentCode, DoctorID } = req.body;
  if (!TreatmentCode || !DoctorID) {
    return res.status(400).json({ error: "TreatmentCode and DoctorID required" });
  }
  try {
    await pool.query("INSERT INTO administers (TreatmentCode, DoctorID) VALUES (?, ?)", [
      TreatmentCode,
      DoctorID,
    ]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Already exists" });
    if (err.code === "ER_NO_REFERENCED_ROW_2")
      return res.status(400).json({ error: "Unknown TreatmentCode or DoctorID" });
    throw err;
  }
  res.status(201).json({ TreatmentCode, DoctorID });
}));

app.delete(
  "/api/administers/:code/:doctorId",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [r] = await pool.query(
      "DELETE FROM administers WHERE TreatmentCode = ? AND DoctorID = ?",
      [req.params.code, req.params.doctorId]
    );
    if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  })
);

// ---------- Assists (nurse ↔ doctor) ----------

app.get("/api/assists", authenticateToken, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.NurseID, n.Name AS NurseName, n.Department,
            a.DoctorID, d.Name AS DoctorName, d.Specialty
       FROM assists a
       JOIN nurses n   ON n.NurseID = a.NurseID
       JOIN doctors d  ON d.DoctorID = a.DoctorID
      ORDER BY n.Name, d.Name`
  );
  res.json(rows);
}));

app.post("/api/assists", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { NurseID, DoctorID } = req.body;
  if (!NurseID || !DoctorID) {
    return res.status(400).json({ error: "NurseID and DoctorID required" });
  }
  try {
    await pool.query("INSERT INTO assists (NurseID, DoctorID) VALUES (?, ?)", [NurseID, DoctorID]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Already exists" });
    if (err.code === "ER_NO_REFERENCED_ROW_2")
      return res.status(400).json({ error: "Unknown NurseID or DoctorID" });
    throw err;
  }
  res.status(201).json({ NurseID, DoctorID });
}));

app.delete(
  "/api/assists/:nurseId/:doctorId",
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [r] = await pool.query("DELETE FROM assists WHERE NurseID = ? AND DoctorID = ?", [
      req.params.nurseId,
      req.params.doctorId,
    ]);
    if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  })
);

// ---------- Aggregate query (used in basic functions checklist) ----------
//
// Per-doctor counts and revenue across all completed appointments. Joins
// doctors ⨝ appointments ⨝ admitted ⨝ patients and aggregates by doctor.
app.get("/api/reports/doctor-load", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT d.DoctorID, d.Name AS DoctorName, d.Specialty,
            COUNT(a.AppointmentID) AS appts,
            SUM(CASE WHEN a.Status = 'Completed' THEN 1 ELSE 0 END) AS completed,
            COALESCE(SUM(b.Total_Amount), 0) AS billed_total
       FROM doctors d
       LEFT JOIN appointments a ON a.doctor_id = d.DoctorID
       LEFT JOIN generates g    ON g.AppointmentID = a.AppointmentID
       LEFT JOIN bills b        ON b.Bill_ID = g.Bill_ID
      GROUP BY d.DoctorID, d.Name, d.Specialty
      ORDER BY appts DESC`
  );
  res.json(rows);
}));

// ---------- Advanced function: Patient Risk Analysis ----------
//
// Pulls visit frequency, no-show rate, distinct treatments, and recent
// 90-day activity from v_patient_visit_stats joined to live appointment
// data. Bands: low / medium / high.
app.get("/api/insights/risk/:patientId", authenticateToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.patientId);
  if (req.user.role !== "admin" && req.user.patientId !== id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const [[stats]] = await pool.query(
    "SELECT * FROM v_patient_visit_stats WHERE PatientID = ?",
    [id]
  );
  if (!stats) return res.status(404).json({ error: "Patient not found" });

  const [[recent]] = await pool.query(
    `SELECT
        SUM(CASE WHEN a.Date >= (CURDATE() - INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS recent_appts,
        SUM(CASE WHEN a.Date >= (CURDATE() - INTERVAL 90 DAY) AND a.Status = 'Completed' THEN 1 ELSE 0 END) AS recent_completed
       FROM appointments a
       JOIN admitted ad ON ad.AppointmentID = a.AppointmentID
      WHERE ad.PatientID = ?`,
    [id]
  );

  const factors = [];
  let score = 0;

  const total = Number(stats.total_appts) || 0;
  const completed = Number(stats.completed_appts) || 0;
  const noShows = Number(stats.no_shows) || 0;
  const distinctTx = Number(stats.distinct_treatments) || 0;
  const recentAppts = Number(recent?.recent_appts) || 0;
  const recentCompleted = Number(recent?.recent_completed) || 0;

  // High visit frequency
  let p = 0;
  if (total >= 10) p = 25;
  else if (total >= 5) p = 15;
  else if (total >= 2) p = 5;
  score += p;
  factors.push({ factor: "Total appointments", value: String(total), points: p });

  // Recent activity
  p = 0;
  if (recentAppts >= 4) p = 25;
  else if (recentAppts >= 2) p = 15;
  else if (recentAppts >= 1) p = 5;
  score += p;
  factors.push({ factor: "Appointments in last 90 days", value: String(recentAppts), points: p });

  // No-show rate (signals nonadherence)
  const noShowRate = total > 0 ? noShows / total : 0;
  p = 0;
  if (noShowRate >= 0.4) p = 15;
  else if (noShowRate >= 0.2) p = 8;
  score += p;
  factors.push({
    factor: "No-show rate",
    value: `${(noShowRate * 100).toFixed(0)}%`,
    points: p,
  });

  // Treatment diversity
  p = 0;
  if (distinctTx >= 5) p = 20;
  else if (distinctTx >= 3) p = 10;
  else if (distinctTx >= 1) p = 3;
  score += p;
  factors.push({ factor: "Distinct treatments received", value: String(distinctTx), points: p });

  // Recency of last visit
  let daysSinceLast = null;
  if (stats.last_visit) {
    const diff = Date.now() - new Date(stats.last_visit).getTime();
    daysSinceLast = Math.floor(diff / (1000 * 60 * 60 * 24));
    p = 0;
    if (daysSinceLast <= 14) p = 15;
    else if (daysSinceLast <= 60) p = 8;
    score += p;
    factors.push({
      factor: "Days since last visit",
      value: String(daysSinceLast),
      points: p,
    });
  }

  score = Math.min(100, score);
  let band = "low";
  let plan = "Continue annual checkups and a balanced lifestyle.";
  if (score >= 60) {
    band = "high";
    plan =
      "Schedule a follow-up within 2 weeks; consider specialist referral and full medication review.";
  } else if (score >= 30) {
    band = "medium";
    plan =
      "Schedule a follow-up within 1–2 months; track vitals weekly and review treatment adherence.";
  }

  res.json({
    patientId: id,
    score,
    band,
    plan,
    factors,
    inputs: {
      total_appts: total,
      completed_appts: completed,
      no_shows: noShows,
      distinct_treatments: distinctTx,
      recent_90d_appts: recentAppts,
      recent_90d_completed: recentCompleted,
      last_visit: stats.last_visit,
      days_since_last_visit: daysSinceLast,
    },
  });
}));

// ---------- Generic error handler ----------

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

// ---------- Boot ----------

async function start() {
  for (let i = 0; i < 30; i++) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      break;
    } catch (err) {
      if (i === 29) throw err;
      console.log(`Waiting for MySQL... (${i + 1})`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  app.listen(PORT, () => {
    console.log(`UserServer running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
