// src/components/AssetForm.jsx
import React, { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import QRCodeLib from "qrcode";

const API = "http://localhost:5000";
const STATUS_OPTIONS = ["active", "inactive", "repair", "scrape", "damage"];
const ASSIGNED_TYPE_OPTIONS = ["general", "individual"];
const ASSET_CATEGORY_MAP = {
  "Bench (2 Seater)": "Furniture", "Bench (3 Seater)": "Furniture",
  "Chair (High Back Revolving)": "Furniture", "Chair (Low Back Fixed)": "Furniture",
  "Chair (Low Back Revolving)": "Furniture", "Chair (Plastic)": "Furniture",
  "Computer Table": "Furniture", "Cupboard (Big)": "Furniture",
  "Cupboard (Small)": "Furniture", "Sofa (3 Seater)": "Furniture",
  "Sofa (2 Seater)": "Furniture", "Stool (Wooden 4 lag)": "Furniture",
  "Table Lab": "Furniture", "Table Side (L120 cm)": "Furniture",
  "Table Side (L180 cm)": "Furniture", "Table Staff (L120 cm)": "Furniture",
  "Table Staff (L150 cm)": "Furniture", "Table Staff (L180 cm)": "Furniture",
  "Desktop - CPU": "IT Asset", "Desktop - Monitor": "IT Asset",
  "Printer": "IT Asset", "Printer - Multi function": "IT Asset",
  "Scanner": "IT Asset", "Xerox Machine": "IT Asset", "Laptop": "IT Asset"
};

export default function AssetForm() {
  const [form, setForm] = useState({
    asset_name: "",
    category: "",
    location: "",
    assign_date: "",
    status: "",
    desc: "",
    institute: "",
    department: "",
    assigned_type: "",
    assigned_faculty_name: "",
    employee_code: "",
    bill_no: "",
    quantity: 1,
  });

  // Dynamic dropdowns (all fetched!)
  const [assetNames, setAssetNames] = useState([]);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [instituteOptions, setInstituteOptions] = useState([]);
  const [showAddInstitute, setShowAddInstitute] = useState(false);
  const [newInstitute, setNewInstitute] = useState("");
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [newDepartment, setNewDepartment] = useState("");
  const [statusMsg, setStatusMsg] = useState(null);
  const [created, setCreated] = useState([]);
  const [nextSerial, setNextSerial] = useState(null);
  const [generateReport, setGenerateReport] = useState(false);
  const [generateQrPdf, setGenerateQrPdf] = useState(false);
  const [assetLink, setAssetLink] = useState(false);

  // Fetch all dropdown options on mount
  useEffect(() => {
    async function fetchDropdowns() {
      try {
        const [an, ins, dep] = await Promise.all([
          fetch(`${API}/api/setup/asset-names`).then(r => r.json()),
          fetch(`${API}/api/setup/institutes`).then(r => r.json()),
          fetch(`${API}/api/setup/departments`).then(r => r.json())
        ]);
        setAssetNames(an);
        setInstituteOptions(ins);
        setDepartmentOptions(dep);
      } catch {
        setAssetNames([]);
        setInstituteOptions([]);
        setDepartmentOptions([]);
      }
    }
    fetchDropdowns();
    async function fetchNextSerial() {
      try {
        const res = await fetch(`${API}/api/assets/max-serial`);
        const data = await res.json();
        setNextSerial(data.next_serial);
      } catch {
        setNextSerial("Error");
      }
    }
    fetchNextSerial();
  }, []);

  const needsFaculty = useMemo(() => form.assigned_type === "individual", [form.assigned_type]);

  // --- Asset Name dropdown and add ---
  const onDropdownChange = (e) => {
    const asset_name = e.target.value;
    const category = ASSET_CATEGORY_MAP[asset_name] || "";
    setForm((f) => ({ ...f, asset_name, category }));
  };
  const onAddCustomAsset = () => { setShowAddAsset(true); setNewAssetName(""); };
  const onAddNewAssetToList = (e) => {
    e.preventDefault();
    const name = newAssetName.trim();
    if (!name) return;
    setAssetNames((prev) => prev.includes(name) ? prev : [...prev, name]); // local only
    setForm((f) => ({ ...f, asset_name: name, category: "" }));
    setShowAddAsset(false);
    setNewAssetName("");
  };
  const onCancelAddAsset = () => { setShowAddAsset(false); setNewAssetName(""); };
  // Institute
  const onInstituteChange = (e) => { setForm((f) => ({ ...f, institute: e.target.value })); };
  const onAddNewInstitute = (e) => {
    e.preventDefault();
    const name = newInstitute.trim();
    if (!name) return;
    setInstituteOptions((prev) => prev.includes(name) ? prev : [...prev, name]); // local only
    setForm((f) => ({ ...f, institute: name }));
    setShowAddInstitute(false);
    setNewInstitute("");
  };
  const onCancelAddInstitute = () => { setShowAddInstitute(false); setNewInstitute(""); };
  // Department
  const onDepartmentChange = (e) => { setForm((f) => ({ ...f, department: e.target.value })); };
  const onAddNewDepartment = (e) => {
    e.preventDefault();
    const name = newDepartment.trim();
    if (!name) return;
    setDepartmentOptions((prev) => prev.includes(name) ? prev : [...prev, name]);
    setForm((f) => ({ ...f, department: name }));
    setShowAddDepartment(false);
    setNewDepartment("");
  };
  const onCancelAddDepartment = () => { setShowAddDepartment(false); setNewDepartment(""); };

  // ...Unchanged: onChange, validate, export, QR code, submit, and UI layout...
  // (Keep the rest of your file completely unchanged from your previous AssetForm implementation)

  // -------------------
  // Generic onChange
  // -------------------
  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "generateReport") {
      setGenerateReport(checked);
      return;
    }
    if (name === "generateQrPdf") {
      setGenerateQrPdf(checked);
      return;
    }
    setForm((f) => {
      if (name === "quantity") {
        const q = Math.max(1, parseInt(value || "1", 10));
        return { ...f, quantity: q };
      }
      if (type === "checkbox") {
        return { ...f, [name]: checked };
      }
      if (name === "assigned_type") {
        return {
          ...f,
          assigned_type: value,
          assigned_faculty_name: value === "general" ? "" : f.assigned_faculty_name,
          employee_code: value === "general" ? "" : f.employee_code,
        };
      }
      if (name === "category") {
        return f; // read-only derived field
      }
      return { ...f, [name]: value };
    });
  };

  // -------------------
  // Validation
  // -------------------
  const validate = () => {
    const errors = [];
    if (!form.asset_name.trim()) errors.push("Asset Name is required");
    if (!form.category.trim()) errors.push("Category is required");
    if (!form.institute.trim()) errors.push("Institute is required");
    if (!form.department.trim()) errors.push("Department is required");
    if (needsFaculty && !form.assigned_faculty_name.trim()) {
      errors.push("Assigned Faculty Name is required for 'individual'");
    }
    if (needsFaculty && !form.employee_code.trim()) {
      errors.push("Employee Code is required for 'individual'");
    }
    if (form.quantity < 1) errors.push("Quantity must be at least 1");
    return errors;
  };

  // -------------------
  // Excel export
  // -------------------
  const generateExcelForAssets = (assets) => {
    if (!assets || !assets.length) return;
    const ws = XLSX.utils.json_to_sheet(
      assets.map(a => ({
        "Serial No": a.serial_no,
        "Registration #": a.registration_number,
        "Asset Name": a.asset_name,
        "Category": a.category,
        "Location": a.location,
        "Assign Date": a.assign_date,
        "Status": a.status,
        "Desc": a.desc,
        "Verification Date": a.verification_date || "",
        "Verified": a.verified ? "Yes" : "No",
        "Verified By": a.verified_by || "",
        "Institute": a.institute,
        "Department": a.department,
        "Assigned Type": a.assigned_type,
        "Assigned Faculty": a.assigned_faculty_name,
        "Employee Code": a.employee_code,
        "Bill No": a.bill_no,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Added Assets");
    XLSX.writeFile(wb, "recent-assets.xlsx");
  };

  // -------------------
  // QR generation + PDF (jsPDF)
  // -------------------
  async function generateQrPng(text, size) {
    try {
      return await QRCodeLib.toDataURL(text, { width: size, margin: 1 });
    } catch (err) {
      console.error("QR Code generation error:", err);
      return null;
    }
  }

  async function downloadAllQrPdf(rows, sizeOption = "Medium") {
    if (!rows || !rows.length) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    const marginX = 16;
    const marginY = 20;
    const pageWidth = 210;
    const pageHeight = 297;
    const padding = 10;

    let perRow, labelFontSize;
    if (sizeOption === "Small") {
      perRow = 5;
      labelFontSize = 7;
    } else if (sizeOption === "Medium") {
      perRow = 4;
      labelFontSize = 9;
    } else {
      perRow = 3;
      labelFontSize = 11;
    }

    const qrSize = (pageWidth - marginX * 2 - padding * (perRow - 1)) / perRow;
    let x = marginX;
    let y = marginY;
    let col = 0;

    let lastRowY = 0;
    let lastBlockHeight = 0;

    function drawDottedLines(rowY, blockHeight) {
      const dashLength = 2;
      let startX = marginX;
      let lineY = rowY + blockHeight + 4;
      doc.setLineDash([dashLength, dashLength]);
      while (startX < pageWidth - marginX) {
        doc.line(startX, lineY, startX + dashLength, lineY);
        startX += dashLength * 2;
      }
      for (let colIndex = 1; colIndex < perRow; colIndex++) {
        const lineX = marginX + colIndex * (qrSize + padding) - padding / 2;
        let currentDotY = rowY - 2;
        while (currentDotY < lineY + padding) {
          doc.line(lineX, currentDotY, lineX, currentDotY + dashLength);
          currentDotY += dashLength * 2;
        }
      }
      doc.setLineDash([]);
    }

    for (let i = 0; i < rows.length; i++) {
      const asset = rows[i];
      const qrText = asset.registration_number || "";
      const serialText = asset.serial_no != null ? `Serial No ${asset.serial_no}` : "No Serial";
      const qrUrl = await generateQrPng(qrText, Math.round(qrSize * 4)); // multiply for good resolution
      if (qrUrl) {
        doc.addImage(qrUrl, "PNG", x, y, qrSize, qrSize);
      }
      const smallerFontSize = Math.round(labelFontSize * 0.66 * 10) / 10;
      doc.setFontSize(smallerFontSize);
      const serialWidth = doc.getStringUnitWidth(serialText) * smallerFontSize / doc.internal.scaleFactor;
      const serialX = x + (qrSize - serialWidth) / 2;
      const serialY = y + qrSize + 2;
      doc.text(serialText, serialX, serialY);
      const label = (qrText && qrText !== "1") ? qrText : "";
      const labelLines = label ? doc.splitTextToSize(label, qrSize) : [];
      const lineHeight = smallerFontSize * 0.9;
      const totalLabelHeight = labelLines.length * lineHeight;
      for (let j = 0; j < labelLines.length; j++) {
        const line = labelLines[j];
        const lineWidth = doc.getStringUnitWidth(line) * smallerFontSize / doc.internal.scaleFactor;
        const textX = x + (qrSize - lineWidth) / 2;
        doc.text(line, textX, serialY + ((j + 1) * lineHeight));
      }
      lastRowY = y;
      lastBlockHeight = qrSize + smallerFontSize / 2 + totalLabelHeight;
      col++;
      if (col >= perRow) {
        drawDottedLines(y, lastBlockHeight);
        col = 0;
        x = marginX;
        y += lastBlockHeight + padding + 2;
        if (y + qrSize + totalLabelHeight > pageHeight - marginY) {
          doc.addPage('a4', 'p');
          y = marginY;
        }
      } else {
        x += qrSize + padding;
      }
    }
    if (col > 0) {
      drawDottedLines(lastRowY, lastBlockHeight);
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    doc.save(`all_asset_qr_codes_${stamp}.pdf`);
  }

  // -------------------
  // Submit
  // -------------------
  const onSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg(null);
    setCreated([]);
    const errors = validate();
    if (errors.length) {
      setStatusMsg({ ok: false, msg: errors.join(". ") });
      return;
    }
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
        employee_code: needsFaculty ? form.employee_code : "",
        bill_no: form.bill_no,
        quantity: form.quantity,
      };
      const res = await fetch(`${API}/api/assets/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ ok: false, msg: data.error || "Failed to create assets" });
      } else {
        setStatusMsg({ ok: true, msg: `Created ${data.count} assets` });
        setCreated(Array.isArray(data.items) ? data.items : []);
        setForm({
          asset_name: "",
          category: "",
          location: "",
          assign_date: "",
          status: "active",
          desc: "",
          institute: "",
          department: "",
          assigned_type: "general",
          assigned_faculty_name: "",
          employee_code: "",
          bill_no: "",
          quantity: 1,
        });
        setNextSerial((prev) => (typeof prev === "number" ? prev + data.count : prev));
        if (generateReport && data.items && data.items.length) {
          generateExcelForAssets(data.items);
        }
        if (generateQrPdf && data.items && data.items.length) {
          await downloadAllQrPdf(data.items);
        }
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ ok: false, msg: "Network error" });
    }
  };

  // -------------------
  // UI
  // -------------------
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Add Assets</h2>
        <span className="text-md font-mono text-indigo-700">
          Serial No is: {nextSerial !== null ? nextSerial : "Loading..."}
        </span>
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* First row: Institute and Department (dropdown + add) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="institute" className="block text-sm mb-1">Institute</label>
            <div className="flex gap-2 items-center">
              <select
                id="institute"
                className="w-full border rounded px-3 py-2"
                name="institute"
                value={form.institute}
                onChange={onInstituteChange}
                required
              >
                <option value="">Select Institute...</option>
                {instituteOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddInstitute(true)}
                className="px-3 text-indigo-600 border border-indigo-400 rounded hover:bg-indigo-50"
                tabIndex={-1}
                title="Add new institute"
                style={{ fontWeight: "bold", fontSize: 18 }}
              >
                +
              </button>
            </div>
            {showAddInstitute && (
              <form onSubmit={onAddNewInstitute} className="flex gap-2 mt-2" noValidate>
                <input
                  className="flex-1 border rounded px-3 py-2"
                  value={newInstitute}
                  placeholder="Enter new institute"
                  onChange={e => setNewInstitute(e.target.value)}
                  autoFocus
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={onCancelAddInstitute}
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                  tabIndex={-1}
                >
                  Cancel
                </button>
              </form>
            )}
          </div>

          <div>
            <label htmlFor="department" className="block text-sm mb-1">Department</label>
            <div className="flex gap-2 items-center">
              <select
                id="department"
                className="w-full border rounded px-3 py-2"
                name="department"
                value={form.department}
                onChange={onDepartmentChange}
                required
              >
                <option value="">Select Department...</option>
                {departmentOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddDepartment(true)}
                className="px-3 text-indigo-600 border border-indigo-400 rounded hover:bg-indigo-50"
                tabIndex={-1}
                title="Add new department"
                style={{ fontWeight: "bold", fontSize: 18 }}
              >
                +
              </button>
            </div>
            {showAddDepartment && (
              <form onSubmit={onAddNewDepartment} className="flex gap-2 mt-2" noValidate>
                <input
                  className="flex-1 border rounded px-3 py-2"
                  value={newDepartment}
                  placeholder="Enter new department"
                  onChange={e => setNewDepartment(e.target.value)}
                  autoFocus
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={onCancelAddDepartment}
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                  tabIndex={-1}
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Second row: Asset Name and Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="asset_name" className="block text-sm mb-1">Asset Name</label>
            <div className="flex gap-2 items-center">
              <select
                id="asset_name"
                className="w-full border rounded px-3 py-2"
                name="asset_name"
                value={form.asset_name}
                onChange={onDropdownChange}
                required
              >
                <option value="">Select Asset Name...</option>
                {assetNames.map((an) => (
                  <option key={an} value={an}>{an}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={onAddCustomAsset}
                className="px-3 text-indigo-600 border border-indigo-400 rounded hover:bg-indigo-50"
                tabIndex={-1}
                title="Add new asset name"
                style={{ fontWeight: "bold", fontSize: 18 }}
              >
                +
              </button>
            </div>
            {showAddAsset && (
              <form onSubmit={onAddNewAssetToList} className="flex gap-2 mt-2" noValidate>
                <input
                  className="flex-1 border rounded px-3 py-2"
                  value={newAssetName}
                  placeholder="Enter new asset name"
                  onChange={(e) => setNewAssetName(e.target.value)}
                  autoFocus
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={onCancelAddAsset}
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                  tabIndex={-1}
                >
                  Cancel
                </button>
              </form>
            )}
          </div>

          <div>
            <label htmlFor="category" className="block text-sm mb-1">Category</label>
            <input
              id="category"
              type="text"
              className="w-full border rounded bg-gray-100 px-3 py-2 cursor-not-allowed"
              name="category"
              value={form.category}
              readOnly
              tabIndex={-1}
              aria-readonly="true"
            />
          </div>
        </div>

        {/* Quantity */}
        <div className="mt-2">
          <label htmlFor="quantity" className="block text-sm mb-1">Quantity</label>
          <input
            id="quantity"
            type="number"
            className="w-full border rounded px-3 py-2"
            name="quantity"
            min={1}
            value={form.quantity}
            onChange={onChange}
            required
          />
        </div>

        {/* Radio for asset link */}
        <div className="mt-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="assetLink"
              checked={assetLink}
              onChange={() => setAssetLink(true)}
            />
            <span className="ml-2 text-sm">Link Asset / Enter Details</span>
          </label>
          <label className="inline-flex items-center ml-8">
            <input
              type="radio"
              name="assetLink"
              checked={!assetLink}
              onChange={() => setAssetLink(false)}
            />
            <span className="ml-2 text-sm">No Link / Skip Details</span>
          </label>
        </div>

        {/* Conditional fields when assetLink selected */}
        {assetLink && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <label htmlFor="location" className="block text-sm mb-1">Location</label>
                <input
                  id="location"
                  className="w-full border rounded px-3 py-2"
                  name="location"
                  value={form.location}
                  onChange={onChange}
                  placeholder="Lab-101"
                  required
                />
              </div>
              <div>
                <label htmlFor="assign_date" className="block text-sm mb-1">Assign Date</label>
                <input
                  id="assign_date"
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  name="assign_date"
                  required
                  value={form.assign_date}
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="block text-sm mb-1">Status</label>
                <select
                  id="status"
                  className="w-full border rounded px-3 py-2"
                  name="status"
                  value={form.status}
                  onChange={onChange}
                  required
                >
                  <option value="" disabled>
                    Select Status
                  </option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="desc" className="block text-sm mb-1">Description</label>
                <textarea
                  id="desc"
                  className="w-full border rounded px-3 py-2"
                  name="desc"
                  value={form.desc}
                  onChange={onChange}
                  rows={3}
                  placeholder="Model, specs, condition..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="assigned_type" className="block text-sm mb-1">Assigned Type</label>
                <select
                  id="assigned_type"
                  className="w-full border rounded px-3 py-2"
                  name="assigned_type"
                  value={form.assigned_type}
                  onChange={onChange}
                  required
                >
                  <option value="" disabled>
                    Select Assigned Type
                  </option>
                  {ASSIGNED_TYPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`${form.assigned_type === "individual" ? "" : "opacity-60"}`}>
                <label htmlFor="assigned_faculty_name" className="block text-sm mb-1">
                  Assigned Faculty Name
                </label>
                <input
                  id="assigned_faculty_name"
                  className="w-full border rounded px-3 py-2"
                  name="assigned_faculty_name"
                  value={form.assigned_faculty_name}
                  onChange={onChange}
                  placeholder="Dr. A B"
                  disabled={form.assigned_type !== "individual"}
                  required={form.assigned_type === "individual"}
                />
              </div>

              <div className={`${form.assigned_type === "individual" ? "" : "opacity-60"}`}>
                <label htmlFor="employee_code" className="block text-sm mb-1">
                  Employee Code
                </label>
                <input
                  id="employee_code"
                  className="w-full border rounded px-3 py-2"
                  name="employee_code"
                  value={form.employee_code || ""}
                  onChange={onChange}
                  placeholder="Employee Code"
                  disabled={form.assigned_type !== "individual"}
                  required={form.assigned_type === "individual"}
                />
              </div>

              <div>
                <label htmlFor="bill_no" className="block text-sm mb-1">Bill No</label>
                <input
                  id="bill_no"
                  className="w-full border rounded px-3 py-2"
                  name="bill_no"
                  value={form.bill_no || ""}
                  onChange={onChange}
                  placeholder="Bill Number"
                />
              </div>
            </div>
          </>
        )}

        {/* Report & QR checkboxes */}
        <div className="flex items-center gap-3 mt-2">
          <input
            type="checkbox"
            id="generateReport"
            name="generateReport"
            checked={generateReport}
            onChange={onChange}
            className="mr-2"
          />
          <label htmlFor="generateReport" className="text-sm">
            If you want to generate a report for the recently added asset(s), check this box.
          </label>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <input
            type="checkbox"
            id="generateQrPdf"
            name="generateQrPdf"
            checked={generateQrPdf}
            onChange={onChange}
            className="mr-2"
          />
          <label htmlFor="generateQrPdf" className="text-sm">
            If you want to generate a QR code PDF, click here.
          </label>
        </div>

        <button
          type="submit"
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 mt-4"
        >
          Save
        </button>
      </form>

      {statusMsg && (
        <p className={`mt-3 ${statusMsg.ok ? "text-green-600" : "text-red-600"}`}>
          {statusMsg.msg}
        </p>
      )}

      {created.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Generated Registration Numbers</h3>
          <ul className="list-disc pl-5 space-y-1">
            {created.map((it) => (
              <li key={it._id ?? it.registration_number} className="font-mono text-sm">
                {it.registration_number} — {it.asset_name} @ {it.location} [{it.status}]
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}



// // src/components/AssetForm.jsx

// import { useMemo, useState } from "react";

// const API = "http://localhost:5000";

// const STATUS_OPTIONS = ["active", "inactive", "repair", "scrape", "damage"];
// const ASSIGNED_TYPE_OPTIONS = ["general", "individual"];

// export default function AssetForm() {
//   const [form, setForm] = useState({
//     asset_name: "",
//     category: "",
//     location: "",
//     assign_date: "",               // optional (YYYY-MM-DD)
//     status: "active",
//     desc: "",                      // optional
//     institute: "",                 // optional
//     department: "",                // optional
//     assigned_type: "general",
//     assigned_faculty_name: "",
//     quantity: 1,
//   });

//   const [statusMsg, setStatusMsg] = useState(null);
//   const [created, setCreated] = useState([]);

//   const needsFaculty = useMemo(
//     () => form.assigned_type === "individual",
//     [form.assigned_type]
//   );

//   const onChange = (e) => {
//     const { name, value, type, checked } = e.target;
//     setForm((f) => {
//       if (name === "quantity") {
//         const q = Math.max(1, parseInt(value || "1", 10));
//         return { ...f, quantity: q };
//       }
//       if (type === "checkbox") {
//         return { ...f, [name]: checked };
//       }
//       if (name === "assigned_type") {
//         return {
//           ...f,
//           assigned_type: value,
//           assigned_faculty_name: value === "general" ? "" : f.assigned_faculty_name,
//         };
//       }
//       return { ...f, [name]: value };
//     });
//   };

//   const validate = () => {
//     const errors = [];
//     if (!form.asset_name.trim()) errors.push("Asset Name is required");
//     if (!form.category.trim()) errors.push("Category is required");
//     if (!form.location.trim()) errors.push("Location is required");
//     if (!STATUS_OPTIONS.includes(form.status)) errors.push("Invalid status");
//     if (!ASSIGNED_TYPE_OPTIONS.includes(form.assigned_type)) errors.push("Invalid assigned type");
//     if (needsFaculty && !form.assigned_faculty_name.trim()) {
//       errors.push("Assigned Faculty Name is required for 'individual'");
//     }
//     if (form.quantity < 1) errors.push("Quantity must be at least 1");
//     return errors;
//   };

//   const onSubmit = async (e) => {
//     e.preventDefault();
//     setStatusMsg(null);
//     setCreated([]);

//     const errors = validate();
//     if (errors.length) {
//       setStatusMsg({ ok: false, msg: errors.join(". ") });
//       return;
//     }

//     try {
//       // Do NOT send verification_date, verified, or verified_by — backend sets defaults
//       const payload = {
//         asset_name: form.asset_name,
//         category: form.category,
//         location: form.location,
//         assign_date: form.assign_date,
//         status: form.status,
//         desc: form.desc,
//         institute: form.institute,
//         department: form.department,
//         assigned_type: form.assigned_type,
//         assigned_faculty_name: needsFaculty ? form.assigned_faculty_name : "",
//         quantity: form.quantity,
//       };

//       const res = await fetch(`${API}/api/assets/bulk`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         credentials: "include",
//         body: JSON.stringify(payload),
//       });
//       const data = await res.json();

//       if (!res.ok) {
//         setStatusMsg({ ok: false, msg: data.error || "Failed to create assets" });
//       } else {
//         setStatusMsg({ ok: true, msg: `Created ${data.count} assets` });
//         setCreated(Array.isArray(data.items) ? data.items : []);
//         setForm({
//           asset_name: "",
//           category: "",
//           location: "",
//           assign_date: "",
//           status: "active",
//           desc: "",
//           institute: "",
//           department: "",
//           assigned_type: "general",
//           assigned_faculty_name: "",
//           quantity: 1,
//         });
//       }
//     } catch {
//       setStatusMsg({ ok: false, msg: "Network error" });
//     }
//   };

//   return (
//     <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow">
//       <h2 className="text-xl font-semibold mb-4">Add Assets</h2>

//       <form onSubmit={onSubmit} className="space-y-6">
//         {/* Primary details */}
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div>
//             <label className="block text-sm mb-1">Asset Name</label>
//             <input
//               className="w-full border rounded px-3 py-2"
//               name="asset_name"
//               value={form.asset_name}
//               onChange={onChange}
//               placeholder="Laptop"
//               required
//             />
//           </div>

//           <div>
//             <label className="block text-sm mb-1">Category</label>
//             <input
//               className="w-full border rounded px-3 py-2"
//               name="category"
//               value={form.category}
//               onChange={onChange}
//               placeholder="Electronics / Stationary"
//               required
//             />
//           </div>

//           <div>
//             <label className="block text-sm mb-1">Location</label>
//             <input
//               className="w-full border rounded px-3 py-2"
//               name="location"
//               value={form.location}
//               onChange={onChange}
//               placeholder="Lab-101"
//               required
//             />
//           </div>

//           <div>
//             <label className="block text-sm mb-1">Assign Date</label>
//             <input
//               type="date"
//               className="w-full border rounded px-3 py-2"
//               name="assign_date"
//               required
//               value={form.assign_date}
//               onChange={onChange}
//             />
//           </div>
//         </div>

//         {/* Status and description */}
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div>
//             <label className="block text-sm mb-1">Status</label>
//             <select
//               className="w-full border rounded px-3 py-2"
//               name="status"
//               value={form.status}
//               onChange={onChange}
//               required
//             >
//               {STATUS_OPTIONS.map((s) => (
//                 <option key={s} value={s}>{s}</option>
//               ))}
//             </select>
//           </div>

//           <div>
//             <label className="block text-sm mb-1">Description</label>
//             <textarea
//               className="w-full border rounded px-3 py-2"
//               name="desc"
//               value={form.desc}
//               onChange={onChange}
//               rows={3}
//               placeholder="Model, specs, condition..."
//             />
//           </div>
//         </div>

//         {/* Institute / Department (optional) */}
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div>
//             <label className="block text-sm mb-1">Institute</label>
//             <input
//               className="w-full border rounded px-3 py-2"
//               name="institute"
//               value={form.institute}
//               onChange={onChange}
//               placeholder="UVPCE"
//               required
//             />
//           </div>
//           <div>
//             <label className="block text-sm mb-1">Department</label>
//             <input
//               className="w-full border rounded px-3 py-2"
//               name="department"
//               value={form.department}
//               onChange={onChange}
//               placeholder="IT"
//               required
//             />
//           </div>
//         </div>

//         {/* Assignment */}
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           <div>
//             <label className="block text-sm mb-1">Assigned Type</label>
//             <select
//               className="w-full border rounded px-3 py-2"
//               name="assigned_type"
//               value={form.assigned_type}
//               onChange={onChange}
//               required
//             >
//               <option value="general">general</option>
//               <option value="individual">individual</option>
//             </select>
//           </div>

//           <div className={`${form.assigned_type === "individual" ? "" : "opacity-60"}`}>
//             <label className="block text-sm mb-1">
//               Assigned Faculty Name {form.assigned_type === "individual" ? "" : "(disabled)"}
//             </label>
//             <input
//               className="w-full border rounded px-3 py-2"
//               name="assigned_faculty_name"
//               value={form.assigned_faculty_name}
//               onChange={onChange}
//               placeholder="Dr. A B"
//               disabled={form.assigned_type !== "individual"}
//               required={form.assigned_type === "individual"}
//             />
//           </div>

//           <div>
//             <label className="block text-sm mb-1">Quantity</label>
//             <input
//               type="number"
//               className="w-full border rounded px-3 py-2"
//               name="quantity"
//               min={1}
//               value={form.quantity}
//               onChange={onChange}
//               required
//             />
//           </div>
//         </div>

//         <button
//           type="submit"
//           className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
//         >
//           Save
//         </button>
//       </form>

//       {statusMsg && (
//         <p className={`mt-3 ${statusMsg.ok ? "text-green-600" : "text-red-600"}`}>
//           {statusMsg.msg}
//         </p>
//       )}

//       {created.length > 0 && (
//         <div className="mt-6">
//           <h3 className="text-lg font-semibold mb-2">Generated Registration Numbers</h3>
//           <ul className="list-disc pl-5 space-y-1">
//             {created.map((it) => (
//               <li key={it._id} className="font-mono text-sm">
//                 {it.registration_number} — {it.asset_name} @ {it.location} [{it.status}]
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}
//     </div>
//   );
// }
