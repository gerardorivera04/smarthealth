import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Button, Input, ErrorBanner, EmptyState } from "./ui";

const EMPTY = { Name: "", DOB: "", Email: "", Phone: "" };

export default function PatientsTab() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const data = await api.get("/api/patients" + (q ? `?q=${encodeURIComponent(q)}` : ""));
      setList(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(p) {
    setEditingId(p.PatientID);
    setForm({
      Name: p.Name,
      DOB: p.DOB?.slice(0, 10) || "",
      Email: p.Email,
      Phone: p.Phone || "",
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
      const payload = { ...form, DOB: form.DOB || null };
      if (editingId) await api.put(`/api/patients/${editingId}`, payload);
      else await api.post("/api/patients", payload);
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this patient (and all their appointments)?")) return;
    try {
      await api.del(`/api/patients/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />

      <Card title={editingId ? "Edit patient" : "Register patient"}>
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
          <Input
            label="Name"
            required
            value={form.Name}
            onChange={(e) => setForm({ ...form, Name: e.target.value })}
          />
          <Input
            label="Date of birth"
            type="date"
            value={form.DOB}
            onChange={(e) => setForm({ ...form, DOB: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.Email}
            onChange={(e) => setForm({ ...form, Email: e.target.value })}
          />
          <Input
            label="Phone"
            value={form.Phone}
            onChange={(e) => setForm({ ...form, Phone: e.target.value })}
          />
          <div className="flex items-end gap-2 md:col-span-2">
            <Button type="submit">{editingId ? "Save" : "Add patient"}</Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card
        title="Patients"
        action={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <Input
              placeholder="ID, name, phone, or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button variant="ghost" type="submit">
              Search
            </Button>
          </form>
        }
      >
        {list.length === 0 ? (
          <EmptyState>No patients found.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">ID</th>
                <th className="py-2">Name</th>
                <th className="py-2">DOB</th>
                <th className="py-2">Email</th>
                <th className="py-2">Phone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.PatientID} className="border-b last:border-b-0">
                  <td className="py-2 text-gray-700">#{p.PatientID}</td>
                  <td className="py-2 text-gray-800">{p.Name}</td>
                  <td className="py-2 text-gray-700">{p.DOB?.slice(0, 10) || "—"}</td>
                  <td className="py-2 text-gray-700">{p.Email}</td>
                  <td className="py-2 text-gray-700">{p.Phone || "—"}</td>
                  <td className="py-2 text-right space-x-2 whitespace-nowrap">
                    <Button variant="ghost" onClick={() => startEdit(p)}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => remove(p.PatientID)}>
                      Delete
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
