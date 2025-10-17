// src/components/BulkInventory.jsx
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode"; // npm i qrcode

const API = "http://localhost:5000"; // keep same host as your login

const INSTITUTES = ["", "UVPCE", "BSPP", "CSPIT", "DEPSTAR"];
const DEPARTMENTS = ["", "IT", "CE", "ME", "EC", "EE"];
const USED_OPTIONS = [
  { value: "", label: "All" },
  { value: "false", label: "Unused" },
  { value: "true", label: "Linked" },
];

export default function BulkInventory() {
  const [items, setItems] = useState([]);
  const [inst, setInst] = useState("");
  const [dept, setDept] = useState("");
  const [used, setUsed] = useState(""); // "", "true", "false"
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Modal state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  // Compose query string for filters + pagination
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (inst) p.set("institute", inst);
    if (dept) p.set("department", dept);
    if (used) p.set("used", used); // "true" | "false"
    p.set("page", String(page));
    p.set("size", String(size));
    return p.toString();
  }, [inst, dept, used, page, size]);

  // Load list
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    fetch(`${API}/api/qr?${params}`, { credentials: "include" })
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) throw new Error("load");
        const data = await r.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(() => alive && setErr("Failed to load"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [params]);

  // Generate/download QR image (serial printed below)
  const onGenerateQR = async (row) => {
    try {
      // Encode qr_id into QR image
      const dataUrl = await QRCode.toDataURL(row.qr_id, { margin: 1, width: 512 });

      // Draw on a canvas and print serial under the QR
      const img = new Image();
      img.src = dataUrl;
      await img.decode();

      const padding = 24;
      const textH = 40;
      const canvas = document.createElement("canvas");
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2 + textH;
      const ctx = canvas.getContext("2d");

      // White background
      ctx.fillStyle = "#15c96fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // QR image
      ctx.drawImage(img, padding, padding);

      // Serial text
      ctx.fillStyle = "#111";
      ctx.font = "bold 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      const text = `Serial: ${row.serial_no}`;
      const w = ctx.measureText(text).width;
      ctx.fillText(text, (canvas.width - w) / 2, img.height + padding + 28);

      // Download file
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${row.serial_no}_${row.ts || "qr"}.png`;
      a.click();
    } catch {
      alert("Unable to generate QR image");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / size));

  // Modal open helper
  const onViewDetails = (row) => {
    setSelected(row);
    setOpen(true);
  };

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold mb-3">Bulk Inventory</h2>
      </div>

      {/* Filters + paging */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <select
          className="border rounded px-3 py-2"
          value={inst}
          onChange={(e) => {
            setPage(1);
            setInst(e.target.value);
          }}
        >
          {INSTITUTES.map((v) => (
            <option key={v || "all"} value={v}>
              {v || "All institutes"}
            </option>
          ))}
        </select>

        <select
          className="border rounded px-3 py-2"
          value={dept}
          onChange={(e) => {
            setPage(1);
            setDept(e.target.value);
          }}
        >
          {DEPARTMENTS.map((v) => (
            <option key={v || "all"} value={v}>
              {v || "All departments"}
            </option>
          ))}
        </select>

        <select
          className="border rounded px-3 py-2"
          value={used}
          onChange={(e) => {
            setPage(1);
            setUsed(e.target.value);
          }}
        >
          {USED_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          className="border rounded px-3 py-2"
          value={size}
          onChange={(e) => {
            setPage(1);
            setSize(Number(e.target.value));
          }}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 border rounded"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </button>
          <div className="text-sm">
            Page {page} / {totalPages}
          </div>
          <button
            className="px-3 py-2 border rounded"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-600">Loading…</div>
      ) : err ? (
        <div className="text-red-600">{err}</div>
      ) : items.length === 0 ? (
        <div className="text-gray-600">No QR entries found.</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-3 py-2">Serial No</th>
                <th className="text-left px-3 py-2">Asset Name</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Assign Date</th>
                <th className="text-left px-3 py-2">QR ID</th>
                <th className="text-left px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r._id} className="border-b">
                  <td className="px-3 py-2 font-medium">{r.serial_no}</td>
                  {/* These fields are enriched by the backend only when linked; otherwise blank */}
                  <td className="px-3 py-2">{r.asset_name || "-"}</td>
                  <td className="px-3 py-2">{r.status || "-"}</td>
                  <td className="px-3 py-2">{r.assign_date || "-"}</td>
                  <td className="px-3 py-2 font-mono">{r.qr_id}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onGenerateQR(r)}
                        className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        Generate QR
                      </button>
                      <button
                        onClick={() => onViewDetails(r)}
                        className="px-3 py-1.5 rounded border hover:bg-gray-50"
                      >
                        View details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {open && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-50 w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-semibold">QR Details</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="p-5">
              {/* QR meta (always) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <Field label="Serial No" value={selected.serial_no || "-"} />
                <Field label="QR ID" value={selected.qr_id || "-"} mono />
                <Field label="Institute" value={selected.institute || "-"} />
                <Field label="Department" value={selected.department || "-"} />
                <Field label="Created" value={selected.ts || "-"} />
                <Field label="Linked" value={selected.used ? "Yes" : "No"} />
              </div>

              <hr className="my-4" />

              {/* Asset section */}
              {selected.used && selected.asset_id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Asset Name" value={selected.asset_name || "-"} />
                  <Field label="Status" value={selected.status || "-"} />
                  <Field label="Assign Date" value={selected.assign_date || "-"} />
                </div>
              ) : (
                <div className="rounded border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
                  No asset is linked to this QR yet. Ask a verifier to scan this QR and fill asset details; once linked, fields here will be populated.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t">
              <button
                onClick={() => onGenerateQR(selected)}
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Download QR
              </button>
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded border hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Small field renderer
function Field({ label, value, mono = false }) {
  return (
    <div>
      <div className="text-gray-500">{label}</div>
      <div className={mono ? "font-mono" : "font-medium"}>{value || "-"}</div>
    </div>
  );
}
