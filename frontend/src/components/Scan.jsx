// src/pages/Scan.jsx
import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000"; // backend base URL

const STATUS_OPTIONS = ["active", "inactive", "repair", "scrape", "damage"];
const ASSIGNED_TYPE_OPTIONS = ["general", "individual"];

// Single-asset registration number format: <Asset_name>/<YYYYMMDDHHMMSS>/<NNNNN>
const REG_RE = /^[A-Za-z0-9_-]+\/\d{14}\/\d{5}$/;
// Bulk QR format: <INSTITUTE>/<DEPT>/<ddmmyyyyHHMMSS>/<NNNN>
const BULK_RE = /^[A-Z]{2,20}\/[A-Z]{2,20}\/\d{14}\/\d{4}$/;

export default function Scan() {
  const navigate = useNavigate();

  // Mode/state: "single" (Assets collection) or "bulk" (QrRegistry doc)
  const [mode, setMode] = useState(null);
  const [scannedText, setScannedText] = useState("");

  // When single
  const [asset, setAsset] = useState(null);

  // When bulk
  const [qrDoc, setQrDoc] = useState(null); // holds qr_id and any previously saved fields

  const [statusMsg, setStatusMsg] = useState(null);

  const [form, setForm] = useState({
    asset_name: "",
    category: "",
    location: "",
    assign_date: "",
    status: "active",
    desc: "",
    verification_date: "",
    verified: false,
    verified_by: "",
    institute: "",
    department: "",
    assigned_type: "general",
    assigned_faculty_name: "",
  });

  const needsFaculty = form.assigned_type === "individual";

  const scannerRef = useRef(null);   // Html5QrcodeScanner instance (UI wrapper)
  const fileQrRef = useRef(null);    // Html5Qrcode instance for file scanning
  const mountedRef = useRef(false);  // guard to avoid double init

  // Initialize the Scanner UI exactly once
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const initScanner = () => {
      const config = { fps: 10, qrbox: 250, rememberLastUsedCamera: true };
      const scanner = new Html5QrcodeScanner("qr-reader", config, false);

      const onSuccess = async (decodedText) => {
        try { await scanner.clear(); } catch { }
        handleDecodedText(decodedText);
      };

      const onError = () => { /* ignore per-frame errors */ };

      scanner.render(onSuccess, onError);
      scannerRef.current = scanner;
    };

    initScanner();
    fileQrRef.current = new Html5Qrcode("qr-reader-file-canvas", { verbose: false });

    return () => {
      (async () => {
        try { await scannerRef.current?.clear(); } catch { }
        try {
          if (fileQrRef.current?.isScanning) await fileQrRef.current.stop();
          await fileQrRef.current?.clear();
        } catch { }
      })();
    };
  }, []);

  // Decoded text handler shared by camera and file upload
  const handleDecodedText = async (text) => {
    setStatusMsg(null);
    setMode(null);
    setAsset(null);
    setQrDoc(null);
    setScannedText("");

    const t = (text || "").trim();
    if (!t) {
      setStatusMsg({ ok: false, msg: "Invalid QR" });
      return;
    }

    // Try BULK first
    if (BULK_RE.test(t)) {
      try {
        const res = await fetch(`${API}/api/qr/by-id/${encodeURIComponent(t)}`, { credentials: "include" });
        if (res.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (res.ok) {
          const qr = await res.json();
          setMode("bulk");
          setQrDoc(qr);
          setScannedText(t);
          // Prefill form with any saved values (else keep defaults)
          setForm({
            asset_name: qr.asset_name || "",
            category: qr.category || "",
            location: qr.location || "",
            assign_date: qr.assign_date || "",
            status: qr.status || "active",
            desc: qr.desc || "",
            verification_date: qr.verification_date || "",
            verified: !!qr.verified,
            verified_by: qr.verified_by || "",
            institute: qr.institute || "",
            department: qr.department || "",
            assigned_type: qr.assigned_type || "general",
            assigned_faculty_name:
              (qr.assigned_type || "general") === "individual" ? (qr.assigned_faculty_name || "") : "",
          });
          return;
        }
        // If bulk lookup failed (404), fall through to single pattern check below
      } catch {
        setStatusMsg({ ok: false, msg: "Network error" });
        return;
      }
    }

    // Fallback: SINGLE (registration number) path
    if (!REG_RE.test(t)) {
      setStatusMsg({ ok: false, msg: "Data not found" });
      return;
    }
    setScannedText(t);
    try {
      const encoded = encodeURIComponent(t);
      const res = await fetch(`${API}/api/assets/by-reg/${encoded}`, { credentials: "include" });
      if (res.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      if (!res.ok) {
        setStatusMsg({ ok: false, msg: "Not found" });
        return;
      }
      const data = await res.json();
      setMode("single");
      setAsset(data);
      setForm({
        asset_name: data.asset_name || "",
        category: data.category || "",
        location: data.location || "",
        assign_date: data.assign_date || "",
        status: data.status || "active",
        desc: data.desc || "",
        verification_date: data.verification_date || "",
        verified: !!data.verified,
        verified_by: data.verified_by || "",
        institute: data.institute || "",
        department: data.department || "",
        assigned_type: data.assigned_type || "general",
        assigned_faculty_name:
          (data.assigned_type || "general") === "individual" ? (data.assigned_faculty_name || "") : "",
      });
    } catch {
      setStatusMsg({ ok: false, msg: "Network error" });
    }
  };

  const restartScanner = async () => {
    setMode(null);
    setScannedText("");
    setAsset(null);
    setQrDoc(null);
    setStatusMsg(null);

    try { await scannerRef.current?.clear(); } catch { }

    const el = document.getElementById("qr-reader");
    if (el) while (el.firstChild) el.removeChild(el.firstChild);

    const config = { fps: 10, qrbox: 250, rememberLastUsedCamera: true };
    const scanner = new Html5QrcodeScanner("qr-reader", config, false);
    scanner.render(
      async (decodedText) => {
        try { await scanner.clear(); } catch { }
        handleDecodedText(decodedText);
      },
      () => {}
    );
    scannerRef.current = scanner;
  };

  // Scan from image file
  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(null);
    try {
      const result = await fileQrRef.current.scanFile(file, true);
      await fileQrRef.current.clear();
      handleDecodedText(result);
    } catch {
      setStatusMsg({ ok: false, msg: "Unable to read QR from image" });
    } finally {
      e.target.value = "";
    }
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      if (name === "assigned_type") {
        return {
          ...f,
          assigned_type: value,
          assigned_faculty_name: value === "general" ? "" : f.assigned_faculty_name,
        };
      }
      if (type === "checkbox" && name === "verified") {
        return { ...f, verified: !!checked };
      }
      return { ...f, [name]: value };
    });
  };

  const onSave = async (e) => {
    e.preventDefault();
    setStatusMsg(null);

    // Bulk path: PATCH into QrRegistry doc (verification_date will be auto-stamped server-side)
    if (mode === "bulk" && qrDoc?.qr_id) {
      try {
        const payload = {
          asset_name: form.asset_name,
          category: form.category,
          location: form.location,
          assign_date: form.assign_date,
          status: form.status,
          desc: form.desc,
          // Do not send verification_date; server will stamp when verified=true
          verified: !!form.verified,
          verified_by: form.verified_by,
          institute: form.institute,
          department: form.department,
          assigned_type: form.assigned_type,
          assigned_faculty_name: needsFaculty ? form.assigned_faculty_name : "",
        };

        const res = await fetch(`${API}/api/qr/${encodeURIComponent(qrDoc.qr_id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatusMsg({ ok: false, msg: data.error || "Failed to save" });
        } else {
          setStatusMsg({ ok: true, msg: "Saved to QR registry" });
          setQrDoc(data);
          // Reflect server-stamped date in form if present
          setForm((f) => ({ ...f, verification_date: data.verification_date || f.verification_date }));
        }
      } catch {
        setStatusMsg({ ok: false, msg: "Network error" });
      }
      return;
    }

    // Single path: PUT into Assets (verification_date auto-stamped server-side)
    if (mode === "single" && asset?._id) {
      try {
        const payload = {
          asset_name: form.asset_name,
          category: form.category,
          location: form.location,
          assign_date: form.assign_date,
          status: form.status,
          desc: form.desc,
          institute: form.institute,
          department: form.department,
          assigned_type: form.assigned_type,
          assigned_faculty_name: needsFaculty ? form.assigned_faculty_name : "",
          // Explicitly send verification fields; server will add verification_date if verified=true
          verified: !!form.verified,
          verified_by: form.verified_by,
        };

        const res = await fetch(`${API}/api/assets/${asset._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatusMsg({ ok: false, msg: data.error || "Failed to update" });
        } else {
          setStatusMsg({ ok: true, msg: "Updated successfully" });
          setAsset((a) => a && { ...a, ...payload, verification_date: data.verification_date || a.verification_date });
          setForm((f) => ({ ...f, verification_date: data.verification_date || f.verification_date }));
        }
      } catch {
        setStatusMsg({ ok: false, msg: "Network error" });
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Scan QR</h2>

        {/* Camera scanner UI container (managed entirely by Html5QrcodeScanner) */}
        <div id="qr-reader" className="w-full max-w-md" />

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600">Scanned: {scannedText || "-"}</span>
          <button
            onClick={restartScanner}
            className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            type="button"
          >
            Scan
          </button>

          {/* File upload fallback */}
          <label className="text-sm text-gray-600">
            or upload image:
            <input type="file" accept="image/*" onChange={onFileChange} className="ml-2 text-sm" />
          </label>
        </div>

        {statusMsg && !statusMsg.ok && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {statusMsg.msg}
          </div>
        )}

        {/* Hidden canvas container used by Html5Qrcode for file scanning */}
        <div id="qr-reader-file-canvas" style={{ display: "none" }} />
      </div>

      <div className="bg-white rounded shadow p-4">
        <h3 className="text-lg font-semibold mb-3">
          {mode === "bulk" ? "Bulk QR Details (QR Registry)" :
           mode === "single" ? "Asset Details" : "Details"}
        </h3>

        {!(mode === "bulk" || mode === "single") ? (
          <p className="text-gray-600 text-sm">
            Scan a QR code or upload an image; bulk QRs will load editable fields from the QR registry,
            single-asset QRs will load the asset record.
          </p>
        ) : (
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Asset Name</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="asset_name"
                  value={form.asset_name}
                  onChange={onChange}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Category</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="category"
                  value={form.category}
                  onChange={onChange}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Location</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="location"
                  value={form.location}
                  onChange={onChange}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Assign Date</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  name="assign_date"
                  value={form.assign_date}
                  onChange={onChange}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Status</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  name="status"
                  value={form.status}
                  onChange={onChange}
                  required
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Institute</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="institute"
                  value={form.institute}
                  onChange={onChange}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Department</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="department"
                  value={form.department}
                  onChange={onChange}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Assigned Type</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  name="assigned_type"
                  value={form.assigned_type}
                  onChange={onChange}
                  required
                >
                  {ASSIGNED_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className={`${needsFaculty ? "" : "opacity-60"}`}>
                <label className="block text-sm mb-1">
                  Assigned Faculty Name {needsFaculty ? "" : "(disabled)"}
                </label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="assigned_faculty_name"
                  value={form.assigned_faculty_name}
                  onChange={onChange}
                  placeholder="Dr. A B"
                  disabled={!needsFaculty}
                  required={needsFaculty}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Description</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  name="desc"
                  value={form.desc}
                  onChange={onChange}
                  rows={3}
                />
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="verified"
                    checked={!!form.verified}
                    onChange={onChange}
                  />
                  Verified
                </label>
              </div>

              <div>
                <label className="block text-sm mb-1">Verified By</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="verified_by"
                  value={form.verified_by}
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="text-sm text-gray-600">
              {mode === "single"
                ? <>Registration Number: {asset?.registration_number}</>
                : <>QR ID: {qrDoc?.qr_id}</>}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={restartScanner}
                className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200"
              >
                Scan Another
              </button>
            </div>
          </form>
        )}

        {statusMsg && statusMsg.ok && (
          <p className="mt-3 text-sm text-green-600">{statusMsg.msg}</p>
        )}
      </div>
    </div>
  );
}
