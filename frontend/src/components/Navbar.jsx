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

        <Link
          to="/"
          className="absolute left-1/2 transform -translate-x-1/2 inline-flex items-center text-xl font-semibold tracking-tight"
          title="Campus Asset"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7l9-4 9 4-9 4-9-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10l9 4 9-4V7" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.5 12.5l4 4M16 14a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="ml-3">Campus Asset</span>
        </Link>

        

        {/* Right: actions (Profile only) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/profile")}
            //className="px-3 py-1.5 rounded border border-gray-200 text-gray-800 hover:bg-gray-100"
            className="px-3 py-1.5 rounded border border-sky-500 text-sky-600 hover:bg-sky-50"

            title="My Profile"
          >
            Profile
          </button>


          <button
            onClick={() => navigate("/manage-users")}
            //className="px-3 py-1.5 rounded border border-gray-200 text-gray-800 hover:bg-gray-100"
            className="px-3 py-1.5 rounded border border-blue-500 text-blue-600 hover:bg-blue-50"

          >
            Manage Users
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
                to="/masterdatamanager"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                Manage Master Data
              </NavLink>

              <NavLink
                to="/assets/new"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                Add Assets
              </NavLink>

              

              {/* NEW: Add Bulk Assets 
              <NavLink
                to="/bulkasset"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                Add Bulk Assets
              </NavLink>
              */}

              <NavLink
                to="/assets"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                View Inventory
              </NavLink>

              {/* NEW: View Bulk Inventory 
              <NavLink
                to="/bulk-inventory"
                className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ""}`}
                onClick={() => setOpen(false)}
              >
                View Bulk Inventory
              </NavLink>

              */}
              

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
                View Graphs
              </NavLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
