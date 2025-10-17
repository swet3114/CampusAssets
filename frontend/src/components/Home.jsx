// src/pages/Home.jsx
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="relative overflow-hidden min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-6 py-16 md:py-24 text-center">
        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
          Welcome to <span className="text-indigo-600">CampusAssets</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
          Register assets, scan and verify with QR codes, and maintain accurate
          inventory across departments efficiently.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
          {/* Add Single Asset */}
          <Link
            to="/assets/new"
            className="rounded bg-indigo-600 text-white px-5 py-2.5 hover:bg-indigo-700 transition"
          >
            Add Single Asset
          </Link>

          {/* Add Bulk Assets */}
          <Link
            to="/bulkasset"
            className="rounded bg-green-600 text-white px-5 py-2.5 hover:bg-green-700 transition"
          >
            Add Bulk Assets
          </Link>

          {/* Scan QR */}
          <Link
            to="/scan"
            className="rounded bg-gray-900 text-white px-5 py-2.5 hover:bg-black transition"
          >
            Scan QR
          </Link>

          {/* View Inventory */}
          <Link
            to="/assets"
            className="rounded bg-white border px-5 py-2.5 hover:bg-gray-50 transition"
          >
            View Inventory
          </Link>

          {/* View Bulk Inventory */}
          <Link
            to="/bulk-inventory"
            className="rounded bg-white border px-5 py-2.5 hover:bg-gray-50 transition"
          >
            View Bulk Inventory
          </Link>
        </div>
      </section>

      {/* Info Section */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-semibold text-center mb-10 text-gray-800">
          Manage your Campus Assets with Ease
        </h2>

        {/* Info Cards */}
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
    </div>
  );
}

/* Reusable Info Card Component */
function Card({ title, body }) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md transition">
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{body}</p>
    </div>
  );
}
