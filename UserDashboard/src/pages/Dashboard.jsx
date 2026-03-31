import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-teal-700">SmartHealth</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.name || user.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user.name || "User"}
        </h1>
        <p className="text-gray-500 mb-8">
          Here's your health dashboard overview.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500 mb-1">Heart Rate</p>
            <p className="text-2xl font-semibold text-gray-900">--</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500 mb-1">Blood Pressure</p>
            <p className="text-2xl font-semibold text-gray-900">--</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500 mb-1">Weight</p>
            <p className="text-2xl font-semibold text-gray-900">--</p>
          </div>
        </div>

        <div className="mt-12 bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-400">
            Your dashboard is ready. Start tracking your health data to see insights here.
          </p>
        </div>
      </main>
    </div>
  );
}
