import React, { useEffect, useMemo, useState } from "react";

const API = process.env.REACT_APP_BACKEND_PORT || "http://localhost:5000";
const ROLES = ["Super_Admin", "Admin", "Faculty", "Verifier"];

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [resetPwId, setResetPwId] = useState(null);
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/users${roleFilter ? `?role=${roleFilter}` : ""}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setUsers(Array.isArray(data.users) ? data.users : []);
        const countObj = {};
        (data.counts || []).forEach((c) => {
          countObj[c._id] = c.count;
        });
        setCounts(countObj);
      } else {
        setError(data.error || "Failed to load users");
      }
    } catch (err) {
      setError("Network error");
    }
    setLoading(false);
  }

  async function deleteUser(userId) {
    if (!window.confirm("Delete this user?")) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) fetchUsers();
      else setError("Could not delete user");
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  async function resetPassword(userId, pw) {
    if (pw.trim().length < 6) {
      setError("Password must be at least 6 chars");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/users/${userId}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.success) {
        setResetPwId(null);
        setNewPw("");
      } else {
        setError("Failed to reset password");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  const filtered = roleFilter ? users.filter((u) => u.role === roleFilter) : users;

  // Styles
  const actionBtn = {
    padding: "6px 16px",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    background: "#f87171",
    color: "#fff",
    marginRight: 10,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
    transition: "background 0.17s",
  };
  const resetBtn = {
    padding: "6px 16px",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    background: "#3b82f6",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
    transition: "background 0.17s",
  };
  const saveBtn = {
    padding: "3px 14px",
    border: "none",
    borderRadius: "5px",
    fontWeight: 600,
    background: "#16a34a",
    color: "#fff",
    marginRight: 5,
    cursor: "pointer",
  };
  const cancelBtn = {
    padding: "3px 10px",
    border: "none",
    borderRadius: "5px",
    fontWeight: 600,
    background: "#f3f4f6",
    color: "#374151",
    marginLeft: 2,
    cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Manage Users</h2>

      {/* Role filtered counts */}
      <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
        {/* All FIRST */}
        <button
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: !roleFilter ? "#eff6ff" : "#fff",
            fontWeight: 600,
            cursor: "pointer",
            color: "#374151",
          }}
          onClick={() => setRoleFilter("")}
        >
          All ({users.length})
        </button>

        {/* Then the role pills in preferred order */}
        {ROLES.map((role) => (
          <button
            key={role}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: roleFilter === role ? "2px solid #3b82f6" : "1px solid #e5e7eb",
              background: roleFilter === role ? "#eff6ff" : "#fff",
              fontWeight: 600,
              cursor: "pointer",
              color: "#374151",
            }}
            onClick={() => setRoleFilter(roleFilter === role ? "" : role)}
          >
            {role.replace("_", " ")} ({counts[role] || 0})
          </button>
        ))}
      </div>

      {error && <div style={{ color: "#dc2626", marginBottom: 16 }}>{error}</div>}
      {loading && <div style={{ color: "#6366f1", marginBottom: 18 }}>Loading...</div>}

      {/* Users Table */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={{ padding: 10, fontWeight: 600, textAlign: "left" }}>Employee ID</th>
              <th style={{ padding: 10, fontWeight: 600, textAlign: "left" }}>Name</th>
              <th style={{ padding: 10, fontWeight: 600, textAlign: "left" }}>Role</th>
              <th style={{ padding: 10, fontWeight: 600, textAlign: "left" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(roleFilter ? users.filter((u) => u.role === roleFilter) : users).map((u) => (
              <tr key={u._id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 9, textAlign: "left" }}>{u.emp_id || "-"}</td>
                <td style={{ padding: 9, textAlign: "left" }}>{u.name || "-"}</td>
                <td style={{ padding: 9, textAlign: "left" }}>{u.role}</td>
                <td style={{ padding: 9, textAlign: "left" }}>
                  <button
                    style={actionBtn}
                    title="Delete"
                    onClick={() => deleteUser(u._id)}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#dc2626")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#f87171")}
                  >
                    Delete
                  </button>
                  {resetPwId !== u._id ? (
                    <button
                      style={resetBtn}
                      onClick={() => {
                        setResetPwId(u._id);
                        setNewPw("");
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "#2563eb")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "#3b82f6")}
                    >
                      Reset Password
                    </button>
                  ) : (
                    <span>
                      <input
                        type="text"
                        value={newPw}
                        placeholder="New password"
                        style={{ fontSize: 13, padding: "3px 8px", borderRadius: 6, border: "1px solid #e5e7eb", marginRight: 7 }}
                        onChange={(e) => setNewPw(e.target.value)}
                      />
                      <button style={saveBtn} onClick={() => resetPassword(u._id, newPw)}>
                        Save
                      </button>
                      <button style={cancelBtn} onClick={() => setResetPwId(null)}>
                        Cancel
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 18, color: "#9ca3af" }}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
