import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import OverviewTab from "../components/OverviewTab";
import AppointmentsTab from "../components/AppointmentsTab";
import TreatmentsTab from "../components/TreatmentsTab";
import BillsTab from "../components/BillsTab";
import DoctorsTab from "../components/DoctorsTab";
import NursesTab from "../components/NursesTab";
import PatientsTab from "../components/PatientsTab";
import StaffingTab from "../components/StaffingTab";
import ProfileTab from "../components/ProfileTab";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.role === "admin";

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "appointments", label: "Appointments" },
    { id: "bills", label: "Bills" },
    { id: "doctors", label: "Doctors" },
    { id: "nurses", label: "Nurses" },
    { id: "treatments", label: "Treatments" },
    ...(isAdmin ? [{ id: "patients", label: "Patients" }] : []),
    ...(isAdmin ? [{ id: "staffing", label: "Staffing" }] : []),
    { id: "profile", label: "Profile" },
  ];

  const tabIds = TABS.map((t) => t.id);
  const hashTab = location.hash.replace("#", "");
  const initialTab = tabIds.includes(hashTab) ? hashTab : "overview";
  const [tab, setTab] = useState(initialTab);

  function changeTab(id) {
    setTab(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  useEffect(() => {
    if (!location.hash) {
      window.history.replaceState(null, "", `#${tab}`);
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-teal-700">SmartHealth HMS</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.name || user.email}
              {isAdmin && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                  admin
                </span>
              )}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-6 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => changeTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "text-teal-700 border-teal-600"
                  : "text-gray-500 border-transparent hover:text-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {tab === "overview" && <OverviewTab user={user} />}
        {tab === "appointments" && <AppointmentsTab user={user} />}
        {tab === "treatments" && <TreatmentsTab user={user} />}
        {tab === "bills" && <BillsTab user={user} />}
        {tab === "doctors" && <DoctorsTab user={user} />}
        {tab === "nurses" && <NursesTab user={user} />}
        {tab === "patients" && isAdmin && <PatientsTab />}
        {tab === "staffing" && isAdmin && <StaffingTab />}
        {tab === "profile" && <ProfileTab />}
      </main>
    </div>
  );
}
