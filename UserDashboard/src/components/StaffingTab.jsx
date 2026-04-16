import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Button, Select, ErrorBanner, EmptyState } from "./ui";

// Admin tab to manage the M:N relationship tables: Administers and Assists.
export default function StaffingTab() {
  const [administers, setAdministers] = useState([]);
  const [assists, setAssists] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [adForm, setAdForm] = useState({ TreatmentCode: "", DoctorID: "" });
  const [asForm, setAsForm] = useState({ NurseID: "", DoctorID: "" });
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [a1, a2, d, n, t] = await Promise.all([
        api.get("/api/administers"),
        api.get("/api/assists"),
        api.get("/api/doctors"),
        api.get("/api/nurses"),
        api.get("/api/treatments"),
      ]);
      setAdministers(a1);
      setAssists(a2);
      setDoctors(d);
      setNurses(n);
      setTreatments(t);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addAdministers(e) {
    e.preventDefault();
    try {
      await api.post("/api/administers", {
        TreatmentCode: adForm.TreatmentCode,
        DoctorID: Number(adForm.DoctorID),
      });
      setAdForm({ TreatmentCode: "", DoctorID: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function delAdministers(code, doctorId) {
    try {
      await api.del(`/api/administers/${code}/${doctorId}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addAssists(e) {
    e.preventDefault();
    try {
      await api.post("/api/assists", {
        NurseID: Number(asForm.NurseID),
        DoctorID: Number(asForm.DoctorID),
      });
      setAsForm({ NurseID: "", DoctorID: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function delAssists(nurseId, doctorId) {
    try {
      await api.del(`/api/assists/${nurseId}/${doctorId}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />

      <Card title="Administers — which doctors give which treatments">
        <form onSubmit={addAdministers} className="grid md:grid-cols-3 gap-3 mb-4">
          <Select
            label="Treatment"
            required
            value={adForm.TreatmentCode}
            onChange={(e) => setAdForm({ ...adForm, TreatmentCode: e.target.value })}
          >
            <option value="">Select treatment</option>
            {treatments.map((t) => (
              <option key={t.TreatmentCode} value={t.TreatmentCode}>
                {t.TreatmentCode} — {t.Description}
              </option>
            ))}
          </Select>
          <Select
            label="Doctor"
            required
            value={adForm.DoctorID}
            onChange={(e) => setAdForm({ ...adForm, DoctorID: e.target.value })}
          >
            <option value="">Select doctor</option>
            {doctors.map((d) => (
              <option key={d.DoctorID} value={d.DoctorID}>
                {d.Name} — {d.Specialty}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <Button type="submit">Link</Button>
          </div>
        </form>

        {administers.length === 0 ? (
          <EmptyState>No links yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Treatment</th>
                <th className="py-2">Doctor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {administers.map((a) => (
                <tr key={`${a.TreatmentCode}-${a.DoctorID}`} className="border-b last:border-b-0">
                  <td className="py-2 text-gray-700">
                    <span className="font-mono">{a.TreatmentCode}</span> — {a.Description}
                  </td>
                  <td className="py-2 text-gray-700">
                    {a.DoctorName} ({a.Specialty})
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      variant="danger"
                      onClick={() => delAdministers(a.TreatmentCode, a.DoctorID)}
                    >
                      Unlink
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Assists — which nurses assist which doctors">
        <form onSubmit={addAssists} className="grid md:grid-cols-3 gap-3 mb-4">
          <Select
            label="Nurse"
            required
            value={asForm.NurseID}
            onChange={(e) => setAsForm({ ...asForm, NurseID: e.target.value })}
          >
            <option value="">Select nurse</option>
            {nurses.map((n) => (
              <option key={n.NurseID} value={n.NurseID}>
                {n.Name} ({n.Department || "—"})
              </option>
            ))}
          </Select>
          <Select
            label="Doctor"
            required
            value={asForm.DoctorID}
            onChange={(e) => setAsForm({ ...asForm, DoctorID: e.target.value })}
          >
            <option value="">Select doctor</option>
            {doctors.map((d) => (
              <option key={d.DoctorID} value={d.DoctorID}>
                {d.Name} — {d.Specialty}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <Button type="submit">Link</Button>
          </div>
        </form>

        {assists.length === 0 ? (
          <EmptyState>No links yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Nurse</th>
                <th className="py-2">Doctor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assists.map((a) => (
                <tr key={`${a.NurseID}-${a.DoctorID}`} className="border-b last:border-b-0">
                  <td className="py-2 text-gray-700">
                    {a.NurseName} ({a.Department || "—"})
                  </td>
                  <td className="py-2 text-gray-700">
                    {a.DoctorName} ({a.Specialty})
                  </td>
                  <td className="py-2 text-right">
                    <Button variant="danger" onClick={() => delAssists(a.NurseID, a.DoctorID)}>
                      Unlink
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
