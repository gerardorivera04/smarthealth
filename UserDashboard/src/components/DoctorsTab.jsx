import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Button, Input, ErrorBanner, EmptyState } from "./ui";

const EMPTY = { Name: "", Specialty: "", Department: "" };

export default function DoctorsTab({ user }) {
  const isAdmin = user.role === "admin";
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (department) params.set("department", department);
      const data = await api.get("/api/doctors" + (params.toString() ? `?${params}` : ""));
      setList(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(d) {
    setEditingId(d.DoctorID);
    setForm({ Name: d.Name, Specialty: d.Specialty, Department: d.Department || "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) await api.put(`/api/doctors/${editingId}`, form);
      else await api.post("/api/doctors", form);
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this doctor?")) return;
    try {
      await api.del(`/api/doctors/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />

      {isAdmin && (
        <Card title={editingId ? "Edit doctor" : "Add doctor"}>
          <form onSubmit={submit} className="grid md:grid-cols-3 gap-3">
            <Input
              label="Name"
              required
              value={form.Name}
              onChange={(e) => setForm({ ...form, Name: e.target.value })}
            />
            <Input
              label="Specialty"
              required
              value={form.Specialty}
              onChange={(e) => setForm({ ...form, Specialty: e.target.value })}
            />
            <Input
              label="Department"
              value={form.Department}
              onChange={(e) => setForm({ ...form, Department: e.target.value })}
            />
            <div className="flex items-end gap-2 md:col-span-3">
              <Button type="submit">{editingId ? "Save" : "Add doctor"}</Button>
              {editingId && (
                <Button type="button" variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Doctors"
        action={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <Input placeholder="Name" value={q} onChange={(e) => setQ(e.target.value)} />
            <Input
              placeholder="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <Button variant="ghost" type="submit">
              Search
            </Button>
          </form>
        }
      >
        {list.length === 0 ? (
          <EmptyState>No doctors found.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">ID</th>
                <th className="py-2">Name</th>
                <th className="py-2">Specialty</th>
                <th className="py-2">Department</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.DoctorID} className="border-b last:border-b-0">
                  <td className="py-2 text-gray-700">#{d.DoctorID}</td>
                  <td className="py-2 text-gray-800">{d.Name}</td>
                  <td className="py-2 text-gray-700">{d.Specialty}</td>
                  <td className="py-2 text-gray-700">{d.Department || "—"}</td>
                  {isAdmin && (
                    <td className="py-2 text-right space-x-2 whitespace-nowrap">
                      <Button variant="ghost" onClick={() => startEdit(d)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => remove(d.DoctorID)}>
                        Delete
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
