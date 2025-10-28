import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
    "serial_no",
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
    "employee_code",     // Add this
    "bill_no"   // And this
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

// Batch QR Download as single PDF
async function downloadAllQrPdf(rows, sizeOption = "Large") {
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
    // Horizontal line below the row
    let startX = marginX;
    let lineY = rowY + blockHeight + 4;
    doc.setLineDash([dashLength, dashLength]);
    while (startX < pageWidth - marginX) {
      doc.line(startX, lineY, startX + dashLength, lineY);
      startX += dashLength * 2;
    }
    // Vertical dashed lines between QR codes
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

// PDF GENERATION HELPER
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
      if (h.dataKey === "verified") val = val ? "Yes" : "No";
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
    location: "",
    linked:"",
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

  const options = useMemo(() => ({
    status: uniqSorted(rows.map((r) => r.status)),
    category: uniqSorted(rows.map((r) => r.category)),
    assigned_type: uniqSorted(rows.map((r) => r.assigned_type)),
    institute: uniqSorted(rows.map((r) => r.institute)),
    department: uniqSorted(rows.map((r) => r.department)),
    asset_name: uniqSorted(rows.map((r) => r.asset_name)),
    location: uniqSorted(rows.map((r) => r.location)),
  }), [rows]);

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
      asset.location &&
      asset.assign_date &&
      asset.status &&
      asset.institute &&
      asset.department &&
      asset.assigned_type
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
      const hitLoc = !filter.location || (r.location || "") === filter.location;


      const linkedNow = isLinked(r);
      const hitLinked =
        !filter.linked ||
        (filter.linked === "linked" && linkedNow) ||
        (filter.linked === "not_linked" && !linkedNow);

      return hitQ && hitStatus && hitCat && hitAT && hitInst && hitDept && hitName && hitLoc && hitLinked;
    });
  }, [sorted, filter]);

  // Derived: selected assets (using filtered as base)
  const selectedAssets = useMemo(() => (
    filtered.filter((r) => selectedIds.includes(r._id))
  ), [filtered, selectedIds]);

  // Checkbox logic
  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? filtered.map((a) => a._id) : []);
  };
  const handleSelectOne = (id) => {
    setSelectedIds((curr) => (
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    ));
  };
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedIds.length > 0 && selectedIds.length < filtered.length;
    }
  }, [selectedIds, filtered.length]);
  const isAllSelected = filtered.length > 0 && selectedIds.length === filtered.length;

  // Modified: Download actions to respect selected assets, or fallback to filtered/all
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
      await new Promise((res) => { img.onload = res; });
      const padding = 16; const textH = 34;
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

  const onDeleteBySerial = async (asset) => {
    try {
      if (asset.serial_no == null) {
        alert("This asset has no serial number.");
        return;
      }
      if (!window.confirm(`Delete asset with Serial No ${asset.serial_no}? This cannot be undone.`)) return;
      const resp = await fetch(
        `${API}/api/assets/by-serial/${encodeURIComponent(asset.serial_no)}`,
        { method: "DELETE", credentials: "include" }
      );
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
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center rounded bg-rose-600 text-white px-3 py-1.5 text-sm hover:bg-rose-700"
              title="Download current view as PDF table"
            >
              Generate PDF
            </button>
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

          <select
            className="border rounded px-3 py-2"
            value={filter.linked}
            onChange={e => setFilter(f => ({ ...f, linked: e.target.value }))}
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
                    onChange={e => handleSelectAll(e.target.checked)}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-2 text-left">Serial No</th>
                <th className="px-3 py-2 text-left">Asset Name</th>
                <th className="px-3 py-2 text-left">Location</th>
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
                  <td className="px-3 py-2">{fmt(a.location)}</td>
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
              <button
                className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
                onClick={() => setShowQrSizeModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-violet-600 text-white hover:bg-violet-700"
                onClick={onConfirmQrSize}
              >
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}
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
              <Field label="Serial No" value={fmt(detail.serial_no)} />
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
              <Field label="Assigned Faculty Name/Staff" value={fmt(detail.assigned_faculty_name)} />
              <Field label="Employee Code" value={fmt(detail.employee_code)} />
              <Field label="Bill No" value={fmt(detail.bill_no)} />

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
