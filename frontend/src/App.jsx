// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import AssetForm from "./components/AssetForm";
import Assets from "./components/Assets";
import Scan from "./components/Scan";
import Home from "./components/Home";
import Protected from "./middle/Protected";
import RoleGate from "./middle/RoleGate";
import Profile from "./components/Profile";
// import BulkAddAssets from "./components/BulkAddAssets";
// import BulkInventory from "./components/BulkInventory";
import GraphView from "./components/GraphView";
import MasterDataManager from "./components/MasterDataManager";
import ManageUser from "./components/ManageUser";

// NEW: History Logs page (create this file)
import HistoryLogs from "./components/HistoryLogs";

function ProtectedLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected + role-gated */}
        <Route
          path="/"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin", "Faculty", "Verifier"]}>
                  <Home />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />

        <Route
          path="/home"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin", "Faculty", "Verifier"]}>
                  <Home />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />

        <Route
          path="/assets"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin", "Faculty"]}>
                  <Assets />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />

        <Route
          path="/masterdatamanager"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin"]}>
                  <MasterDataManager />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />

        <Route
          path="/assets/new"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin"]}>
                  <AssetForm />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />

        <Route
          path="/manage-users"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin"]}>
                  <ManageUser />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />

        {/* <Route
          path="/bulkasset"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin"]}>
                  <BulkAddAssets />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        /> */}

        {/* <Route
          path="/bulk-inventory"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin", "Faculty"]}>
                  <BulkInventory />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        /> */}

        <Route
          path="/scan"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin", "Verifier"]}>
                  <Scan />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />

        <Route
          path="/profile"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin", "Faculty", "Verifier"]}>
                  <Profile />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />

        {/* NEW: History Logs (Super Admin only) */}
        <Route
          path="/admin/history"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin"]}>
                  <HistoryLogs />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />


        <Route
          path="/graph-view"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin"]}>
                  <GraphView />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
