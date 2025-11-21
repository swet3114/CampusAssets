import React, { useEffect, useState } from "react";

const API = process.env.REACT_APP_BACKEND_PORT || "http://localhost:5000";

const MASTER_KEYS = [
  { key: "institutes", label: "Institutes" },
  { key: "departments", label: "Departments" },
  // asset-names handled specially as a paired section
];

export default function AddValues() {
  const [masterData, setMasterData] = useState({
    "asset-names": [],   // array of strings like "Mouse:Electronics"
    institutes: [],
    departments: [],
  });

  // Composed inputs for asset + category
  const [assetPair, setAssetPair] = useState({ name: "", category: "" });

  // Inputs for other lists
  const [newValues, setNewValues] = useState({
    institutes: "",
    departments: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchMasterList = async (k) => {
    try {
      const res = await fetch(`${API}/api/setup/${k}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch " + k);
      const data = await res.json();
      setMasterData((prev) => ({ ...prev, [k]: data }));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    ["asset-names", ...MASTER_KEYS.map((m) => m.key)].forEach(fetchMasterList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add for institutes/departments
  const handleAddGeneric = async (type) => {
    const value = (newValues[type] || "").trim();
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

  // Add Asset Name + Category
  const handleAddAssetPair = async () => {
    const name = (assetPair.name || "").trim();
    const category = (assetPair.category || "").trim();

    if (!name || !category) {
      setError("Asset Name and Category are both required.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API}/api/setup/asset-names`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add asset");
      setSuccess("Asset and category added");
      setAssetPair({ name: "", category: "" });
      fetchMasterList("asset-names");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete handlers; for asset-names we delete by the full "Name:Category" key
  const handleDelete = async (type, value) => {
    if (!window.confirm(`Delete '${value}' from ${type}?`)) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `${API}/api/setup/${type}/${encodeURIComponent(value)}`,
        { method: "DELETE", credentials: "include" }
      );
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

  // Small UI helpers
  const shell = {
    page: {
      maxWidth: 760,
      margin: "28px auto",
      padding: 20,
      background: "#fff",
      borderRadius: 14,
      border: "1px solid #eef1f5",
      boxShadow: "0 2px 10px rgba(16,24,40,.05)",
    },
    titleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    title: { fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 },
    subtle: { color: "#6b7280", fontSize: 12, marginTop: 2 },
    section: {
      padding: 16,
      borderRadius: 12,
      border: "1px solid #eef2f7",
      background: "#fafbfc",
    },
    row: { display: "flex", gap: 10, alignItems: "center", marginTop: 10 },
    input: {
      flex: 1,
      minWidth: 220,
      padding: "10px 12px",
      fontSize: 14,
      borderRadius: 10,
      border: "1px solid #dfe3ea",
      background: "#fff",
      outline: "none",
    },
    inputFocus: { boxShadow: "0 0 0 4px rgba(99,102,241,.12)", borderColor: "#6366f1" },
    addBtn: {
      fontWeight: 700,
      fontSize: 14,
      padding: "9px 14px",
      color: "#14532d",
      background: "#e9fbe8",
      border: "1px solid #a7f3d0",
      borderRadius: 10,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      transition: "transform .12s, box-shadow .12s",
    },
    addBtnHover: { transform: "translateY(-1px)", boxShadow: "0 6px 14px rgba(16,24,40,.08)" },
    list: { margin: 0, padding: 0, listStyle: "none" },
    item: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 10px",
      borderRadius: 10,
      border: "1px solid #eef1f5",
      background: "#ffffff",
      marginTop: 8,
    },
    txt: { color: "#0f172a", fontSize: 14 },
    close: {
      color: "#ef4444",
      width: 26,
      height: 26,
      lineHeight: "26px",
      textAlign: "center",
      borderRadius: 999,
      border: "1px solid #fee2e2",
      background: "#fff5f5",
      cursor: "pointer",
      fontWeight: 700,
    },
    alert: (ok) => ({
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 10,
      fontSize: 13,
      color: ok ? "#065f46" : "#7f1d1d",
      background: ok ? "#ecfdf5" : "#fef2f2",
      border: `1px solid ${ok ? "#a7f3d0" : "#fecaca"}`,
    }),
  };

  const focus = (e) => {
    e.target.style.boxShadow = shell.inputFocus.boxShadow;
    e.target.style.borderColor = shell.inputFocus.borderColor;
  };
  const blur = (e) => {
    e.target.style.boxShadow = "none";
    e.target.style.borderColor = "#dfe3ea";
  };

  return (
    <div style={shell.page}>
      <div style={shell.titleRow}>
        <h2 style={shell.title}>Asset Names and Category</h2>
      </div>

      <div style={shell.section}>
        <div style={shell.row}>
          <input
            style={shell.input}
            type="text"
            placeholder="Asset name..."
            value={assetPair.name}
            onChange={(e) => setAssetPair((p) => ({ ...p, name: e.target.value }))}
            onFocus={focus}
            onBlur={blur}
          />
          <input
            style={shell.input}
            type="text"
            placeholder="Category..."
            value={assetPair.category}
            onChange={(e) => setAssetPair((p) => ({ ...p, category: e.target.value }))}
            onFocus={focus}
            onBlur={blur}
          />
          <button
            type="button"
            onClick={handleAddAssetPair}
            disabled={loading || !(assetPair.name.trim() && assetPair.category.trim())}
            style={{
              ...shell.addBtn,
              ...(loading || !(assetPair.name.trim() && assetPair.category.trim())
                ? { opacity: 0.6, cursor: "not-allowed" }
                : {}),
            }}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, shell.addBtnHover)}
            onMouseLeave={(e) =>
              Object.assign(e.currentTarget.style, { transform: "translateY(0)", boxShadow: "none" })
            }
          >
            + Add
          </button>
        </div>

        <ul style={shell.list}>
          {masterData["asset-names"].length === 0 && (
            <li style={{ color: "#9aa3af", marginTop: 8 }}>No asset names yet</li>
          )}
          {masterData["asset-names"].map((pair) => (
            <li key={pair} style={shell.item}>
              <span style={shell.txt}>{pair}</span>
              <button
                type="button"
                style={shell.close}
                onClick={() => handleDelete("asset-names", pair)}
                title={`Delete ${pair}`}
                disabled={loading}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe8e8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff5f5")}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ height: 16 }} />

      {MASTER_KEYS.map(({ key, label }) => (
        <div key={key} style={shell.section}>
          <h3 style={{ ...shell.title, fontSize: 16, marginBottom: 6 }}>{label}</h3>
          <div style={shell.row}>
            <input
              style={shell.input}
              type="text"
              placeholder={`Add new ${label.toLowerCase().slice(0, -1)}...`}
              value={newValues[key]}
              onChange={(e) => setNewValues((p) => ({ ...p, [key]: e.target.value }))}
              onFocus={focus}
              onBlur={blur}
            />
            <button
              type="button"
              onClick={() => handleAddGeneric(key)}
              disabled={loading || !newValues[key].trim()}
              style={{
                ...shell.addBtn,
                ...(loading || !newValues[key].trim() ? { opacity: 0.6, cursor: "not-allowed" } : {}),
              }}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, shell.addBtnHover)}
              onMouseLeave={(e) =>
                Object.assign(e.currentTarget.style, { transform: "translateY(0)", boxShadow: "none" })
              }
            >
              + Add
            </button>
          </div>

          <ul style={shell.list}>
            {masterData[key].map((v) => (
              <li key={v} style={shell.item}>
                <span style={shell.txt}>{v}</span>
                <button
                  type="button"
                  style={shell.close}
                  onClick={() => handleDelete(key, v)}
                  title={`Delete ${v}`}
                  disabled={loading}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe8e8")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff5f5")}
                >
                  ×
                </button>
              </li>
            ))}
            {masterData[key].length === 0 && (
              <li style={{ color: "#9aa3af", marginTop: 8 }}>No {label.toLowerCase()} yet</li>
            )}
          </ul>
        </div>
      ))}

      {error && <div style={shell.alert(false)}>{error}</div>}
      {success && <div style={shell.alert(true)}>{success}</div>}
      {loading && <div style={{ color: "#4338ca", marginTop: 10, fontSize: 13 }}>Please wait…</div>}
    </div>
  );
}
