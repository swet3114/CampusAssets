import { Link } from "react-router-dom";
import Chatbot from "../components/Chatbot";

function getCurrentRole() {
  try {
    const raw = localStorage.getItem("currentUser");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.role || null;
  } catch {
    return null;
  }
}

export default function Home() {
  const role = getCurrentRole(); // "Super_Admin" | "Admin" | "Faculty" | "Verifier" | null

  // Check if user is Super_Admin or Admin for Graph View access
  const canViewGraphs = role === "Super_Admin" || role === "Admin";

  return (
    <div className="relative overflow-hidden min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-6 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-indigo-500 to-blue-600 bg-clip-text text-transparent">
            campusAssets
          </span>
        </h1>

        <p className="mt-4 text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Register assets, scan and verify them instantly with QR codes, and maintain
          an accurate, up-to-date inventory across departments — effortlessly.
        </p>

        <div className="absolute inset-x-0 -z-10 h-[500px] bg-gradient-to-b from-indigo-50 to-transparent blur-3xl opacity-40"></div>

        {/* Action Buttons */}
        <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">


          <Link
            to="/masterdatamanager"
            className="rounded-xl bg-indigo-500 text-white px-5 py-2.5 shadow-md hover:bg-indigo-600 hover:shadow-lg transition"
          >
            Manage Master Data
          </Link>

          <Link
            to="/assets/new"
            className="rounded-xl bg-indigo-500 text-white px-5 py-2.5 shadow-md hover:bg-indigo-600 hover:shadow-lg transition"
          >
            Add Asset
          </Link>


          {/*
          <Link
            to="/bulkasset"
            className="rounded-xl bg-emerald-500 text-white px-5 py-2.5 shadow-md hover:bg-emerald-600 hover:shadow-lg transition"
          >
            Add Bulk Assets
          </Link>
          */}


          <Link
            to="/scan"
            className="rounded-xl bg-sky-500 text-white px-5 py-2.5 shadow-md hover:bg-sky-600 hover:shadow-lg transition"
          >
            Scan QR
          </Link>
          <Link
            to="/assets"
            className="rounded-xl bg-gray-600 text-white px-5 py-2.5 shadow-md hover:bg-gray-700 hover:shadow-lg transition"
          >
            View Inventory
          </Link>


          {/*
          <Link
            to="/bulk-inventory"
            className="rounded-xl bg-slate-600 text-white px-5 py-2.5 shadow-md hover:bg-slate-700 hover:shadow-lg transition"
          >
            View Bulk Inventory
          </Link>
          */}

          <Link
            to="/admin/history"
            className="rounded-xl bg-amber-500 text-white px-5 py-2.5 shadow-md hover:bg-amber-600 hover:shadow-lg transition"
            title="View system-wide audit history"
          >
            History Logs
          </Link>

          {/* See Graphs Button - Only visible for Super_Admin and Admin */}
          
            <Link
              to="/graph-view"
              className="rounded-xl bg-purple-500 text-white px-5 py-2.5 shadow-md hover:bg-purple-600 hover:shadow-lg transition flex items-center gap-2"
              title="View asset analytics and graphs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              See Graphs
            </Link>
          
        </div>
      </section>

      {/* Info Section */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-semibold text-center mb-10 text-gray-800">
          Manage your Campus Assets with Ease
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            title="Add Single Asset"
            body="Register individual assets with detailed information such as name, model, department, and QR code generation."
          />
          <Card
            title="Bulk Add Assets"
            body="Quickly upload or generate multiple asset entries in bulk. Ideal for departments with large inventories."
          />
          <Card
            title="Verify & Track"
            body="Use QR scanning to instantly verify asset details, check ownership, and keep your records up to date."
          />
        </div>
      </section>

      {/* Fixed-position chatbot icon and panel */}
      <Chatbot />
      <div className="fixed bottom-24 right-6 bg-white border border-indigo-200 shadow-lg rounded-xl px-2 py-1 flex items-center gap-1 animate-bounce-slow">
        <span className="text-indigo-600 text-sm">💡</span>
        <p className="text-[10px] text-gray-800">
          Need help? <span className="font-semibold text-indigo-600">Ask our Chatbot!</span>
        </p>
      </div>
    </div>
  );
}

function Card({ title, body }) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md transition">
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{body}</p>
    </div>
  );
}
