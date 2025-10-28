import React, { useEffect, useState } from "react";

const API = "http://localhost:5000"; // Make sure this matches your backend
const MASTER_KEYS = [
  { key: "asset-names", label: "Asset Names" },
  { key: "institutes", label: "Institutes" },
  { key: "departments", label: "Departments" },
];

export default function AddValues() {
  // State for all master lists
  const [masterData, setMasterData] = useState({
    "asset-names": [],
    institutes: [],
    departments: [],
  });
  // Separate new value input per type
  const [newValues, setNewValues] = useState({
    "asset-names": "",
    institutes: "",
    departments: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchMasterList = async (k) => {
    try {
      const res = await fetch(`${API}/api/setup/${k}`);
      if (!res.ok) throw new Error("Failed to fetch " + k);
      const data = await res.json();
      setMasterData((prev) => ({ ...prev, [k]: data }));
    } catch (err) {
      setError(err.message);
    }
  };

 

  // Add new value
  const handleAdd = async (type) => {
    const value = newValues[type].trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/api/setup/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add value");
      setSuccess(`Added to ${type}`);
      setNewValues((prev) => ({ ...prev, [type]: "" }));
      fetchMasterList(type);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change
  const handleInputChange = (type, val) => {
    setNewValues((prev) => ({ ...prev, [type]: val }));
  };

  // Optionally implement delete handler
  const handleDelete = async (type, value) => {
    if (!window.confirm(`Delete '${value}' from ${type}?`)) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/api/setup/${type}/${encodeURIComponent(value)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete value");
      setSuccess(`Deleted '${value}'`);
      fetchMasterList(type);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 24, background: "#fff", borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
      <h2>Super Admin: Manage Dropdown Master Values</h2>
      <p style={{ marginTop: 14, marginBottom: 24, color: "#678" }}>Changes will reflect instantly on Add Asset forms.</p>
      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ color: "green", marginBottom: 12 }}>{success}</div>}
      {MASTER_KEYS.map(({ key, label }) => (
        <div key={key} style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 6 }}>{label}</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input
              style={{ flex: 1, padding: 6, fontSize: 16, borderRadius: 4, border: "1px solid #bbb" }}
              type="text"
              placeholder={`Add new ${label.toLowerCase().slice(0, -1)}...`}
              value={newValues[key]}
              onChange={e => handleInputChange(key, e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd(key)}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => handleAdd(key)}
              disabled={loading || !newValues[key].trim()}
              style={{ fontWeight: "bold", fontSize: 18, padding: "5px 14px", color: "#396", background: "#e7ffe5", border:"1px solid #8cd38c", borderRadius: 4, cursor: loading?'not-allowed':'pointer' }}
            >
              + Add
            </button>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {masterData[key].map((v) => (
              <li key={v} style={{ margin: 0, padding: "4px 0", display: "flex", alignItems: "center" }}>
                <span style={{ flex: 1 }}>{v}</span>
                <button
                  type="button"
                  style={{ color: "red", background: "none", border: "none", fontSize: 14, cursor: "pointer" }}
                  onClick={() => handleDelete(key, v)}
                  disabled={loading}
                  title={`Delete ${v}`}
                >
                  ×
                </button>
              </li>
            ))}
            {masterData[key].length === 0 && <li style={{ color: "#999" }}>No {label.toLowerCase()} yet</li>}
          </ul>
        </div>
      ))}
      {loading && <div style={{ color: "#009", marginTop: 12 }}>Please wait…</div>}
    </div>
  );
}
