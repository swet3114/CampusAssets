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
            className="rounded-xl bg-indigo-500 text-white px-5 py-2.5 shadow-md hover:bg-indigo-600 hover:shadow-lg transition flex items-center gap-2"
            title="Manage master lists (institutes, departments, asset names)"
          >
            {/* Settings / Cog icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <ellipse cx="12" cy="5" rx="7" ry="3" strokeWidth="2" />
              <path strokeWidth="2" d="M5 5v6c0 1.66 3.134 3 7 3s7-1.34 7-3V5" />
              <path strokeWidth="2" d="M5 11v6c0 1.66 3.134 3 7 3s7-1.34 7-3v-6" />
            </svg>

            Manage Master Data
          </Link>


          <Link
            to="/assets/new"
            className="rounded-xl bg-indigo-500 text-white px-5 py-2.5 shadow-md hover:bg-indigo-600 hover:shadow-lg transition flex items-center gap-2"
            title="Create a new asset"
          >
            {/* Plus circle icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
            className="rounded-xl bg-sky-500 text-white px-5 py-2.5 shadow-md hover:bg-sky-600 hover:shadow-lg transition flex items-center gap-2"
            title="Scan a QR to view or update"
          >
            {/* QR code icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M4 7V5h3M20 7V5h-3M4 17v2h3M20 17v2h-3" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M9 9h3v3H9zM13 9h2v2h-2zM9 13h2v2H9zM13 13h3v3h-3z" />
            </svg>
            Scan QR
          </Link>
          <Link
            to="/assets"
            className="rounded-xl bg-gray-600 text-white px-5 py-2.5 shadow-md hover:bg-gray-700 hover:shadow-lg transition flex items-center gap-2"
            title="View and filter inventory"
          >
            {/* List/bulleted icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
            </svg>
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
            className="rounded-xl bg-amber-500 text-white px-5 py-2.5 shadow-md hover:bg-amber-600 hover:shadow-lg transition flex items-center gap-2"
            title="View system-wide audit history"
          >
            {/* Clock/history icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
              View Graphs
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
