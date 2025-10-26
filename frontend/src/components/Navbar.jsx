// src/components/Navbar.jsx
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const linkBase = "block px-4 py-2 rounded hover:bg-gray-100 text-gray-800";
  const activeClass = "bg-gray-100 font-medium";

  return (
    <header className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Left: burger */}
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="p-2 rounded hover:bg-gray-100"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-gray-800"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Center: brand */}
        <Link to="/" className="text-xl font-semibold tracking-tight">
          campusAssets
        </Link>

        {/* Right: actions (Profile only) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/profile")}
            className="px-3 py-1.5 rounded border border-gray-200 text-gray-800 hover:bg-gray-100"
            title="My Profile"
          >
            Profile
          </button>
        </div>
      </div>

      {/* Drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-black/30" />
          <nav
            className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold">Menu</div>
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="p-2 rounded hover:bg-gray-100"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6 text-gray-800"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-1">
              <NavLink
                to="/home"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                Home
              </NavLink>

              <NavLink
                to="/profile"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                Profile
              </NavLink>

              <NavLink
                to="/assets/new"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                Add Assets
              </NavLink>

              {/* NEW: Add Bulk Assets */}
              <NavLink
                to="/bulkasset"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                Add Bulk Assets
              </NavLink>

              <NavLink
                to="/assets"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                View Inventory
              </NavLink>

              {/* NEW: View Bulk Inventory */}
              <NavLink
                to="/bulk-inventory"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                View Bulk Inventory
              </NavLink>
              

              <NavLink
                to="/scan"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                Scan QR
              </NavLink>
              <NavLink
                to="/admin/history"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                History Logs
              </NavLink>
              <NavLink
                to="/graph-view"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                See Graphs
              </NavLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
