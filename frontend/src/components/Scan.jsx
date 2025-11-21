// src/components/Scan.jsx
import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useAuth } from "../middle/AuthContext";

const API = process.env.REACT_APP_BACKEND_PORT || "http://localhost:5000";

const STATUS_OPTIONS = ["active", "inactive", "repair", "scrape", "damage"];
const ASSIGNED_TYPE_OPTIONS = ["general", "individual"];
const REG_RE = /^[A-Za-z0-9_-]+\/\d{14}\/\d{5,15}$/;

export default function Scan() {
  const navigate = useNavigate();
  const storedUser = JSON.parse(sessionStorage.getItem("user"));
  // Fetch institutes and departments on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [institutesRes, departmentsRes] = await Promise.all([
          fetch(`${API}/api/setup/institutes`, { credentials: "include" }),
          fetch(`${API}/api/setup/departments`, { credentials: "include" })
        ]);

        if (institutesRes.ok && departmentsRes.ok) {
          const institutesList = await institutesRes.json();
          const departmentsList = await departmentsRes.json();
          setInstitutes(institutesList);
          setDepartments(departmentsList);
        }
      } catch (error) {
        console.error('Error fetching institutes/departments:', error);
      }
    };

    fetchData();
  }, []);

  // Single-mode states
  const [scannedText, setScannedText] = useState("");
  const [asset, setAsset] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);
  const [excelData, setExcelData] = useState(null);
  const [institutes, setInstitutes] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Excel import (unchanged)
  const handleExcelImport = async (event) => {
    const currentUser = JSON.parse(sessionStorage.getItem("user"));
    if (!currentUser) {
      setStatusMsg("Please log in to update assets");
      navigate("/login");
      return;
    }
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        setExcelData(jsonData);

        // Validate rows before making any API updates.
        // Required non-empty columns:
        const requiredCols = [
          "Serial No",
          "Registration No",
          "Asset Name",
          "Category",
          "Institute",
          "Status",
          "Date of Purchase",
          "Room No. / Location (short)",
          "Assigned Type",
          "Assign Date",
        ];

        const errors = [];

        jsonData.forEach((row, idx) => {
          const rowNum = idx + 2; // assume header is row 1, data starts at 2
          // Check required non-empty
          requiredCols.forEach((col) => {
            const val = row[col];
            if (val == null || (typeof val === "string" && val.trim() === "")) {
              errors.push(`Row ${rowNum}: '${col}' is required but blank.`);
            }
          });

          // Verified / Verified By rules
          const rawVerified = row["Verified"];
          const rawVerifiedBy = row["Verified By"];
          const vstr = rawVerified == null ? "" : String(rawVerified).trim().toLowerCase();
          const hasVerifiedBy = rawVerifiedBy != null && String(rawVerifiedBy).trim() !== "";

          if (vstr === "no" || vstr === "false" || vstr === "0") {
            // If Verified explicitly 'No' then Verified By must be blank
            if (hasVerifiedBy) {
              errors.push(`Row ${rowNum}: 'Verified' is 'No' but 'Verified By' must be blank.`);
            }
          } else if (vstr === "yes" || vstr === "true" || vstr === "1") {
            // If Verified explicitly 'Yes' then Verified By must have some value
            if (!hasVerifiedBy) {
              errors.push(`Row ${rowNum}: 'Verified' is 'Yes' but 'Verified By' is blank.`);
            }
          }

          // Assigned Type rules
          const atypeRaw = row["Assigned Type"];
          const atype = (atypeRaw || "").toString().trim().toLowerCase();
          const fac = row["Assigned Faculty Name"];
          const emp = row["Employee Code"];

          if (atype && atype === "general") {
            if (fac != null && String(fac).trim() !== "") {
              errors.push(`Row ${rowNum}: Assigned Type is 'general' but 'Assigned Faculty Name' must be blank.`);
            }
            if (emp != null && String(emp).trim() !== "") {
              errors.push(`Row ${rowNum}: Assigned Type is 'general' but 'Employee Code' must be blank.`);
            }
          } else if (atype && atype === "individual") {
            if (fac == null || String(fac).trim() === "") {
              errors.push(`Row ${rowNum}: Assigned Type is 'individual' but 'Assigned Faculty Name' is blank.`);
            }
            if (emp == null || String(emp).trim() === "") {
              errors.push(`Row ${rowNum}: Assigned Type is 'individual' but 'Employee Code' is blank.`);
            }
          } else {
            // Unknown assigned type
            if (atypeRaw == null || String(atypeRaw).trim() === "") {
              // already reported by requiredCols check
            } else {
              errors.push(`Row ${rowNum}: Unknown 'Assigned Type' value '${atypeRaw}'. Expected 'general' or 'individual'.`);
            }
          }
        });

        if (errors.length > 0) {
          // Build a concise message. Limit to first 10 errors for readability.
          const maxShow = 10;
          const shown = errors.slice(0, maxShow).join(" ");
          const more = errors.length > maxShow ? ` (and ${errors.length - maxShow} more)` : "";
          setStatusMsg(`Excel validation failed: ${shown}${more}`);
          return;
        }

        const updateResults = await Promise.all(
          jsonData.map(async (row) => {
            // Normalize Verified -> boolean per rules:
            // - If Verified cell is 'No' (case-insensitive) => false
            // - If Verified cell is 'Yes' (case-insensitive) => true
            // - If Verified cell is empty but Verified By has some value => true
            // - Default to false
            const rawVerified = row["Verified"];
            const rawVerifiedBy = row["Verified By"];
            const normalizeVerified = (v, by) => {
              if (v === true) return true;
              if (v === false) return false;
              if (v == null || (typeof v === "string" && v.trim() === "")) {
                // empty Verified cell -> check Verified By
                return by != null && String(by).trim() !== "";
              }
              const s = String(v).trim().toLowerCase();
              if (s === "no" || s === "false" || s === "0") return false;
              if (s === "yes" || s === "true" || s === "1") return true;
              // fallback: treat non-empty as true
              return true;
            };

            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

            const mappedData = {
              serial_no: row["Serial No"],
              registration_number: row["Registration No"],
              asset_name: row["Asset Name"],
              category: row["Category"],
              institute: row["Institute"],
              department: row["Department"],
              status: row["Status"],
              size_lxwxh: row["Design Specifications (LxWxH)"],
              company_model: row["Company / Model / Model No."],
              it_serial_no: row["Serial No. (IT Asset)"],
              dead_stock_no: row["Dead Stock / Asset / Stock No."],
              bill_no: row["Bill No"],
              vendor_name: row["Vendor Name"],
              purchase_date: row["Date of Purchase"],
              rate_per_unit: row["Rate per Unit (Rs.)"],
              po_no: row["Purchase Order (PO) No."],
              room_no: row["Room No. / Location (short)"],
              building_name: row["Name of Building"],
              desc: row["Description"],
              assigned_type: row["Assigned Type"],
              assigned_faculty_name: row["Assigned Faculty Name"],
              employee_code: row["Employee Code"],
              assign_date: row["Assign Date"],
              remarks: row["Remarks"],
              // If the Excel row marks the asset as verified but contains no verification date,
              // set today's date (YYYY-MM-DD). Otherwise keep whatever is present in the sheet.
              verification_date:
                normalizeVerified(rawVerified, rawVerifiedBy) && (row["Verification Date"] == null || String(row["Verification Date"]).trim() === "")
                  ? today
                  : row["Verification Date"],
              verified: normalizeVerified(rawVerified, rawVerifiedBy),
              verified_by: rawVerifiedBy || "",
            };

            try {
              if (!currentUser) throw new Error("You must be logged in to update assets");

              const response = await fetch(
                `${API}/api/assets/update-by-registration/${mappedData.registration_number}`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify(mappedData),
                }
              );

              if (!response.ok) {
                if (response.status === 401) throw new Error("Unauthorized. Please log in again.");
                throw new Error(
                  `Failed to update asset with registration number: ${mappedData.registration_number}`
                );
              }

              return { registration_number: mappedData.registration_number, status: "success" };
            } catch (error) {
              return {
                registration_number: mappedData.registration_number,
                status: "error",
                error: error.message,
              };
            }
          })
        );

        const successCount = updateResults.filter((r) => r.status === "success").length;
        const errorCount = updateResults.filter((r) => r.status === "error").length;

        setStatusMsg(`Updated ${successCount} assets successfully. ${errorCount} assets failed to update.`);
        
        // Clear the Excel file from memory after processing
        setExcelData(null);
      } catch (error) {
        setStatusMsg(`Error processing Excel file: ${error.message}`);
        // Clear the Excel file from memory even if processing fails
        setExcelData(null);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Unified form (single mode)
  const [form, setForm] = useState({
    institute: "",
    department: "",
    asset_name: "",
    category: "",
    status: "active",
    size_lxwxh: "",
    company_model: "",
    it_serial_no: "",
    dead_stock_no: "",
    bill_no: "",
    vendor_name: "",
    purchase_date: "",
    rate_per_unit: "",
    po_no: "",
    room_no: "",
    building_name: "",
    desc: "",
    assigned_type: "general",
    assigned_faculty_name: "",
    employee_code: "",
    assign_date: "",
    remarks: "",
    location: "",
    verification_date: "",
    verified: false,
    verified_by: "",
  });

  const needsFaculty = form.assigned_type === "individual";

  const scannerRef = useRef(null);
  const fileQrRef = useRef(null);
  const mountedRef = useRef(false);
  const excelFileInputRef = useRef(null);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const initScanner = () => {
      const config = { fps: 10, qrbox: 250, rememberLastUsedCamera: true };
      const scanner = new Html5QrcodeScanner("qr-reader", config, false);

      const onSuccess = async (decodedText) => {
        try {
          await scanner.clear();
        } catch {}
        handleDecodedText(decodedText);
      };

      const onError = () => {};

      scanner.render(onSuccess, onError);
      scannerRef.current = scanner;
    };

    initScanner();
    fileQrRef.current = new Html5Qrcode("qr-reader-file-canvas", { verbose: false });

    return () => {
      (async () => {
        try {
          await scannerRef.current?.clear();
        } catch {}
        try {
          if (fileQrRef.current?.isScanning) await fileQrRef.current.stop();
          await fileQrRef.current?.clear();
        } catch {}
      })();
    };
  }, []);

  // Reset file input when Excel data is cleared
  useEffect(() => {
    if (!excelData && excelFileInputRef.current) {
      excelFileInputRef.current.value = "";
    }
  }, [excelData]);

  const fillFormFromDoc = (doc) => {
    const assignedType = (doc.assigned_type || "general").toLowerCase();
    setForm({
      institute: doc.institute || "",
      department: doc.department || "",
      asset_name: doc.asset_name || "",
      category: doc.category || "",
      status: doc.status || "active",
      size_lxwxh: doc.size_lxwxh || "",
      company_model: doc.company_model || "",
      it_serial_no: doc.it_serial_no || "",
      dead_stock_no: doc.dead_stock_no || "",
      bill_no: doc.bill_no || "",
      vendor_name: doc.vendor_name || "",
      purchase_date: doc.purchase_date || "",
      rate_per_unit: doc.rate_per_unit != null ? String(doc.rate_per_unit) : "",
      po_no: doc.po_no || "",
      room_no: doc.room_no || "",
      building_name: doc.building_name || "",
      desc: doc.desc || "",
      assigned_type: assignedType,
      assigned_faculty_name: assignedType === "individual" ? doc.assigned_faculty_name || "" : "",
      employee_code: assignedType === "individual" ? doc.employee_code || "" : "",
      assign_date: doc.assign_date || "",
      remarks: doc.remarks || "",
      location: doc.location || "",
      verification_date: doc.verification_date || "",
      verified: (() => {
        const v = doc.verified;
        if (v === true) return true;
        if (v === false) return false;
        if (v == null) return false;
        const s = String(v).trim().toLowerCase();
        return s === "yes" || s === "true" || s === "1";
      })(),
      verified_by: doc.verified_by || "",
    });
  };

  const handleDecodedText = async (text) => {
    setStatusMsg(null);
    setAsset(null);
    setScannedText("");

    const t = (text || "").trim();
    if (!t) {
      setStatusMsg({ ok: false, msg: "Invalid QR" });
      return;
    }

    // Only single mode
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
      setAsset(data);
      fillFormFromDoc(data);
    } catch {
      setStatusMsg({ ok: false, msg: "Network error" });
    }
  };

  const restartScanner = async () => {
    setScannedText("");
    setAsset(null);
    setStatusMsg(null);

    try {
      await scannerRef.current?.clear();
    } catch {}

    const el = document.getElementById("qr-reader");
    if (el) while (el.firstChild) el.removeChild(el.firstChild);

    const config = { fps: 10, qrbox: 250, rememberLastUsedCamera: true };
    const scanner = new Html5QrcodeScanner("qr-reader", config, false);
    scanner.render(
      async (decodedText) => {
        try {
          await scanner.clear();
        } catch {}
        handleDecodedText(decodedText);
      },
      () => {}
    );
    scannerRef.current = scanner;
  };

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
        const nextType = value;
        return {
          ...f,
          assigned_type: nextType,
          assigned_faculty_name: nextType === "general" ? "" : f.assigned_faculty_name,
          employee_code: nextType === "general" ? "" : f.employee_code,
        };
      }
      if (type === "checkbox" && name === "verified") {
        return { ...f, verified: !!checked };
      }
      if (name === "rate_per_unit") {
        const onlyDigitsDot = value.replace(/[^\d.]/g, "");
        return { ...f, rate_per_unit: onlyDigitsDot };
      }
      return { ...f, [name]: value };
    });
  };

  const onSave = async (e) => {
    e.preventDefault();
    setStatusMsg(null);

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const payload = {
      institute: form.institute,
      department: form.department,
      asset_name: form.asset_name,
      category: form.category,
      status: form.status,
      size_lxwxh: form.size_lxwxh,
      company_model: form.company_model,
      it_serial_no: form.it_serial_no,
      dead_stock_no: form.dead_stock_no,
      bill_no: form.bill_no,
      vendor_name: form.vendor_name,
      purchase_date: form.purchase_date,
      rate_per_unit: form.rate_per_unit,
      po_no: form.po_no,
      room_no: form.room_no,
      building_name: form.building_name,
      desc: form.desc,
      assigned_type: form.assigned_type,
      assigned_faculty_name: needsFaculty ? form.assigned_faculty_name : "",
      employee_code: needsFaculty ? form.employee_code : "",
      assign_date: form.assign_date,
      remarks: form.remarks,
      location: form.location,
      // Ensure verification_date is set to today when verified is true and no date exists
      verified: !!form.verified,
      verification_date: form.verified ? (form.verification_date || today) : form.verification_date,
      verified_by: form.verified_by,
    };

    try {
      if (asset?._id) {
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
      } else {
        setStatusMsg({ ok: false, msg: "Scan an asset QR first" });
      }
    } catch {
      setStatusMsg({ ok: false, msg: "Network error" });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* QR Scanner - MOVED UP */}
      <div className="bg-white rounded shadow p-4">
        <h2 className="text-xl font-semibold mb-3">Scan QR</h2>
        <div id="qr-reader" className="w-full max-w-md" />
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600">Scanned: {scannedText || "-"}</span>
          <button onClick={restartScanner} className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200" type="button">
            Scan
          </button>
          <label className="text-sm text-gray-600">
            or upload image:
            <input type="file" accept="image/*" onChange={onFileChange} className="ml-2 text-sm" />
          </label>
        </div>
        {statusMsg && typeof statusMsg === "object" && !statusMsg.ok && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {statusMsg.msg}
          </div>
        )}
        <div id="qr-reader-file-canvas" style={{ display: "none" }} />
      </div>

      {/* Excel Import - MOVED DOWN */}
      <div className="bg-white rounded shadow p-4">
        <h2 className="text-xl font-semibold mb-3">Import Assets from Excel</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              ref={excelFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setStatusMsg(null);
                const file = e.target.files[0];
                if (file) setExcelData(file);
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              onClick={() => {
                if (excelData) {
                  handleExcelImport({ target: { files: [excelData] } });
                } else {
                  setStatusMsg("Please select an Excel file first");
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              disabled={!excelData}
            >
              Process Excel
            </button>
            <button
              type="button"
              onClick={() => window.open(`${API}/download/sample-report`, "_blank")}
              className="ml-auto px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 focus:outline-none"
            >
              Download Sample File
            </button>
          </div>
          {statusMsg && typeof statusMsg === "string" && (
            <div
              className={`p-3 rounded ${
                statusMsg.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}
            >
              {statusMsg}
            </div>
          )}
        </div>
      </div>

      {/* Details (single only) */}
      <div className="bg-white rounded shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Asset Details</h3>

        {!asset ? (
          <p className="text-gray-600 text-sm">Scan a single asset QR to load and edit the asset record.</p>
        ) : (
          <form onSubmit={onSave} className="space-y-6">
            {/* Institute / Department */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Institute</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  name="institute"
                  value={form.institute}
                  onChange={onChange}
                  required
                >
                  <option value="">Select Institute</option>
                  {institutes.map((institute) => (
                    <option key={institute} value={institute}>
                      {institute}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Department</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  name="department"
                  value={form.department}
                  onChange={onChange}
                  
                >
                  <option value="">Select Department</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Asset Name / Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Asset Name</label>
                <input
                  className="w-full border rounded px-3 py-2 bg-gray-50 cursor-not-allowed"
                  name="asset_name"
                  value={form.asset_name}
                  onChange={onChange}
                  placeholder="Asset Name"
                  
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Category</label>
                <input
                  className="w-full border rounded px-3 py-2 bg-gray-50 cursor-not-allowed"
                  name="category"
                  value={form.category}
                  onChange={onChange}
                  placeholder="Category"  
                />
              </div>
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm mb-1">Status *</label>
                <select className="w-full border rounded px-3 py-2" name="status" value={form.status} onChange={onChange} required>
                  <option value="">Select Status</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Design Specifications (LxWxH)</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="size_lxwxh"
                  value={form.size_lxwxh}
                  onChange={onChange}
                  placeholder="e.g., 30x20x10 cm"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Company / Model / Model No.</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="company_model"
                  value={form.company_model}
                  onChange={onChange}
                  placeholder="e.g., Dell Latitude 5420"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Serial No. (IT Asset)</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="it_serial_no"
                  value={form.it_serial_no}
                  onChange={onChange}
                  placeholder="Device Serial Number"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Dead Stock / Asset / Stock No.</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="dead_stock_no"
                  value={form.dead_stock_no}
                  onChange={onChange}
                  placeholder="Inventory Ledger No."
                />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm mb-1">Bill No.</label>
                <input className="w-full border rounded px-3 py-2" name="bill_no" value={form.bill_no} onChange={onChange} placeholder="Bill Number" />
              </div>

              <div>
                <label className="block text-sm mb-1">Vendor Name</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="vendor_name"
                  value={form.vendor_name}
                  onChange={onChange}
                  placeholder="Supplier / Seller"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Date of Purchase *</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  name="purchase_date"
                  value={form.purchase_date}
                  onChange={onChange}
                  placeholder="dd-mm-yyyy"
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Rate per Unit (Rs.)</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="rate_per_unit"
                  value={form.rate_per_unit}
                  onChange={onChange}
                  inputMode="decimal"
                  placeholder="e.g., 12500.00"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Purchase Order (PO) No.</label>
                <input className="w-full border rounded px-3 py-2" name="po_no" value={form.po_no} onChange={onChange} placeholder="PO Reference" />
              </div>
            </div>

            {/* Row 3 + Description */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1">Room No. / Location (short) *</label>
                <input className="w-full border rounded px-3 py-2" name="room_no" value={form.room_no} onChange={onChange} placeholder="Lab-101" required/>
              </div>

              <div>
                <label className="block text-sm mb-1">Name of Building</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  name="building_name"
                  value={form.building_name}
                  onChange={onChange}
                  placeholder="Main Academic Block"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Description</label>
                <textarea
                  className="w-full border rounded px-3 py-2 h-[42px] lg:h-auto"
                  name="desc"
                  value={form.desc}
                  onChange={onChange}
                  rows={1}
                  placeholder="Model, specs, condition..."
                />
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm mb-1">Assigned Type *</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  name="assigned_type"
                  value={form.assigned_type}
                  onChange={onChange}
                  required
                >
                  <option value="">Select Assigned Type</option>
                  {ASSIGNED_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Assigned To (Employee Name)</label>
                <input
                  className={`w-full border rounded px-3 py-2 ${form.assigned_type !== "individual" ? "bg-gray-50" : ""}`}
                  name="assigned_faculty_name"
                  value={form.assigned_faculty_name}
                  onChange={onChange}
                  placeholder="Dr. A B"
                  disabled={form.assigned_type !== "individual"}
                  required={form.assigned_type === "individual"}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Assigned To (Employee Code)</label>
                <input
                  className={`w-full border rounded px-3 py-2 ${form.assigned_type !== "individual" ? "bg-gray-50" : ""}`}
                  name="employee_code"
                  value={form.employee_code}
                  onChange={onChange}
                  placeholder="Employee Code"
                  disabled={form.assigned_type !== "individual"}
                  required={form.assigned_type === "individual"}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Assign Date *</label>
                <input type="date" className="w-full border rounded px-3 py-2" name="assign_date" value={form.assign_date} onChange={onChange} required/>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm mb-1">Remarks</label>
              <textarea className="w-full border rounded px-3 py-2" name="remarks" value={form.remarks} onChange={onChange} rows={3} />
            </div>

            {/* Verification */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" name="verified" checked={!!form.verified} onChange={onChange} required/>
                  Verified
                </label>
                {form.verification_date ? (
                  <p className="text-xs text-gray-500 mt-1">Last verification: {form.verification_date}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm mb-1">Verified By</label>
                <input className="w-full border rounded px-3 py-2" name="verified_by" value={form.verified_by} onChange={onChange} required/>
              </div>
            </div>

            <div className="text-sm text-gray-600">Registration Number: {asset?.registration_number}</div>

            <div className="flex gap-3">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                Save Changes
              </button>
              <button type="button" onClick={restartScanner} className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200">
                Scan Another
              </button>
            </div>
          </form>
        )}
        {statusMsg && typeof statusMsg === "object" && statusMsg.ok && (
          <p className="mt-3 text-sm text-green-600">{statusMsg.msg}</p>
        )}
      </div>
    </div>
  );
}





// // src/components/Scan.jsx
// import { useEffect, useRef, useState } from "react";
// import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
// import { useNavigate } from "react-router-dom";
// import * as XLSX from "xlsx";
// import { useAuth } from "../middle/AuthContext";

// const API = "http://localhost:5000";

// const STATUS_OPTIONS = ["Active", "Inactive", "Repair", "Scrape", "Damage"];
// const ASSIGNED_TYPE_OPTIONS = ["general", "individual"];
// const REG_RE = /^[A-Za-z0-9_-]+\/\d{14}\/\d{5,15}$/;
// const BULK_RE = /^[A-Z]{2,20}\/[A-Z]{2,20}\/\d{14}\/\d{4}$/;

// export default function Scan() {
//   const navigate = useNavigate();
//   const storedUser = JSON.parse(sessionStorage.getItem("user"));
//   const [mode, setMode] = useState(null); // "bulk" | "single" | null
//   const [scannedText, setScannedText] = useState("");
//   const [asset, setAsset] = useState(null);
//   const [qrDoc, setQrDoc] = useState(null);
//   const [statusMsg, setStatusMsg] = useState(null);
//   const [excelData, setExcelData] = useState(null);

//   // Function to handle Excel file import
//   const handleExcelImport = async (event) => {
//     if (!storedUser) {
//       setStatusMsg('Please log in to update assets');
//       navigate('/login');
//       return;
//     }

//     const file = event.target.files[0];
//     const reader = new FileReader();

//     reader.onload = async (e) => {
//       try {
//         const data = new Uint8Array(e.target.result);
//         const workbook = XLSX.read(data, { type: 'array' });
//         const sheetName = workbook.SheetNames[0];
//         const worksheet = workbook.Sheets[sheetName];
//         const jsonData = XLSX.utils.sheet_to_json(worksheet);

//         setExcelData(jsonData);
        
//         // Map Excel data to database fields and update assets
//         const updateResults = await Promise.all(
//           jsonData.map(async (row) => {
//             const mappedData = {
//               serial_no: row['Serial No'],
//               registration_number: row['Registration No'],
//               asset_name: row['Asset Name'],
//               category: row['Category'],
//               institute: row['Institute'],
//               department: row['Department'],
//               status: row['Status'],
//               size_lxwxh: row['Design Specifications (LxWxH)'],
//               company_model: row['Company / Model / Model No.'],
//               it_serial_no: row['Serial No. (IT Asset)'],
//               dead_stock_no: row['Dead Stock / Asset / Stock No.'],
//               bill_no: row['Bill No'],
//               vendor_name: row['Vendor Name'],
//               purchase_date: row['Date of Purchase'],
//               rate_per_unit: row['Rate per Unit (Rs.)'],
//               po_no: row['Purchase Order (PO) No.'],
//               room_no: row['Room No. / Location (short)'],
//               building_name: row['Name of Building'],
//               desc: row['Description'],
//               assigned_type: row['Assigned Type'],
//               assigned_faculty_name: row['Assigned Faculty Name'],
//               employee_code: row['Employee Code'],
//               assign_date: row['Assign Date'],
//               remarks: row['Remarks'],
//               verification_date: row['Verification Date'],
//               verified: row['Verified'],
//               verified_by: row['Verified By']
//             };

//             try {
//               if (!storedUser) {
//                 throw new Error('You must be logged in to update assets');
//               }

//               const response = await fetch(`${API}/api/assets/update-by-registration/${mappedData.registration_number}`, {
//                 method: 'PUT',
//                 headers: {
//                   'Content-Type': 'application/json',
//                 },
//                 credentials: 'include',
//                 body: JSON.stringify(mappedData)
//               });

//               if (!response.ok) {
//                 if (response.status === 401) {
//                   throw new Error('Unauthorized. Please log in again.');
//                 }
//                 throw new Error(`Failed to update asset with registration number: ${mappedData.registration_number}`);
//               }

//               return {
//                 registration_number: mappedData.registration_number,
//                 status: 'success'
//               };
//             } catch (error) {
//               return {
//                 registration_number: mappedData.registration_number,
//                 status: 'error',
//                 error: error.message
//               };
//             }
//           })
//         );

//         const successCount = updateResults.filter(result => result.status === 'success').length;
//         const errorCount = updateResults.filter(result => result.status === 'error').length;
        
//         setStatusMsg(`Updated ${successCount} assets successfully. ${errorCount} assets failed to update.`);
//       } catch (error) {
//         setStatusMsg(`Error processing Excel file: ${error.message}`);
//       }
//     };

//     reader.readAsArrayBuffer(file);
//   };

//   // Unified form aligned with AssetForm field list and alignment
//   const [form, setForm] = useState({
//     // Top: organization + identity
//     institute: "",
//     department: "",
//     asset_name: "",
//     category: "",

//     // Row 1 (AssetForm): core details
//     status: "active",
//     size_lxwxh: "",
//     company_model: "",
//     it_serial_no: "",
//     dead_stock_no: "",

//     // Row 2 (AssetForm): procurement
//     bill_no: "",
//     vendor_name: "",
//     purchase_date: "",
//     rate_per_unit: "",
//     po_no: "",

//     // Row 3 (AssetForm): location + desc
//     room_no: "",
//     building_name: "",
//     desc: "",

//     // Row 4 (AssetForm): assignment
//     assigned_type: "general",
//     assigned_faculty_name: "",
//     employee_code: "",
//     assign_date: "",

//     // Row 5 (AssetForm): remarks
//     remarks: "",

//     // Extra carried fields
//     location: "",

//     // Verification (kept at end)
//     verification_date: "",
//     verified: false,
//     verified_by: "",
//   });

//   const needsFaculty = form.assigned_type === "individual";

//   const scannerRef = useRef(null);
//   const fileQrRef = useRef(null);
//   const mountedRef = useRef(false);

//   useEffect(() => {
//     if (mountedRef.current) return;
//     mountedRef.current = true;

//     const initScanner = () => {
//       const config = { fps: 10, qrbox: 250, rememberLastUsedCamera: true };
//       const scanner = new Html5QrcodeScanner("qr-reader", config, false);

//       const onSuccess = async (decodedText) => {
//         try {
//           await scanner.clear();
//         } catch {}
//         handleDecodedText(decodedText);
//       };

//       const onError = () => {};

//       scanner.render(onSuccess, onError);
//       scannerRef.current = scanner;
//     };

//     initScanner();
//     fileQrRef.current = new Html5Qrcode("qr-reader-file-canvas", { verbose: false });

//     return () => {
//       (async () => {
//         try {
//           await scannerRef.current?.clear();
//         } catch {}
//         try {
//           if (fileQrRef.current?.isScanning) await fileQrRef.current.stop();
//           await fileQrRef.current?.clear();
//         } catch {}
//       })();
//     };
//   }, []);

//   // Map backend doc to the AssetForm sequence
//   const fillFormFromDoc = (doc) => {
//     const assignedType = (doc.assigned_type || "general").toLowerCase();
//     setForm({
//       institute: doc.institute || "",
//       department: doc.department || "",
//       asset_name: doc.asset_name || "",
//       category: doc.category || "",

//       status: doc.status || "active",
//       size_lxwxh: doc.size_lxwxh || "",
//       company_model: doc.company_model || "",
//       it_serial_no: doc.it_serial_no || "",
//       dead_stock_no: doc.dead_stock_no || "",

//       bill_no: doc.bill_no || "",
//       vendor_name: doc.vendor_name || "",
//       purchase_date: doc.purchase_date || "",
//       rate_per_unit: doc.rate_per_unit != null ? String(doc.rate_per_unit) : "",
//       po_no: doc.po_no || "",

//       room_no: doc.room_no || "",
//       building_name: doc.building_name || "",
//       desc: doc.desc || "",

//       assigned_type: assignedType,
//       assigned_faculty_name: assignedType === "individual" ? doc.assigned_faculty_name || "" : "",
//       employee_code: assignedType === "individual" ? doc.employee_code || "" : "",
//       assign_date: doc.assign_date || "",

//       remarks: doc.remarks || "",

//       location: doc.location || "",

//       verification_date: doc.verification_date || "",
//       verified: !!doc.verified,
//       verified_by: doc.verified_by || "",
//     });
//   };

//   const handleDecodedText = async (text) => {
//     setStatusMsg(null);
//     setMode(null);
//     setAsset(null);
//     setQrDoc(null);
//     setScannedText("");

//     const t = (text || "").trim();
//     if (!t) {
//       setStatusMsg({ ok: false, msg: "Invalid QR" });
//       return;
//     }

//     if (BULK_RE.test(t)) {
//       try {
//         const res = await fetch(`${API}/api/qr/by-id/${encodeURIComponent(t)}`, { credentials: "include" });
//         if (res.status === 401) {
//           navigate("/login", { replace: true });
//           return;
//         }
//         if (res.ok) {
//           const qr = await res.json();
//           setMode("bulk");
//           setQrDoc(qr);
//           setScannedText(t);
//           fillFormFromDoc(qr);
//           return;
//         }
//         setStatusMsg({ ok: false, msg: "QR not found" });
//         return;
//       } catch {
//         setStatusMsg({ ok: false, msg: "Network error" });
//         return;
//       }
//     }

//     if (!REG_RE.test(t)) {
//       setStatusMsg({ ok: false, msg: "Data not found" });
//       return;
//     }
//     setScannedText(t);
//     try {
//       const encoded = encodeURIComponent(t);
//       const res = await fetch(`${API}/api/assets/by-reg/${encoded}`, { credentials: "include" });
//       if (res.status === 401) {
//         navigate("/login", { replace: true });
//         return;
//       }
//       if (!res.ok) {
//         setStatusMsg({ ok: false, msg: "Not found" });
//         return;
//       }
//       const data = await res.json();
//       setMode("single");
//       setAsset(data);
//       fillFormFromDoc(data);
//     } catch {
//       setStatusMsg({ ok: false, msg: "Network error" });
//     }
//   };

//   const restartScanner = async () => {
//     setMode(null);
//     setScannedText("");
//     setAsset(null);
//     setQrDoc(null);
//     setStatusMsg(null);

//     try {
//       await scannerRef.current?.clear();
//     } catch {}

//     const el = document.getElementById("qr-reader");
//     if (el) while (el.firstChild) el.removeChild(el.firstChild);

//     const config = { fps: 10, qrbox: 250, rememberLastUsedCamera: true };
//     const scanner = new Html5QrcodeScanner("qr-reader", config, false);
//     scanner.render(
//       async (decodedText) => {
//         try {
//           await scanner.clear();
//         } catch {}
//         handleDecodedText(decodedText);
//       },
//       () => {}
//     );
//     scannerRef.current = scanner;
//   };

//   const onFileChange = async (e) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     setStatusMsg(null);
//     try {
//       const result = await fileQrRef.current.scanFile(file, true);
//       await fileQrRef.current.clear();
//       handleDecodedText(result);
//     } catch {
//       setStatusMsg({ ok: false, msg: "Unable to read QR from image" });
//     } finally {
//       e.target.value = "";
//     }
//   };

//   const onChange = (e) => {
//     const { name, value, type, checked } = e.target;
//     setForm((f) => {
//       if (name === "assigned_type") {
//         const nextType = value;
//         return {
//           ...f,
//           assigned_type: nextType,
//           assigned_faculty_name: nextType === "general" ? "" : f.assigned_faculty_name,
//           employee_code: nextType === "general" ? "" : f.employee_code,
//         };
//       }
//       if (type === "checkbox" && name === "verified") {
//         return { ...f, verified: !!checked };
//       }
//       if (name === "rate_per_unit") {
//         const onlyDigitsDot = value.replace(/[^\d.]/g, "");
//         return { ...f, rate_per_unit: onlyDigitsDot };
//       }
//       return { ...f, [name]: value };
//     });
//   };

//   const onSave = async (e) => {
//     e.preventDefault();
//     setStatusMsg(null);

//     const payload = {
//       // Top
//       institute: form.institute,
//       department: form.department,
//       asset_name: form.asset_name,
//       category: form.category,

//       // Row 1
//       status: form.status,
//       size_lxwxh: form.size_lxwxh,
//       company_model: form.company_model,
//       it_serial_no: form.it_serial_no,
//       dead_stock_no: form.dead_stock_no,

//       // Row 2
//       bill_no: form.bill_no,
//       vendor_name: form.vendor_name,
//       purchase_date: form.purchase_date,
//       rate_per_unit: form.rate_per_unit,
//       po_no: form.po_no,

//       // Row 3
//       room_no: form.room_no,
//       building_name: form.building_name,
//       desc: form.desc,

//       // Row 4
//       assigned_type: form.assigned_type,
//       assigned_faculty_name: needsFaculty ? form.assigned_faculty_name : "",
//       employee_code: needsFaculty ? form.employee_code : "",
//       assign_date: form.assign_date,

//       // Row 5
//       remarks: form.remarks,

//       // Extra carried fields
//       location: form.location,

//       // Verification (persisted in both modes)
//       verified: !!form.verified,
//       verified_by: form.verified_by,
//     };

//     try {
//       if (mode === "bulk" && qrDoc?.qr_id) {
//         const res = await fetch(`${API}/api/qr/${encodeURIComponent(qrDoc.qr_id)}`, {
//           method: "PATCH",
//           headers: { "Content-Type": "application/json" },
//           credentials: "include",
//           body: JSON.stringify(payload),
//         });
//         const data = await res.json();
//         if (!res.ok) {
//           setStatusMsg({ ok: false, msg: data.error || "Failed to save" });
//         } else {
//           setStatusMsg({ ok: true, msg: "Saved to QR registry" });
//           setQrDoc(data);
//           setForm((f) => ({ ...f, verification_date: data.verification_date || f.verification_date }));
//         }
//       } else if (mode === "single" && asset?._id) {
//         const res = await fetch(`${API}/api/assets/${asset._id}`, {
//           method: "PUT",
//           headers: { "Content-Type": "application/json" },
//           credentials: "include",
//           body: JSON.stringify(payload),
//         });
//         const data = await res.json();
//         if (!res.ok) {
//           setStatusMsg({ ok: false, msg: data.error || "Failed to update" });
//         } else {
//           setStatusMsg({ ok: true, msg: "Updated successfully" });
//           setAsset((a) => a && { ...a, ...payload, verification_date: data.verification_date || a.verification_date });
//           setForm((f) => ({ ...f, verification_date: data.verification_date || f.verification_date }));
//         }
//       }
//     } catch {
//       setStatusMsg({ ok: false, msg: "Network error" });
//     }
//   };



//   return (
//     <div className="max-w-6xl mx-auto p-6 space-y-6">
//       {/* Match AssetForm container width */}
//       {/* Excel Import Section */}
//       <div className="bg-white rounded shadow p-4">
//         <h2 className="text-xl font-semibold mb-3">Import Assets from Excel</h2>
//         <div className="space-y-4">
//           <div className="flex items-center gap-4">
//             <input
//               type="file"
//               accept=".xlsx,.xls"
//               onChange={(e) => {
//                 setStatusMsg(null);
//                 const file = e.target.files[0];
//                 if (file) {
//                   setExcelData(file);
//                 }
//               }}
//               className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
//             />
//             <button
//               onClick={() => {
//                 if (excelData) {
//                   handleExcelImport({ target: { files: [excelData] }});
//                 } else {
//                   setStatusMsg("Please select an Excel file first");
//                 }
//               }}
//               className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
//               disabled={!excelData}
//             >
//               Process Excel
//             </button>
//           </div>
//           {statusMsg && (
//             <div className={`p-3 rounded ${statusMsg.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
//               {statusMsg}
//             </div>
//           )}
//         </div>
//       </div>

//       {/* QR Scanner Section */}
//       <div className="bg-white rounded shadow p-4">
//         <h2 className="text-xl font-semibold mb-3">Scan QR</h2>
//         <div id="qr-reader" className="w-full max-w-md" />
//         <div className="mt-3 flex items-center gap-3 flex-wrap">
//           <span className="text-sm text-gray-600">Scanned: {scannedText || "-"}</span>
//           <button
//             onClick={restartScanner}
//             className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
//             type="button"
//           >
//             Scan
//           </button>
//           <label className="text-sm text-gray-600">
//             or upload image:
//             <input type="file" accept="image/*" onChange={onFileChange} className="ml-2 text-sm" />
//           </label>
//         </div>
//         {statusMsg && !statusMsg.ok && (
//           <div className="mt-3 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
//             {statusMsg.msg}
//           </div>
//         )}
//         <div id="qr-reader-file-canvas" style={{ display: "none" }} />
//       </div>

//       <div className="bg-white rounded shadow p-4">
//         <h3 className="text-lg font-semibold mb-3">
//           {mode === "bulk" ? "Bulk QR Details (QR Registry)" : mode === "single" ? "Asset Details" : "Details"}
//         </h3>

//         {!(mode === "bulk" || mode === "single") ? (
//           <p className="text-gray-600 text-sm">
//             Scan a QR code or upload an image; bulk QRs will load editable fields from the QR registry, single-asset
//             QRs will load the asset record.
//           </p>
//         ) : (
//           <form onSubmit={onSave} className="space-y-6">
//             {/* Institute / Department */}
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div>
//                 <label className="block text-sm mb-1">Institute</label>
//                 <input 
//                   className="w-full border rounded px-3 py-2"
//                   name="institute"
//                   value={form.institute}
//                   onChange={onChange}
//                   placeholder="Select Institute"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm mb-1">Department</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="department"
//                   value={form.department}
//                   onChange={onChange}
//                   placeholder="Select Department"
//                 />
//               </div>
//             </div>

//             {/* Asset Name / Category */}
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div>
//                 <label className="block text-sm mb-1">Asset Name</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="asset_name"
//                   value={form.asset_name}
//                   onChange={onChange}
//                   placeholder="Asset Name"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm mb-1">Category</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="category"
//                   value={form.category}
//                   onChange={onChange}
//                   placeholder="Category"
//                 />
//               </div>
//             </div>

//             {/* Row 1: 1–5 */}
//             <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
//               <div>
//                 <label className="block text-sm mb-1">Status</label>
//                 <select
//                   className="w-full border rounded px-3 py-2"
//                   name="status"
//                   value={form.status}
//                   onChange={onChange}
//                   required
//                 >
//                   <option value="" >
//                     Select Status
//                   </option>
//                   {STATUS_OPTIONS.map((s) => (
//                     <option key={s} value={s}>
//                       {s}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Design Specifications (LxWxH)</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="size_lxwxh"
//                   value={form.size_lxwxh}
//                   onChange={onChange}
//                   placeholder="e.g., 30x20x10 cm"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Company / Model / Model No.</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="company_model"
//                   value={form.company_model}
//                   onChange={onChange}
//                   placeholder="e.g., Dell Latitude 5420"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Serial No. (IT Asset)</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="it_serial_no"
//                   value={form.it_serial_no}
//                   onChange={onChange}
//                   placeholder="Device Serial Number"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Dead Stock / Asset / Stock No.</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="dead_stock_no"
//                   value={form.dead_stock_no}
//                   onChange={onChange}
//                   placeholder="Inventory Ledger No."
//                 />
//               </div>
//             </div>

//             {/* Row 2: 6–10 */}
//             <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
//               <div>
//                 <label className="block text-sm mb-1">Bill No.</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="bill_no"
//                   value={form.bill_no}
//                   onChange={onChange}
//                   placeholder="Bill Number"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Vendor Name</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="vendor_name"
//                   value={form.vendor_name}
//                   onChange={onChange}
//                   placeholder="Supplier / Seller"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Date of Purchase</label>
//                 <input
//                   type="date"
//                   className="w-full border rounded px-3 py-2"
//                   name="purchase_date"
//                   value={form.purchase_date}
//                   onChange={onChange}
//                   placeholder="dd-mm-yyyy"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Rate per Unit (Rs.)</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="rate_per_unit"
//                   value={form.rate_per_unit}
//                   onChange={onChange}
//                   inputMode="decimal"
//                   placeholder="e.g., 12500.00"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Purchase Order (PO) No.</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="po_no"
//                   value={form.po_no}
//                   onChange={onChange}
//                   placeholder="PO Reference"
//                 />
//               </div>
//             </div>

//             {/* Row 3: 11–12 + Description */}
//             <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
//               <div>
//                 <label className="block text-sm mb-1">Room No. / Location (short)</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="room_no"
//                   value={form.room_no}
//                   onChange={onChange}
//                   placeholder="Lab-101"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Name of Building</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="building_name"
//                   value={form.building_name}
//                   onChange={onChange}
//                   placeholder="Main Academic Block"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Description</label>
//                 <textarea
//                   className="w-full border rounded px-3 py-2 h-[42px] lg:h-auto"
//                   name="desc"
//                   value={form.desc}
//                   onChange={onChange}
//                   rows={1}
//                   placeholder="Model, specs, condition..."
//                 />
//               </div>
//             </div>

//             {/* Row 4: 13–16 */}
//             <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
//               <div>
//                 <label className="block text-sm mb-1">Assigned Type</label>
//                 <select
//                   className="w-full border rounded px-3 py-2"
//                   name="assigned_type"
//                   value={form.assigned_type}
//                   onChange={onChange}
//                   required
//                 >
//                   <option value="" >
//                     Select Assigned Type
//                   </option>
//                   {ASSIGNED_TYPE_OPTIONS.map((t) => (
//                     <option key={t} value={t}>
//                       {t}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Assigned To (Employee Name)</label>
//                 <input
//                   className={`w-full border rounded px-3 py-2 ${form.assigned_type !== "individual" ? "bg-gray-50" : ""}`}
//                   name="assigned_faculty_name"
//                   value={form.assigned_faculty_name}
//                   onChange={onChange}
//                   placeholder="Dr. A B"
//                   disabled={form.assigned_type !== "individual"}
//                   required={form.assigned_type === "individual"}
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Assigned To (Employee Code)</label>
//                 <input
//                   className={`w-full border rounded px-3 py-2 ${form.assigned_type !== "individual" ? "bg-gray-50" : ""}`}
//                   name="employee_code"
//                   value={form.employee_code}
//                   onChange={onChange}
//                   placeholder="Employee Code"
//                   disabled={form.assigned_type !== "individual"}
//                   required={form.assigned_type === "individual"}
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm mb-1">Assign Date</label>
//                 <input
//                   type="date"
//                   className="w-full border rounded px-3 py-2"
//                   name="assign_date"
//                   value={form.assign_date}
//                   onChange={onChange}
//                   placeholder="dd-mm-yyyy"
//                 />
//               </div>
//             </div>

//             {/* Row 5: Remarks */}
//             <div>
//               <label className="block text-sm mb-1">Remarks</label>
//               <textarea
//                 className="w-full border rounded px-3 py-2"
//                 name="remarks"
//                 value={form.remarks}
//                 onChange={onChange}
//                 rows={3}
//                 placeholder="Any additional notes or remarks"
//               />
//             </div>

//             {/* Verification (kept at end, outside AssetForm rows) */}
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div>
//                 <label className="inline-flex items-center gap-2 text-sm">
//                   <input type="checkbox" name="verified" checked={!!form.verified} onChange={onChange} />
//                   Verified
//                 </label>
//                 {form.verification_date ? (
//                   <p className="text-xs text-gray-500 mt-1">Last verification: {form.verification_date}</p>
//                 ) : null}
//               </div>
//               <div>
//                 <label className="block text-sm mb-1">Verified By</label>
//                 <input
//                   className="w-full border rounded px-3 py-2"
//                   name="verified_by"
//                   value={form.verified_by}
//                   onChange={onChange}
//                 />
//               </div>
//             </div>

//             <div className="text-sm text-gray-600">
//               {mode === "single" ? <>Registration Number: {asset?.registration_number}</> : <>QR ID: {qrDoc?.qr_id}</>}
//             </div>

//             <div className="flex gap-3">
//               <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
//                 Save Changes
//               </button>
//               <button
//                 type="button"
//                 onClick={restartScanner}
//                 className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200"
//               >
//                 Scan Another
//               </button>
//             </div>
//           </form>
//         )}
//         {statusMsg && statusMsg.ok && <p className="mt-3 text-sm text-green-600">{statusMsg.msg}</p>}
//       </div>

//     </div>
//   );
// }
