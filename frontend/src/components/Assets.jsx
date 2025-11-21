// src/components/Assets.jsx
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const API = process.env.REACT_APP_BACKEND_PORT || "http://localhost:5000";

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
    new Set((values || []).map((v) => (v == null ? "" : String(v).trim())).filter((v) => v.length > 0))
  ).sort((a, b) => a.localeCompare(b));
}

function fmt(v, fallback = "-") {
  return v && String(v).trim() ? v : fallback;
}



function downloadExcel(rows, filenamePrefix = "assets_report") {
  const keys = [
    "serial_no","registration_number","asset_name","category","institute","department",
    "status","size_lxwxh","company_model","it_serial_no","dead_stock_no",
    "bill_no","vendor_name","purchase_date","rate_per_unit","po_no",
    "room_no","building_name","desc",
    "assigned_type","assigned_faculty_name","employee_code","assign_date",
    "remarks",
    "verification_date","verified","verified_by",
  ];

  const labels = {
    serial_no: "Serial No",
    registration_number: "Registration No",
    asset_name: "Asset Name",
    category: "Category",
    institute: "Institute",
    department: "Department",
    status: "Status",
    size_lxwxh: "Design Specifications (LxWxH)",
    company_model: "Company / Model / Model No.",
    it_serial_no: "Serial No. (IT Asset)",
    dead_stock_no: "Dead Stock / Asset / Stock No.",
    bill_no: "Bill No",
    vendor_name: "Vendor Name",
    purchase_date: "Date of Purchase",
    rate_per_unit: "Rate per Unit (Rs.)",
    po_no: "Purchase Order (PO) No.",
    room_no: "Room No. / Location (short)",
    building_name: "Name of Building",
    desc: "Description",
    assigned_type: "Assigned Type",
    assigned_faculty_name: "Assigned Faculty Name",
    employee_code: "Employee Code",
    assign_date: "Assign Date",
    remarks: "Remarks",
    verification_date: "Verification Date",
    verified: "Verified",
    verified_by: "Verified By",
  };



  // Normalize every row to strings, mapping boolean or string values to Yes/No
const normalized = rows.map((r) => {
  const out = {};
  keys.forEach((k) => {
    let v = r?.[k];

    if (k === "verified") {
      // Accept boolean true/false, "true"/"false", "yes"/"no", 1/0, and already "Yes"/"No"
      const s = v == null ? "" : String(v).trim().toLowerCase();
      if (s === "true" || s === "yes" || s === "1") out[k] = "Yes";
      else if (s === "false" || s === "no" || s === "0") out[k] = "No";
      else if (s === "yes" || s === "no") out[k] = s[0].toUpperCase() + s.slice(1);
      else out[k] = "";
    } else {
      out[k] = v == null ? "" : String(v);
    }
  });
  return out;
});



  // Normalize every row to strings, preserving "Yes"/"No" as-is for verified
  // const normalized = rows.map((r) => {
  //   const out = {};
  //   keys.forEach((k) => {
  //     let v = r?.[k];
  //     if (k === "verified") {
  //       // DB provides "Yes"/"No" strings; keep only those values; anything else -> ""
  //       const s = v == null ? "" : String(v).trim();
  //       out[k] = s === "Yes" || s === "No" ? s : "";
  //     } else {
  //       out[k] = v == null ? "" : String(v);
  //     }
  //   });
  //   return out;
  // });

  // Build worksheet with header row first, then data without headers
  const headerRow = [keys.map((k) => labels[k] || k)];
  const ws = XLSX.utils.aoa_to_sheet(headerRow);
  XLSX.utils.sheet_add_json(ws, normalized, { origin: "A2", skipHeader: true });

  // Optional: set column widths for readability
  ws["!cols"] = keys.map(() => ({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Assets");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  saveAs(blob, `${filenamePrefix}_${stamp}.xlsx`);
}

// Excel export with full, ordered fields and friendly headers
// function downloadExcel(rows, filenamePrefix = "assets_report") {
//   // Ordered keys matching the form sections
//   const keys = [
//     // Identity / org
//     "serial_no",
//     "registration_number",
//     "asset_name",
//     "category",
//     "institute",
//     "department",

//     // Core details (Row 1)
//     "status",
//     "size_lxwxh",
//     "company_model",
//     "it_serial_no",
//     "dead_stock_no",

//     // Procurement (Row 2)
//     "bill_no",
//     "vendor_name",
//     "purchase_date",
//     "rate_per_unit",
//     "po_no",

//     // Location + description (Row 3)
//     "room_no",
//     "building_name",
//     "desc",

//     // Assignment (Row 4)
//     "assigned_type",
//     "assigned_faculty_name",
//     "employee_code",
//     "assign_date",

//     // Remarks (Row 5)
//     "remarks",

//     // Verification
//     "verification_date",
//     "verified",
//     "verified_by",
//   ];

//   // Friendly header labels for Excel
//   const labels = {
//     serial_no: "Serial No",
//     registration_number: "Registration No",
//     asset_name: "Asset Name",
//     category: "Category",
//     institute: "Institute",
//     department: "Department",

//     status: "Status",
//     size_lxwxh: "Design Specifications (LxWxH)",
//     company_model: "Company / Model / Model No.",
//     it_serial_no: "Serial No. (IT Asset)",
//     dead_stock_no: "Dead Stock / Asset / Stock No.",

//     bill_no: "Bill No",
//     vendor_name: "Vendor Name",
//     purchase_date: "Date of Purchase",
//     rate_per_unit: "Rate per Unit (Rs.)",
//     po_no: "Purchase Order (PO) No.",

//     room_no: "Room No. / Location (short)",
//     building_name: "Name of Building",
//     location: "Location",
//     desc: "Description",

//     assigned_type: "Assigned Type",
//     assigned_faculty_name: "Assigned Faculty Name",
//     employee_code: "Employee Code",
//     assign_date: "Assign Date",

//     remarks: "Remarks",

//     verification_date: "Verification Date",
//     verified: "Verified",
//     verified_by: "Verified By",
//   };

//   // Build data rows with correct order and value formatting
//   const data = rows.map((r) => {
//     const row = {};
//     keys.forEach((k) => {
//       if (k === "verified") {
//         row[k] = r[k] === true ? "Yes" : r[k] === false ? "No" : "";
//       } else {
//         row[k] = r[k] != null ? String(r[k]) : "";
//       }
//     });
//     return row;
//   });

//   // Create sheet with machine keys first, then overwrite header with labels
//   const ws = XLSX.utils.json_to_sheet(data, { header: keys });
//   XLSX.utils.sheet_add_aoa(ws, [keys.map((k) => labels[k] || k)], { origin: "A1" });

//   const wb = XLSX.utils.book_new();
//   XLSX.utils.book_append_sheet(wb, ws, "Assets");

//   const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
//   const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

//   const stamp = new Date().toISOString().replace(/[:.]/g, "-");
//   saveAs(blob, `${filenamePrefix}_${stamp}.xlsx`);
// }

// Batch QR Download as single PDF
async function downloadAllQrPdf(rows, sizeOption = "Large") {
  const doc = new jsPDF("p", "mm", "a4");
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
    const qrUrl = await generateQrPng(qrText, qrSize * 4);

    doc.addImage(qrUrl, "PNG", x, y, qrSize, qrSize);

    const smallerFontSize = Math.round(labelFontSize * 0.66 * 10) / 10;
    doc.setFontSize(smallerFontSize);

    const serialWidth = (doc.getStringUnitWidth(serialText) * smallerFontSize) / doc.internal.scaleFactor;
    const serialX = x + (qrSize - serialWidth) / 2;
    const serialY = y + qrSize + 2;
    doc.text(serialText, serialX, serialY);

    const label = qrText && qrText !== "1" ? qrText : "";
    const labelLines = label ? doc.splitTextToSize(label, qrSize) : [];
    const lineHeight = smallerFontSize * 0.9;
    const totalLabelHeight = labelLines.length * lineHeight;

    for (let j = 0; j < labelLines.length; j++) {
      const line = labelLines[j];
      const lineWidth = (doc.getStringUnitWidth(line) * smallerFontSize) / doc.internal.scaleFactor;
      const textX = x + (qrSize - lineWidth) / 2;
      doc.text(line, textX, serialY + (j + 1) * lineHeight);
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
        doc.addPage("a4", "p");
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

// PDF GENERATION HELPER (table view)
function downloadPdf(rows, filenamePrefix = "assets_report") {
  const doc = new jsPDF("l", "mm", "a4");
  doc.setFontSize(18);
  doc.text("Assets Report", 14, 16);

  const headers = [
    { header: "Serial No", dataKey: "serial_no" },
    { header: "Registration No", dataKey: "registration_number" },
    { header: "Asset Name", dataKey: "asset_name" },
    { header: "Category", dataKey: "category" },
    { header: "Location", dataKey: "location" },
    { header: "Assign Date", dataKey: "assign_date" },
    { header: "Status", dataKey: "status" },
    { header: "Description", dataKey: "desc" },
    { header: "Verification Date", dataKey: "verification_date" },
    { header: "Verified", dataKey: "verified" },
    { header: "Verified By", dataKey: "verified_by" },
    { header: "Institute", dataKey: "institute" },
    { header: "Department", dataKey: "department" },
    { header: "Assigned Type", dataKey: "assigned_type" },
    { header: "Assigned Faculty", dataKey: "assigned_faculty_name" },
  ];

  const data = rows.map((r) => {
    const result = {};
    headers.forEach((h) => {
      let val = r[h.dataKey];
    if (h.dataKey === "verified") {
      const s = r.verified == null ? "" : String(r.verified).trim();
      val = s === "Yes" ? "Yes" : s === "No" ? "No" : "";
    }
      result[h.dataKey] = fmt(val, "");
    });
    return result;
  });

  autoTable(doc, {
    head: [headers.map((h) => h.header)],
    body: data.map((row) => headers.map((h) => row[h.dataKey])),
    startY: 22,
    theme: "grid",
    headStyles: { fillColor: [63, 81, 181], fontSize: 11, halign: "center" },
    bodyStyles: { fontSize: 10 },
    margin: { left: 8, right: 8 },
    styles: { overflow: "linebreak", cellWidth: "wrap" },
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  doc.save(`${filenamePrefix}_${stamp}.pdf`);
}

export default function Assets() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [filter, setFilter] = useState({
    q: "",
    status: "",
    category: "",
    assigned_type: "",
    institute: "",
    department: "",
    asset_name: "",
    room_no: "",
    linked: "",
  });

  const [detail, setDetail] = useState(null);

  // Selection state for checkboxes
  const [selectedIds, setSelectedIds] = useState([]);
  const selectAllRef = useRef();

  // Modal state for QR size selection
  const [showQrSizeModal, setShowQrSizeModal] = useState(false);
  const [qrRows, setQrRows] = useState([]);
  const [qrSizeOption, setQrSizeOption] = useState("Large");

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

  const options = useMemo(
    () => ({
      status: uniqSorted(rows.map((r) => r.status)),
      category: uniqSorted(rows.map((r) => r.category)),
      assigned_type: uniqSorted(rows.map((r) => r.assigned_type)),
      institute: uniqSorted(rows.map((r) => r.institute)),
      department: uniqSorted(rows.map((r) => r.department)),
      asset_name: uniqSorted(rows.map((r) => r.asset_name)),
      room_no: uniqSorted(rows.map((r) => r.room_no)),
    }),
    [rows]
  );

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

  const isLinked = (asset) => {
    return !!(
      //asset.location &&
      asset.assign_date &&
      asset.status &&
      //asset.institute &&
      //asset.department &&
      asset.assigned_type &&
      //asset.bill_no &&
      asset.purchase_date &&
      asset.room_no
    );
  };

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
          r.serial_no != null ? String(r.serial_no) : "",
        ]
          .map((x) => (x || "").toString().toLowerCase())
          .some((s) => s.includes(q));
      const hitStatus = !filter.status || (r.status || "") === filter.status;
      const hitCat = !filter.category || (r.category || "") === filter.category;
      const hitAT = !filter.assigned_type || (r.assigned_type || "") === filter.assigned_type;
      const hitInst = !filter.institute || (r.institute || "") === filter.institute;
      const hitDept = !filter.department || (r.department || "") === filter.department;
      const hitName = !filter.asset_name || (r.asset_name || "") === filter.asset_name;
      const hitRoom = !filter.room_no || (r.room_no || "") === filter.room_no;

      const linkedNow = isLinked(r);
      const hitLinked =
        !filter.linked ||
        (filter.linked === "linked" && linkedNow) ||
        (filter.linked === "not_linked" && !linkedNow);

      return hitQ && hitStatus && hitCat && hitAT && hitInst && hitDept && hitName && hitRoom && hitLinked;
    });
  }, [sorted, filter]);

  // Derived: selected assets
  const selectedAssets = useMemo(() => filtered.filter((r) => selectedIds.includes(r._id)), [filtered, selectedIds]);

  // Checkbox logic
  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? filtered.map((a) => a._id) : []);
  };
  const handleSelectOne = (id) => {
    setSelectedIds((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]));
  };
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.length > 0 && selectedIds.length < filtered.length;
    }
  }, [selectedIds, filtered.length]);
  const isAllSelected = filtered.length > 0 && selectedIds.length === filtered.length;

  // Downloads respect selection/filter
  const handleDownloadPdf = () => {
    const exporting = selectedAssets.length ? selectedAssets : filtered.length ? filtered : rows;
    const prefix =
      selectedAssets.length
        ? "assets_report_selected"
        : filter.q ||
          filter.status ||
          filter.category ||
          filter.assigned_type ||
          filter.institute ||
          filter.department ||
          filter.asset_name ||
          filter.location
        ? "assets_report_filtered"
        : "assets_report_all";
    downloadPdf(exporting, prefix);
  };
  const handleDownloadExcel = () => {
    const exporting = selectedAssets.length ? selectedAssets : filtered.length ? filtered : rows;
    const prefix =
      selectedAssets.length
        ? "assets_report_selected"
        : filter.q ||
          filter.status ||
          filter.category ||
          filter.assigned_type ||
          filter.institute ||
          filter.department ||
          filter.asset_name ||
          filter.location
        ? "assets_report_filtered"
        : "assets_report_all";
    downloadExcel(exporting, prefix);
  };
  const handleBatchQrDownloadClick = () => {
    setQrRows(selectedAssets.length ? selectedAssets : filtered.length ? filtered : rows);
    setShowQrSizeModal(true);
  };

  const onConfirmQrSize = async () => {
    setShowQrSizeModal(false);
    await downloadAllQrPdf(qrRows, qrSizeOption);
  };

  const onDownloadQr = async (asset) => {
  try {
    const content = asset.registration_number || "";
    const dataUrl = await generateQrPng(content, 600);

    const img = new window.Image();
    img.src = dataUrl;
    await new Promise((res) => {
      img.onload = res;
    });

    const padding = 16;

    // two text lines under QR
    const lineHeight = 22;
    const linesCount = 2; // Serial + QR ID
    const textBlockHeight = lineHeight * linesCount + 10;

    const canvas = document.createElement("canvas");
    canvas.width = img.width + padding * 2;
    canvas.height = img.height + padding * 2 + textBlockHeight;

    const ctx = canvas.getContext("2d");

    // background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw QR
    ctx.drawImage(img, padding, padding);

    // text styles
    ctx.fillStyle = "#111";
    ctx.font = "600 20px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const serial = asset.serial_no != null ? String(asset.serial_no) : "-";
    const qrId = asset.registration_number || ""; // this is your QR ID

    const label1 = `Serial No: ${serial}`;
    const label2 = qrId ? `QR ID: ${qrId}` : "";

    const baseY = img.height + padding + 24;

    // line 1: Serial No
    const w1 = ctx.measureText(label1).width;
    ctx.fillText(label1, (canvas.width - w1) / 2, baseY);

    // line 2: QR ID (only if present)
    if (label2) {
      const w2 = ctx.measureText(label2).width;
      ctx.fillText(label2, (canvas.width - w2) / 2, baseY + lineHeight);
    }

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${serial}_${(asset.registration_number || "REG").replace(/[^\w-]+/g, "_")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    alert("Failed to generate QR image");
  }
};


  const onDeleteBySerial = async (asset) => {
    try {
      if (asset.serial_no == null) {
        alert("This asset has no serial number.");
        return;
      }
      if (!window.confirm(`Delete asset with Serial No ${asset.serial_no}? This cannot be undone.`)) return;
      const resp = await fetch(`${API}/api/assets/by-serial/${encodeURIComponent(asset.serial_no)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok) {
        const ej = await resp.json().catch(() => ({}));
        alert(ej.error || "Failed to delete.");
        return;
      }
      setRows((prev) => prev.filter((x) => x._id !== asset._id));
      if (detail && detail._id === asset._id) setDetail(null);
    } catch {
      alert("Delete failed due to a network error.");
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
            {/* Download buttons 
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center rounded bg-rose-600 text-white px-3 py-1.5 text-sm hover:bg-rose-700"
              title="Download current view as PDF table"
            >
              Generate PDF
            </button>

            */}
            <button
              type="button"
              className="inline-flex items-center rounded bg-violet-600 text-white px-3 py-1.5 text-sm hover:bg-violet-700"
              onClick={handleBatchQrDownloadClick}
              title="Download all QRs as PDF"
            >
              Download QR
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex items-center rounded bg-emerald-600 text-white px-3 py-1.5 text-sm hover:bg-emerald-700"
              title="Download current view as Excel"
            >
              Download report
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className="border rounded px-3 py-2"
            value={filter.institute}
            onChange={(e) => setFilter((f) => ({ ...f, institute: e.target.value }))}
          >
            <option value="">All institutes</option>
            {options.institute.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filter.department}
            onChange={(e) => setFilter((f) => ({ ...f, department: e.target.value }))}
          >
            <option value="">All departments</option>
            {options.department.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filter.asset_name}
            onChange={(e) => setFilter((f) => ({ ...f, asset_name: e.target.value }))}
          >
            <option value="">All asset names</option>
            {options.asset_name.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filter.room_no}
            onChange={(e) => setFilter((f) => ({ ...f, room_no: e.target.value }))}
          >
            <option value="">All room numbers</option>
            {options.room_no.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filter.category}
            onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="">All categories</option>
            {options.category.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All status</option>
            {options.status.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filter.assigned_type}
            onChange={(e) => setFilter((f) => ({ ...f, assigned_type: e.target.value }))}
          >
            <option value="">All assigned types</option>
            {options.assigned_type.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            className="border rounded px-3 py-2"
            value={filter.linked}
            onChange={(e) => setFilter((f) => ({ ...f, linked: e.target.value }))}
          >
            <option value="">All Linked Status</option>
            <option value="linked">Linked</option>
            <option value="not_linked">Not Linked</option>
          </select>
        </div>

        {/* Table with checkboxes */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-2 py-2 text-left">
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-2 text-left">Serial No</th>
                <th className="px-3 py-2 text-left">Asset Name</th>
                <th className="px-3 py-2 text-left">Room No</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Assign Date</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a._id} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(a._id)}
                      onChange={() => handleSelectOne(a._id)}
                      aria-label="Select asset"
                    />
                  </td>
                  <td className="px-3 py-2">{fmt(a.serial_no)}</td>
                  <td className="px-3 py-2">{fmt(a.asset_name)}</td>
                  <td className="px-3 py-2">{fmt(a.room_no)}</td>
                  <td className="px-3 py-2">{fmt(a.status)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmt(a.assign_date)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => onDownloadQr(a)}
                        className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        Download QR
                      </button>
                      <button
                        onClick={() => setDetail(a)}
                        className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
                      >
                        More details
                      </button>
                      <button
                        onClick={() => onDeleteBySerial(a)}
                        className="px-3 py-1.5 text-sm rounded bg-red-700 text-white hover:bg-red-800"
                        title="Delete asset by serial (delete asset + all linked QRs)"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-gray-500" colSpan={7}>
                    No assets found. Adjust filters or add new items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR size modal */}
      {showQrSizeModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-sm w-full">
            <h3 className="mb-4 text-lg font-semibold">Select QR Code Size</h3>
            <select
              className="border rounded px-3 py-2 w-full mb-4"
              value={qrSizeOption}
              onChange={(e) => setQrSizeOption(e.target.value)}
              aria-label="QR code size selection"
            >
              <option>Large</option>
              <option>Medium</option>
              <option>Small</option>
            </select>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400" onClick={() => setShowQrSizeModal(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 rounded bg-violet-600 text-white hover:bg-violet-700" onClick={onConfirmQrSize}>
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-5xl bg-white rounded shadow-lg flex flex-col">
            {/* Sticky header */}
            <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xl font-semibold">Asset Details</h3>
              <button onClick={() => setDetail(null)} className="text-gray-600 hover:text-gray-900 text-lg" aria-label="Close">
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
              <Section title="Identity">
                <Grid cols={2}>
                  <Field label="Serial No" value={fmt(detail.serial_no)} />
                  <Field label="Registration Number" value={fmt(detail.registration_number)} />
                  <Field label="Asset Name" value={fmt(detail.asset_name)} />
                  <Field label="Category" value={fmt(detail.category)} />
                  <Field label="Institute" value={fmt(detail.institute)} />
                  <Field label="Department" value={fmt(detail.department)} />
                </Grid>
              </Section>

              <Section title="Core details">
                <Grid cols={2}>
                  <Field label="Status" value={fmt(detail.status)} />
                  <Field label="Design Specifications (LxWxH)" value={fmt(detail.size_lxwxh)} />
                  <Field label="Company / Model / Model No." value={fmt(detail.company_model)} />
                  <Field label="Serial No. (IT Asset)" value={fmt(detail.it_serial_no)} />
                  <Field label="Dead Stock / Asset / Stock No." value={fmt(detail.dead_stock_no)} />
                </Grid>
              </Section>

              <Section title="Procurement">
                <Grid cols={2}>
                  <Field label="Bill No" value={fmt(detail.bill_no)} />
                  <Field label="Vendor Name" value={fmt(detail.vendor_name)} />
                  <Field label="Date of Purchase" value={fmt(detail.purchase_date)} />
                  <Field label="Rate per Unit (Rs.)" value={fmt(detail.rate_per_unit)} />
                  <Field label="Purchase Order (PO) No." value={fmt(detail.po_no)} />
                </Grid>
              </Section>

              <Section title="Location">
                <Grid cols={2}>
                  <Field label="Room No. / Location (short)" value={fmt(detail.room_no)} />
                  <Field label="Name of Building" value={fmt(detail.building_name)} />
                   {/*<Field label="Location" value={fmt(detail.location)} />*/}
                </Grid>
              </Section>

              <Section title="Description">
                <Grid cols={1}>
                  <Field label="Description" value={fmt(detail.desc)} />
                </Grid>
              </Section>

              <Section title="Assignment">
                <Grid cols={2}>
                  <Field label="Assigned Type" value={fmt(detail.assigned_type)} />
                  <Field label="Assigned Faculty Name" value={fmt(detail.assigned_faculty_name)} />
                  <Field label="Employee Code" value={fmt(detail.employee_code)} />
                  <Field label="Assign Date" value={fmt(detail.assign_date)} />
                </Grid>
              </Section>

              <Section title="Remarks">
                <Grid cols={1}>
                  <Field label="Remarks" value={fmt(detail.remarks)} />
                </Grid>
              </Section>

              <Section title="Verification">
                <Grid cols={2}>
                  <Field label="Verification Date" value={fmt(detail.verification_date)} />
                  <Field label="Verified" value={detail.verified ? "Yes" : "No"} />
                  <Field label="Verified By" value={fmt(detail.verified_by)} />
                </Grid>
              </Section>
            </div>

            {/* Sticky footer */}
            <div className="px-5 py-3 border-t flex items-center justify-end gap-2 sticky bottom-0 bg-white z-10">
              <button
                onClick={() => onDownloadQr(detail)}
                className="inline-flex items-center rounded bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700"
              >
                Download QR
              </button>
              <button onClick={() => setDetail(null)} className="inline-flex items-center rounded bg-gray-100 px-4 py-2 hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Small display helpers
function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      {children}
    </div>
  );
}

function Grid({ cols = 2, children }) {
  const cls = cols === 1 ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 md:grid-cols-2 gap-3";
  return <div className={cls}>{children}</div>;
}

function Field({ label, value }) {
  return (
    <div className="border rounded px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 text-gray-900 break-words">{value}</div>
    </div>
  );
}
