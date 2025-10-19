import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const API = "http://localhost:5000";

// Generate a QR PNG data URL for the given text
async function generateQrPng(text, size = 512) {
  const QR = await import("qrcode");
  return QR.toDataURL(text, {
    errorCorrectionLevel: "M",
    width: size,
    margin: 1,
    color: { dark: "#000000", light: "#FFFFFFFF" },
  });
}

function uniqSorted(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((v) => (v == null ? "" : String(v).trim()))
        .filter((v) => v.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function fmt(v, fallback = "-") {
  return v && String(v).trim() ? v : fallback;
}

function downloadExcel(rows, filenamePrefix = "assets_report") {
  const headers = [
    "serial_no",                // NEW: include serial in export too
    "registration_number",
    "asset_name",
    "category",
    "location",
    "assign_date",
    "status",
    "desc",
    "verification_date",
    "verified",
    "verified_by",
    "institute",
    "department",
    "assigned_type",
    "assigned_faculty_name",
  ];

  const data = rows.map((r) => {
    const obj = {};
    headers.forEach((h) => {
      obj[h] = r[h] != null ? r[h] : "";
    });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Assets");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  saveAs(blob, `${filenamePrefix}_${stamp}.xlsx`);
}

export default function Assets() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Dynamic filters
  const [filter, setFilter] = useState({
    q: "",
    status: "",
    category: "",
    assigned_type: "",
    institute: "",
    department: "",
    asset_name: "",
    location: "",
  });

  const [detail, setDetail] = useState(null); // selected asset for details panel

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API}/api/assets`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (res.status === 401) navigate("/login");
          else throw new Error("Failed to fetch assets");
        }
        const data = await res.json();

        if (alive) {
          setRows(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (e) {
        if (alive) {
          setErr(e.message || "Network error");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  // Build dynamic option sets from data
  const options = useMemo(() => {
    return {
      status: uniqSorted(rows.map((r) => r.status)),
      category: uniqSorted(rows.map((r) => r.category)),
      assigned_type: uniqSorted(rows.map((r) => r.assigned_type)),
      institute: uniqSorted(rows.map((r) => r.institute)),
      department: uniqSorted(rows.map((r) => r.department)),
      asset_name: uniqSorted(rows.map((r) => r.asset_name)),
      location: uniqSorted(rows.map((r) => r.location)),
    };
  }, [rows]);

  // Newest first using ObjectId time
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const ida = a._id || "";
      const idb = b._id || "";
      const ta = /^[0-9a-fA-F]{24}$/.test(ida) ? parseInt(ida.slice(0, 8), 16) : 0;
      const tb = /^[0-9a-fA-F]{24}$/.test(idb) ? parseInt(idb.slice(0, 8), 16) : 0;
      if (tb !== ta) return tb - ta;
      return (b.registration_number || "").localeCompare(a.registration_number || "");
    });
    return copy;
  }, [rows]);

  // Apply filters
  const filtered = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    return sorted.filter((r) => {
      const hitQ =
        !q ||
        [
          r.registration_number,
          r.asset_name,
          r.location,
          r.category,
          r.status,
          r.institute,
          r.department,
          r.assigned_type,
          r.assigned_faculty_name,
          r.desc,
          r.serial_no != null ? String(r.serial_no) : "", // allow search by serial
        ]
          .map((x) => (x || "").toString().toLowerCase())
          .some((s) => s.includes(q));

      const hitStatus = !filter.status || (r.status || "") === filter.status;
      const hitCat = !filter.category || (r.category || "") === filter.category;
      const hitAT = !filter.assigned_type || (r.assigned_type || "") === filter.assigned_type;
      const hitInst = !filter.institute || (r.institute || "") === filter.institute;
      const hitDept = !filter.department || (r.department || "") === filter.department;
      const hitName = !filter.asset_name || (r.asset_name || "") === filter.asset_name;
      const hitLoc = !filter.location || (r.location || "") === filter.location;

      return hitQ && hitStatus && hitCat && hitAT && hitInst && hitDept && hitName && hitLoc;
    });
  }, [sorted, filter]);

  // Download QR that includes serial text below the code and in filename
  const onDownloadQr = async (asset) => {
    try {
      const content = asset.registration_number || ""; // encode what you scan
      const dataUrl = await generateQrPng(content, 600);

      // Draw serial text below QR
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => {
        img.onload = res;
      });

      const padding = 16;
      const textH = 34;
      const canvas = document.createElement("canvas");
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2 + textH;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, padding, padding);

      ctx.fillStyle = "#111";
      ctx.font = "600 20px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
      const serial = asset.serial_no != null ? String(asset.serial_no) : "-";
      const label = `Serial No: ${serial}`;
      const w = ctx.measureText(label).width;
      ctx.fillText(label, (canvas.width - w) / 2, img.height + padding + 24);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      const safeName = (asset.asset_name || "ASSET")
        .replace(/[^A-Za-z0-9_-]+/g, "_")
        .slice(0, 40) || "ASSET";
      a.download = `${safeName}_${serial}_${(asset.registration_number || "REG").replace(/[^\w-]+/g, "_")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert("Failed to generate QR image");
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <p className="text-gray-600">Loading assets…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <p className="text-red-600">{err}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded shadow p-4">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h2 className="text-xl font-semibold">Assets</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {filtered.length} shown of {rows.length}
            </span>
            <button
              type="button"
              onClick={() => {
                const prefix =
                  filter.q ||
                  filter.status ||
                  filter.category ||
                  filter.assigned_type ||
                  filter.institute ||
                  filter.department ||
                  filter.asset_name ||
                  filter.location
                    ? "assets_report_filtered"
                    : "assets_report_all";
                downloadExcel(filtered.length ? filtered : rows, prefix);
              }}
              className="inline-flex items-center rounded bg-emerald-600 text-white px-3 py-1.5 text-sm hover:bg-emerald-700"
              title="Download current view as Excel"
            >
              Download report
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Search text"
            value={filter.q}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
          />
          <select
            className="border rounded px-3 py-2"
            value={filter.institute}
            onChange={(e) => setFilter((f) => ({ ...f, institute: e.target.value }))}
          >
            <option value="">All institutes</option>
            {options.institute.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filter.department}
            onChange={(e) => setFilter((f) => ({ ...f, department: e.target.value }))}
          >
            <option value="">All departments</option>
            {options.department.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filter.asset_name}
            onChange={(e) => setFilter((f) => ({ ...f, asset_name: e.target.value }))}
          >
            <option value="">All asset names</option>
            {options.asset_name.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <select
            className="border rounded px-3 py-2"
            value={filter.location}
            onChange={(e) => setFilter((f) => ({ ...f, location: e.target.value }))}
          >
            <option value="">All locations</option>
            {options.location.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filter.category}
            onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="">All categories</option>
            {options.category.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All status</option>
            {options.status.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filter.assigned_type}
            onChange={(e) => setFilter((f) => ({ ...f, assigned_type: e.target.value }))}
          >
            <option value="">All assigned types</option>
            {options.assigned_type.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-2">Serial No</th>{/* NEW */}
                <th className="px-3 py-2">Asset Name</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Assign Date</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a._id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">{fmt(a.serial_no)}</td>{/* NEW */}
                  <td className="px-3 py-2">{fmt(a.asset_name)}</td>
                  <td className="px-3 py-2">{fmt(a.location)}</td>
                  <td className="px-3 py-2">{fmt(a.status)}</td>
                  <td className="px-3 py-2">{fmt(a.assign_date)}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      onClick={() => onDownloadQr(a)}
                      className="inline-flex items-center rounded bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700"
                    >
                      Download QR
                    </button>
                    <button
                      onClick={() => setDetail(a)}
                      className="inline-flex items-center rounded bg-gray-100 px-3 py-1.5 hover:bg-gray-200"
                    >
                      More details
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-gray-500" colSpan={6}>
                    No assets found. Adjust filters or add new items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details slide-over / modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/30 flex items-start md:items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-white rounded shadow-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Asset Details</h3>
              <button
                onClick={() => setDetail(null)}
                className="text-gray-600 hover:text-gray-900"
              >
                ✕
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <Field label="Serial No" value={fmt(detail.serial_no)} />{/* NEW */}
              <Field label="Registration Number" value={fmt(detail.registration_number)} />
              <Field label="Asset Name" value={fmt(detail.asset_name)} />
              <Field label="Category" value={fmt(detail.category)} />
              <Field label="Location" value={fmt(detail.location)} />
              <Field label="Assign Date" value={fmt(detail.assign_date)} />
              <Field label="Status" value={fmt(detail.status)} />
              <Field label="Description" value={fmt(detail.desc)} />
              <Field label="Verification Date" value={fmt(detail.verification_date)} />
              <Field label="Verified" value={String(!!detail.verified)} />
              <Field label="Verified By" value={fmt(detail.verified_by)} />
              <Field label="Institute" value={fmt(detail.institute)} />
              <Field label="Department" value={fmt(detail.department)} />
              <Field label="Assigned Type" value={fmt(detail.assigned_type)} />
              <Field label="Assigned Faculty Name" value={fmt(detail.assigned_faculty_name)} />
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => onDownloadQr(detail)}
                className="inline-flex items-center rounded bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700"
              >
                Download QR
              </button>
              <button
                onClick={() => setDetail(null)}
                className="inline-flex items-center rounded bg-gray-100 px-3 py-1.5 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Small display helper
function Field({ label, value }) {
  return (
    <div>
      <div className="text-gray-500">{label}</div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
}
