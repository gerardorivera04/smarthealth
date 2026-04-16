import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Button, Input, ErrorBanner, EmptyState } from "./ui";

const EMPTY = { TreatmentCode: "", Description: "", Cost: "" };

export default function TreatmentsTab({ user }) {
  const isAdmin = user.role === "admin";
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingCode, setEditingCode] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const data = await api.get("/api/treatments" + (q ? `?q=${encodeURIComponent(q)}` : ""));
      setList(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(t) {
    setEditingCode(t.TreatmentCode);
    setForm({ TreatmentCode: t.TreatmentCode, Description: t.Description, Cost: String(t.Cost) });
  }

  function cancelEdit() {
    setEditingCode(null);
    setForm(EMPTY);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        TreatmentCode: form.TreatmentCode,
        Description: form.Description,
        Cost: Number(form.Cost) || 0,
      };
      if (editingCode) {
        await api.put(`/api/treatments/${editingCode}`, {
          Description: payload.Description,
          Cost: payload.Cost,
        });
      } else {
        await api.post("/api/treatments", payload);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(code) {
    if (!confirm(`Delete treatment ${code}?`)) return;
    try {
      await api.del(`/api/treatments/${code}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />

      {isAdmin && (
        <Card title={editingCode ? `Edit treatment ${editingCode}` : "Add treatment"}>
          <form onSubmit={submit} className="grid md:grid-cols-3 gap-3">
            <Input
              label="Code"
              required
              disabled={!!editingCode}
              value={form.TreatmentCode}
              onChange={(e) => setForm({ ...form, TreatmentCode: e.target.value })}
            />
            <Input
              label="Description"
              required
              value={form.Description}
              onChange={(e) => setForm({ ...form, Description: e.target.value })}
            />
            <Input
              label="Cost"
              type="number"
              step="0.01"
              required
              value={form.Cost}
              onChange={(e) => setForm({ ...form, Cost: e.target.value })}
            />
            <div className="flex items-end gap-2 md:col-span-3">
              <Button type="submit">{editingCode ? "Save" : "Add"}</Button>
              {editingCode && (
                <Button type="button" variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Treatment catalog"
        action={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <Input
              placeholder="Search code / description"
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
          <EmptyState>No treatments found.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Code</th>
                <th className="py-2">Description</th>
                <th className="py-2">Cost</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.TreatmentCode} className="border-b last:border-b-0">
                  <td className="py-2 font-mono text-gray-800">{t.TreatmentCode}</td>
                  <td className="py-2 text-gray-700">{t.Description}</td>
                  <td className="py-2 text-gray-700">${Number(t.Cost).toFixed(2)}</td>
                  {isAdmin && (
                    <td className="py-2 text-right space-x-2 whitespace-nowrap">
                      <Button variant="ghost" onClick={() => startEdit(t)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => remove(t.TreatmentCode)}>
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
