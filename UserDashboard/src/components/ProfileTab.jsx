import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Button, Input, ErrorBanner } from "./ui";

export default function ProfileTab() {
  const [form, setForm] = useState({ Name: "", Email: "", DOB: "", Phone: "" });
  const [patientId, setPatientId] = useState(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { user, patient } = await api.get("/api/auth/me");
        setAccountEmail(user.email);
        if (patient) {
          setPatientId(patient.PatientID);
          setForm({
            Name: patient.Name || "",
            Email: patient.Email || "",
            DOB: patient.DOB?.slice(0, 10) || "",
            Phone: patient.Phone || "",
          });
        }
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      const updated = await api.put(`/api/patients/${patientId}`, {
        Name: form.Name,
        Email: form.Email,
        DOB: form.DOB || null,
        Phone: form.Phone || null,
      });
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...stored, name: updated.Name }));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!patientId) {
    return (
      <Card title="Profile">
        <p className="text-sm text-gray-600">
          Signed in as <strong>{accountEmail}</strong>. This account is not linked to a patient
          record (e.g. an admin account).
        </p>
      </Card>
    );
  }

  return (
    <div>
      <ErrorBanner message={error} />
      <Card title="Patient profile">
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-3 max-w-2xl">
          <Input label="Account email" value={accountEmail} disabled readOnly />
          <Input
            label="Name"
            required
            value={form.Name}
            onChange={(e) => setForm({ ...form, Name: e.target.value })}
          />
          <Input
            label="Email (contact)"
            type="email"
            required
            value={form.Email}
            onChange={(e) => setForm({ ...form, Email: e.target.value })}
          />
          <Input
            label="Date of birth"
            type="date"
            value={form.DOB}
            onChange={(e) => setForm({ ...form, DOB: e.target.value })}
          />
          <Input
            label="Phone"
            value={form.Phone}
            onChange={(e) => setForm({ ...form, Phone: e.target.value })}
          />
          <div className="flex items-end gap-2 md:col-span-2">
            <Button type="submit">Save</Button>
            {saved && <span className="text-sm text-emerald-600">Saved.</span>}
          </div>
        </form>
        <p className="text-xs text-gray-500 mt-3">
          Patient ID: #{patientId}. Used by the Risk Analysis report on the Overview tab.
        </p>
      </Card>
    </div>
  );
}
