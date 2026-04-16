import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Button, Input, Select, ErrorBanner, EmptyState } from "./ui";

export default function BillsTab({ user }) {
  const isAdmin = user.role === "admin";
  const [list, setList] = useState([]);
  const [appts, setAppts] = useState([]);
  const [form, setForm] = useState({ AppointmentID: "", Payment_Status: "Unpaid", Total_Amount: "" });
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ Payment_Status: "Unpaid", Total_Amount: "" });
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [b, a] = await Promise.all([api.get("/api/bills"), api.get("/api/appointments")]);
      setList(b);
      // only appointments without a bill yet
      setAppts(a.filter((x) => !x.Bill_ID));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        AppointmentID: Number(form.AppointmentID),
        Payment_Status: form.Payment_Status,
      };
      if (form.Total_Amount !== "") payload.Total_Amount = Number(form.Total_Amount);
      await api.post("/api/bills", payload);
      setForm({ AppointmentID: "", Payment_Status: "Unpaid", Total_Amount: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(b) {
    setEditingId(b.Bill_ID);
    setEdit({ Payment_Status: b.Payment_Status, Total_Amount: String(b.Total_Amount) });
  }

  async function saveEdit() {
    try {
      await api.put(`/api/bills/${editingId}`, {
        Payment_Status: edit.Payment_Status,
        Total_Amount: Number(edit.Total_Amount),
      });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function payBill(id) {
    if (!confirm("Mark this bill as paid?")) return;
    try {
      await api.post(`/api/bills/${id}/pay`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("Delete bill?")) return;
    try {
      await api.del(`/api/bills/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />

      {isAdmin && (
        <Card title="Generate bill from appointment">
          <form onSubmit={submit} className="grid md:grid-cols-3 gap-3">
            <Select
              label="Appointment"
              required
              value={form.AppointmentID}
              onChange={(e) => setForm({ ...form, AppointmentID: e.target.value })}
            >
              <option value="">Select an unbilled appointment</option>
              {appts.map((a) => (
                <option key={a.AppointmentID} value={a.AppointmentID}>
                  #{a.AppointmentID} — {a.Date?.slice(0, 10)} {a.Time?.slice(0, 5)} — {a.PatientName}
                </option>
              ))}
            </Select>
            <Select
              label="Payment status"
              value={form.Payment_Status}
              onChange={(e) => setForm({ ...form, Payment_Status: e.target.value })}
            >
              <option>Unpaid</option>
              <option>Partially Paid</option>
              <option>Paid</option>
            </Select>
            <Input
              label="Total amount (blank = sum of treatments)"
              type="number"
              step="0.01"
              value={form.Total_Amount}
              onChange={(e) => setForm({ ...form, Total_Amount: e.target.value })}
            />
            <div className="md:col-span-3">
              <Button type="submit">Generate bill</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Bills">
        {list.length === 0 ? (
          <EmptyState>No bills yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Bill ID</th>
                <th className="py-2">Appointment</th>
                {isAdmin && <th className="py-2">Patient</th>}
                <th className="py-2">Total</th>
                <th className="py-2">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.Bill_ID} className="border-b last:border-b-0">
                  <td className="py-2 text-gray-800">#{b.Bill_ID}</td>
                  <td className="py-2 text-gray-700">
                    #{b.AppointmentID} ({b.Date?.slice(0, 10)})
                  </td>
                  {isAdmin && <td className="py-2 text-gray-700">{b.PatientName}</td>}
                  <td className="py-2 text-gray-700">
                    {editingId === b.Bill_ID ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={edit.Total_Amount}
                        onChange={(e) => setEdit({ ...edit, Total_Amount: e.target.value })}
                      />
                    ) : (
                      `$${Number(b.Total_Amount).toFixed(2)}`
                    )}
                  </td>
                  <td className="py-2 text-gray-700">
                    {editingId === b.Bill_ID ? (
                      <Select
                        value={edit.Payment_Status}
                        onChange={(e) => setEdit({ ...edit, Payment_Status: e.target.value })}
                      >
                        <option>Unpaid</option>
                        <option>Partially Paid</option>
                        <option>Paid</option>
                      </Select>
                    ) : (
                      b.Payment_Status
                    )}
                  </td>
                  <td className="py-2 text-right space-x-2 whitespace-nowrap">
                    {isAdmin ? (
                      editingId === b.Bill_ID ? (
                        <>
                          <Button onClick={saveEdit}>Save</Button>
                          <Button variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" onClick={() => startEdit(b)}>
                            Edit
                          </Button>
                          <Button variant="danger" onClick={() => remove(b.Bill_ID)}>
                            Delete
                          </Button>
                        </>
                      )
                    ) : (
                      b.Payment_Status !== "Paid" && (
                        <Button onClick={() => payBill(b.Bill_ID)}>Pay</Button>
                      )
                    )}
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
