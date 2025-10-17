// src/components/BulkInventory.jsx
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

const API = "http://localhost:5000";

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
  const [used, setUsed] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Modal
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);     // qr row
  const [detail, setDetail] = useState(null);         // merged data to render
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (inst) p.set("institute", inst);
    if (dept) p.set("department", dept);
    if (used) p.set("used", used);
    p.set("page", String(page));
    p.set("size", String(size));
    return p.toString();
  }, [inst, dept, used, page, size]);

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
    return () => { alive = false; };
  }, [params]);

  const onGenerateQR = async (row) => {
    try {
      const dataUrl = await QRCode.toDataURL(row.qr_id, { margin: 1, width: 512 });
      const img = new Image();
      img.src = dataUrl;
      await img.decode();

      const padding = 16;
      const textH = 34;
      const canvas = document.createElement("canvas");
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2 + textH;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, padding, padding);

      ctx.fillStyle = "#111";
      ctx.font = "600 20px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
      const text = `Serial: ${row.serial_no}`;
      const w = ctx.measureText(text).width;
      ctx.fillText(text, (canvas.width - w) / 2, img.height + padding + 24);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${row.serial_no}_${row.ts || "qr"}.png`;
      a.click();
    } catch {
      alert("Unable to generate QR image");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / size));

  const onViewDetails = async (row) => {
    setSelected(row);
    setOpen(true);
    setDetailErr("");
    setDetail(null);

    if (row.used && row.asset_id) {
      setDetailLoading(true);
      try {
        const res = await fetch(`${API}/api/assets/${row.asset_id}`, { credentials: "include" });
        if (!res.ok) {
          setDetailErr("Failed to load asset details");
          setDetail(row);
        } else {
          const asset = await res.json();
          setDetail({ ...row, ...asset });
        }
      } catch {
        setDetailErr("Network error");
        setDetail(row);
      } finally {
        setDetailLoading(false);
      }
    } else {
      setDetail(row);
    }
  };

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold mb-3">Bulk Inventory</h2>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        <select className="border rounded px-3 py-2" value={inst}
                onChange={(e) => { setPage(1); setInst(e.target.value); }}>
          {INSTITUTES.map((v) => <option key={v || "all"} value={v}>{v || "All institutes"}</option>)}
        </select>
        <select className="border rounded px-3 py-2" value={dept}
                onChange={(e) => { setPage(1); setDept(e.target.value); }}>
          {DEPARTMENTS.map((v) => <option key={v || "all"} value={v}>{v || "All departments"}</option>)}
        </select>
        <select className="border rounded px-3 py-2" value={used}
                onChange={(e) => { setPage(1); setUsed(e.target.value); }}>
          {USED_OPTIONS.map((o) => <option key={o.value || "all"} value={o.value}>{o.label}</option>)}
        </select>
        <select className="border rounded px-3 py-2" value={size}
                onChange={(e) => { setPage(1); setSize(Number(e.target.value)); }}>
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <div className="flex items-center justify-between md:justify-end gap-2">
          <button className="px-3 py-2 border rounded"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}>Prev</button>
          <div className="text-sm">Page {page} / {Math.max(1, Math.ceil(total / size))}</div>
          <button className="px-3 py-2 border rounded"
                  onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(total / size)), p + 1))}
                  disabled={page >= Math.max(1, Math.ceil(total / size))}>Next</button>
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
          <div className="relative z-50 w-[90vw] max-w-3xl rounded-lg bg-white shadow-xl">
            {/* Header summary: compact row */}
            <div className="px-5 py-3 border-b">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <h3 className="text-base font-semibold">QR {selected.serial_no}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 font-mono">{selected.qr_id}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${selected.used ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {selected.used ? "Linked" : "Not linked"}
                </span>
              </div>
            </div>

            {/* Body: scrollable */}
            <div className="max-h-[70vh] overflow-auto px-5 py-4">
              {/* QR meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <Field label="Serial No" value={selected.serial_no || "-"} />
                <Field label="Created" value={selected.ts || "-"} />
                <Field label="Institute" value={selected.institute || "-"} />
                <Field label="Department" value={selected.department || "-"} />
              </div>

              <div className="my-4 border-t" />

              {/* Asset-like fields */}
              {detailLoading ? (
                <div className="text-sm text-gray-600">Loading details…</div>
              ) : detailErr ? (
                <div className="text-sm text-red-600">{detailErr}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">

                  <Field label="Asset Name" value={detail?.asset_name || "-"} />
                  <Field label="Category" value={detail?.category || "-"} />
                  <Field label="Location" value={detail?.location || "-"} />
                  <Field label="Assign Date" value={detail?.assign_date || "-"} />
                  <Field label="Status" value={detail?.status || "-"} />
                  <Field label="Verified" value={detail?.verified ? "true" : (detail?.verified === false ? "false" : "-")} />
                  <Field label="Verified By" value={detail?.verified_by || "-"} />
                  <Field label="Verification Date" value={detail?.verification_date || "-"} />
                  <Field label="Assigned Type" value={detail?.assigned_type || "-"} />
                  <Field label="Assigned Faculty Name" value={detail?.assigned_faculty_name || "-"} />
                  {/* Description spans full width with clamp */}
                  <Field label="Description" value={detail?.desc || "-"} full lineClamp />
                </div>
              )}

              {!selected.used && (
                <div className="mt-3 rounded border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-xs">
                  Not linked yet. Ask a verifier to scan this QR and fill details; once saved or linked, they will appear here.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t">
              <button
                onClick={() => onGenerateQR(selected)}
                className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
              >
                Download QR
              </button>
              <button onClick={() => setOpen(false)} className="px-3 py-2 rounded border hover:bg-gray-50 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono = false, full = false, lineClamp = false }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`${mono ? "font-mono" : "font-medium"} text-sm ${lineClamp ? "line-clamp-2" : ""}`}>
        {value || "-"}
      </div>
    </div>
  );
}
