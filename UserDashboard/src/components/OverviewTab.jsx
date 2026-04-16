import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Button, ErrorBanner, EmptyState } from "./ui";

export default function OverviewTab({ user }) {
  const [risk, setRisk] = useState(null);
  const [doctorLoad, setDoctorLoad] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = user.role === "admin";
  const patientId = user.patientId;

  async function load() {
    setError("");
    try {
      if (patientId) {
        const r = await api.get(`/api/insights/risk/${patientId}`);
        setRisk(r);
      }
      if (isAdmin) {
        const d = await api.get("/api/reports/doctor-load");
        setDoctorLoad(d);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function recompute() {
    setLoading(true);
    await load();
    setLoading(false);
  }

  const bandColor = risk
    ? risk.band === "high"
      ? "text-red-600"
      : risk.band === "medium"
      ? "text-amber-600"
      : "text-emerald-600"
    : "";

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">
        Welcome back, {user.name || "User"}
      </h1>
      <p className="text-gray-500 mb-6">
        {isAdmin ? "Hospital admin dashboard." : "Your patient dashboard."}
      </p>

      <ErrorBanner message={error} />

      {patientId && (
        <Card
          title="Patient risk analysis"
          action={
            <Button variant="ghost" onClick={recompute} disabled={loading}>
              {loading ? "Recomputing..." : "Recompute"}
            </Button>
          }
        >
          {risk ? (
            <div>
              <div className="flex items-end gap-3 mb-1">
                <span className="text-5xl font-bold text-gray-900">{risk.score}</span>
                <span className={`text-xl font-semibold ${bandColor}`}>
                  {risk.band} risk
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Based on visit frequency, no-show rate, treatment diversity, and recency.
              </p>
              <div className="bg-teal-50 text-teal-800 text-sm rounded-lg px-4 py-3 mb-4">
                <span className="font-medium">Health plan: </span>
                {risk.plan}
              </div>
              {risk.factors.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2">Factor</th>
                      <th className="py-2">Value</th>
                      <th className="py-2 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risk.factors.map((f) => (
                      <tr key={f.factor} className="border-b last:border-b-0">
                        <td className="py-2 text-gray-700">{f.factor}</td>
                        <td className="py-2 text-gray-700">{f.value}</td>
                        <td className="py-2 text-right text-gray-700">{f.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <EmptyState>Loading...</EmptyState>
          )}
        </Card>
      )}

      {isAdmin && (
        <Card title="Doctor load (aggregate report)">
          {!doctorLoad || doctorLoad.length === 0 ? (
            <EmptyState>No data yet.</EmptyState>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Doctor</th>
                  <th className="py-2">Specialty</th>
                  <th className="py-2">Total appts</th>
                  <th className="py-2">Completed</th>
                  <th className="py-2">Billed total</th>
                </tr>
              </thead>
              <tbody>
                {doctorLoad.map((d) => (
                  <tr key={d.DoctorID} className="border-b last:border-b-0">
                    <td className="py-2 text-gray-800">{d.DoctorName}</td>
                    <td className="py-2 text-gray-700">{d.Specialty}</td>
                    <td className="py-2 text-gray-700">{d.appts}</td>
                    <td className="py-2 text-gray-700">{d.completed}</td>
                    <td className="py-2 text-gray-700">${Number(d.billed_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
