import { Fragment, useEffect, useState } from "react";
import { api } from "../api";
import { Card, Button, Input, Select, ErrorBanner, EmptyState } from "./ui";

const EMPTY = { Date: "", Time: "", Status: "Scheduled", doctor_id: "", PatientID: "" };

export default function AppointmentsTab({ user }) {
  const isAdmin = user.role === "admin";
  const [list, setList] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [apptTreatments, setApptTreatments] = useState([]);
  const [addCode, setAddCode] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  async function load() {
    setError("");
    try {
      const qs = filterStatus ? `?status=${encodeURIComponent(filterStatus)}` : "";
      const [a, d, t] = await Promise.all([
        api.get("/api/appointments" + qs),
        api.get("/api/doctors"),
        api.get("/api/treatments"),
      ]);
      setList(a);
      setDoctors(d);
      setTreatments(t);
      if (isAdmin) {
        const p = await api.get("/api/patients");
        setPatients(p);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [filterStatus]);

  function startEdit(a) {
    setEditingId(a.AppointmentID);
    setForm({
      Date: a.Date?.slice(0, 10) || "",
      Time: (a.Time || "").slice(0, 5),
      Status: a.Status,
      doctor_id: String(a.DoctorID),
      PatientID: String(a.PatientID),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        Date: form.Date,
        Time: form.Time.length === 5 ? form.Time + ":00" : form.Time,
        Status: form.Status,
        doctor_id: Number(form.doctor_id),
      };
      if (isAdmin && form.PatientID) payload.PatientID = Number(form.PatientID);
      if (editingId) await api.put(`/api/appointments/${editingId}`, payload);
      else await api.post("/api/appointments", payload);
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("Cancel this appointment?")) return;
    try {
      await api.del(`/api/appointments/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleExpand(id) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    try {
      const data = await api.get(`/api/appointments/${id}/treatments`);
      setApptTreatments(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addTreatment(id) {
    if (!addCode) return;
    try {
      await api.post(`/api/appointments/${id}/treatments`, { TreatmentCode: addCode });
      const data = await api.get(`/api/appointments/${id}/treatments`);
      setApptTreatments(data);
      setAddCode("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeTreatment(id, code) {
    try {
      await api.del(`/api/appointments/${id}/treatments/${code}`);
      const data = await api.get(`/api/appointments/${id}/treatments`);
      setApptTreatments(data);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />

      <Card title={editingId ? "Edit appointment" : "Book appointment"}>
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
          {isAdmin && !editingId && (
            <Select
              label="Patient"
              required
              value={form.PatientID}
              onChange={(e) => setForm({ ...form, PatientID: e.target.value })}
            >
              <option value="">Select a patient</option>
              {patients.map((p) => (
                <option key={p.PatientID} value={p.PatientID}>
                  {p.Name} (#{p.PatientID})
                </option>
              ))}
            </Select>
          )}
          <Select
            label="Doctor"
            required
            value={form.doctor_id}
            onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}
          >
            <option value="">Select a doctor</option>
            {doctors.map((d) => (
              <option key={d.DoctorID} value={d.DoctorID}>
                {d.Name} — {d.Specialty}
              </option>
            ))}
          </Select>
          <Input
            label="Date"
            type="date"
            required
            value={form.Date}
            onChange={(e) => setForm({ ...form, Date: e.target.value })}
          />
          <Input
            label="Time"
            type="time"
            required
            value={form.Time}
            onChange={(e) => setForm({ ...form, Time: e.target.value })}
          />
          <Select
            label="Status"
            value={form.Status}
            onChange={(e) => setForm({ ...form, Status: e.target.value })}
          >
            <option>Scheduled</option>
            <option>Completed</option>
            <option>Cancelled</option>
            <option>No-show</option>
          </Select>
          <div className="flex items-end gap-2">
            <Button type="submit">{editingId ? "Save changes" : "Book"}</Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card
        title="Appointments"
        action={
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option>Scheduled</option>
            <option>Completed</option>
            <option>Cancelled</option>
            <option>No-show</option>
          </Select>
        }
      >
        {list.length === 0 ? (
          <EmptyState>No appointments.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">When</th>
                <th className="py-2">Doctor</th>
                {isAdmin && <th className="py-2">Patient</th>}
                <th className="py-2">Status</th>
                <th className="py-2">Bill</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <Fragment key={a.AppointmentID}>
                  <tr className="border-b last:border-b-0">
                    <td className="py-2 text-gray-700">
                      {a.Date?.slice(0, 10)} {a.Time?.slice(0, 5)}
                    </td>
                    <td className="py-2 text-gray-800">
                      {a.DoctorName}{" "}
                      <span className="text-gray-500 text-xs">({a.DoctorSpecialty})</span>
                    </td>
                    {isAdmin && (
                      <td className="py-2 text-gray-700">
                        {a.PatientName}{" "}
                        <span className="text-gray-500 text-xs">#{a.PatientID}</span>
                      </td>
                    )}
                    <td className="py-2 text-gray-700">{a.Status}</td>
                    <td className="py-2 text-gray-700">
                      {a.Bill_ID
                        ? `$${Number(a.Total_Amount).toFixed(2)} (${a.Payment_Status})`
                        : "—"}
                    </td>
                    <td className="py-2 text-right space-x-2 whitespace-nowrap">
                      <Button variant="ghost" onClick={() => toggleExpand(a.AppointmentID)}>
                        {expanded === a.AppointmentID ? "Hide" : "Treatments"}
                      </Button>
                      <Button variant="ghost" onClick={() => startEdit(a)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => remove(a.AppointmentID)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                  {expanded === a.AppointmentID && (
                    <tr className="bg-gray-50">
                      <td colSpan={isAdmin ? 6 : 5} className="px-4 py-3">
                        <div className="text-xs uppercase text-gray-500 mb-1">
                          Treatments on this appointment
                        </div>
                        {apptTreatments.length === 0 ? (
                          <p className="text-sm text-gray-400 italic mb-2">
                            None recorded.
                          </p>
                        ) : (
                          <ul className="text-sm mb-2">
                            {apptTreatments.map((t) => (
                              <li
                                key={t.TreatmentCode}
                                className="flex items-center justify-between border-b last:border-b-0 py-1"
                              >
                                <span>
                                  <span className="font-mono text-gray-700">
                                    {t.TreatmentCode}
                                  </span>{" "}
                                  — {t.Description} (${Number(t.Cost).toFixed(2)})
                                </span>
                                <button
                                  className="text-xs text-red-600 hover:underline"
                                  onClick={() =>
                                    removeTreatment(a.AppointmentID, t.TreatmentCode)
                                  }
                                >
                                  remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex gap-2">
                          <Select value={addCode} onChange={(e) => setAddCode(e.target.value)}>
                            <option value="">Add treatment...</option>
                            {treatments.map((t) => (
                              <option key={t.TreatmentCode} value={t.TreatmentCode}>
                                {t.TreatmentCode} — {t.Description}
                              </option>
                            ))}
                          </Select>
                          <Button onClick={() => addTreatment(a.AppointmentID)}>Add</Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
