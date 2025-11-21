// import { useEffect, useMemo, useState, useCallback, useRef } from "react";
// import QRCode from "qrcode";
// import * as XLSX from "xlsx";
// import { saveAs } from "file-saver";
// import jsPDF from "jspdf";

// const API = "http://localhost:5000";

// const INSTITUTES = ["", "UVPCE", "BSPP", "CSPIT", "DEPSTAR"];
// const DEPARTMENTS = ["", "IT", "CE", "ME", "EC", "EE"];
// const USED_OPTIONS = [
//   { value: "", label: "All" },
//   { value: "false", label: "Unused" },
//   { value: "true", label: "Linked" },
// ];

// // Excel Download Helper
// function downloadExcel(rows, filenamePrefix = "bulk_inventory") {
//   const headers = [
//     "serial_no",
//     "qr_id",
//     "institute",
//     "department",
//     "ts",
//     "used",
//     "linked_at",
//     "registration_number",
//     "asset_name",
//     "category",
//     "location",
//     "assign_date",
//     "status",
//     "desc",
//     "verification_date",
//     "verified",
//     "verified_by",
//     "assigned_type",
//     "assigned_faculty_name",
//   ];
//   const data = rows.map((r) => {
//     const obj = {};
//     headers.forEach((h) => {
//       let v = r[h];
//       if (typeof v === "boolean") v = v ? "true" : "false";
//       if (v == null) v = "";
//       obj[h] = v;
//     });
//     return obj;
//   });
//   const ws = XLSX.utils.json_to_sheet(data, { header: headers });
//   const wb = XLSX.utils.book_new();
//   XLSX.utils.book_append_sheet(wb, ws, "BulkInventory");
//   const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
//   const blob = new Blob([wbout], {
//     type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//   });
//   const stamp = new Date().toISOString().replace(/[:.]/g, "-");
//   saveAs(blob, `${filenamePrefix}_${stamp}.xlsx`);
// }

// // Server-cap-aware paginator for viewing and export
// async function fetchAllMatchingQR({ inst, dept, used }) {
//   const CHUNK = 100;
//   const base = new URLSearchParams();
//   if (inst) base.set("institute", inst);
//   if (dept) base.set("department", dept);
//   if (used) base.set("used", used);
//   const all = [];
//   let page = 1;
//   for (;;) {
//     const p = new URLSearchParams(base);
//     p.set("page", String(page));
//     p.set("size", String(CHUNK));
//     const res = await fetch(`${API}/api/qr?${p.toString()}`, { credentials: "include" });
//     if (!res.ok) throw new Error(`Fetch failed on page ${page}`);
//     const data = await res.json();
//     const batch = Array.isArray(data.items) ? data.items : [];
//     all.push(...batch);
//     if (batch.length < CHUNK) break;
//     page += 1;
//   }
//   return all;
// }

// // QR PDF bulk generation with variable grid
// async function downloadAllQrPdf(rows, sizeOption = "Large") {
//   const doc = new jsPDF("p", "mm", "a4");
//   const marginX = 16;
//   const marginY = 20;
//   const pageWidth = 210;
//   const pageHeight = 297;
//   const padding = 10;

//   let perRow, labelFontSize;
//   if (sizeOption === "Small") {
//     perRow = 5; labelFontSize = 7;
//   } else if (sizeOption === "Medium") {
//     perRow = 4; labelFontSize = 9;
//   } else {
//     perRow = 3; labelFontSize = 11;
//   }

//   const qrSize = (pageWidth - marginX * 2 - padding * (perRow - 1)) / perRow;
//   let x = marginX, y = marginY, col = 0, lastRowY = 0, lastBlockHeight = 0;

//   function drawDottedLines(rowY, blockHeight) {
//     const dashLength = 2;
//     let startX = marginX;
//     let lineY = rowY + blockHeight + 4;
//     doc.setLineDash([dashLength, dashLength]);
//     while (startX < pageWidth - marginX) {
//       doc.line(startX, lineY, startX + dashLength, lineY);
//       startX += dashLength * 2;
//     }
//     for (let colIndex = 1; colIndex < perRow; colIndex++) {
//       const lineX = marginX + colIndex * (qrSize + padding) - padding / 2;
//       let currentDotY = rowY - 2;
//       while (currentDotY < lineY + padding) {
//         doc.line(lineX, currentDotY, lineX, currentDotY + dashLength);
//         currentDotY += dashLength * 2;
//       }
//     }
//     doc.setLineDash([]);
//   }
//   for (let i = 0; i < rows.length; i++) {
//     const asset = rows[i];
//     const qrText = asset.qr_id || "";
//     const serialText = asset.serial_no != null ? `Serial No ${asset.serial_no}` : "No Serial";
//     const qrUrl = await QRCode.toDataURL(qrText, { margin: 1, width: qrSize * 4 });

//     doc.addImage(qrUrl, "PNG", x, y, qrSize, qrSize);

//     const smallerFontSize = Math.round(labelFontSize * 0.66 * 10) / 10;
//     doc.setFontSize(smallerFontSize);

//     const serialWidth = doc.getStringUnitWidth(serialText) * smallerFontSize / doc.internal.scaleFactor;
//     const serialX = x + (qrSize - serialWidth) / 2;
//     const serialY = y + qrSize + 2;
//     doc.text(serialText, serialX, serialY);

//     const label = (qrText && qrText !== "1") ? qrText : "";
//     const labelLines = label ? doc.splitTextToSize(label, qrSize) : [];
//     const lineHeight = smallerFontSize * 0.9;
//     const totalLabelHeight = labelLines.length * lineHeight;

//     for (let j = 0; j < labelLines.length; j++) {
//       const line = labelLines[j];
//       const lineWidth = doc.getStringUnitWidth(line) * smallerFontSize / doc.internal.scaleFactor;
//       const textX = x + (qrSize - lineWidth) / 2;
//       doc.text(line, textX, serialY + ((j + 1) * lineHeight));
//     }
//     lastRowY = y;
//     lastBlockHeight = qrSize + smallerFontSize / 2 + totalLabelHeight;
//     col++;
//     if (col >= perRow) {
//       drawDottedLines(y, lastBlockHeight);
//       col = 0;
//       x = marginX;
//       y += lastBlockHeight + padding + 2;
//       if (y + qrSize + totalLabelHeight > pageHeight - marginY) {
//         doc.addPage("a4", "p");
//         y = marginY;
//       }
//     } else {
//       x += qrSize + padding;
//     }
//   }
//   if (col > 0) { drawDottedLines(lastRowY, lastBlockHeight); }
//   const stamp = new Date().toISOString().replace(/[:.]/g, "-");
//   doc.save(`all_bulk_asset_qr_codes_${stamp}.pdf`);
// }

// export default function BulkInventory() {
//   const [items, setItems] = useState([]);
//   const [inst, setInst] = useState("");
//   const [dept, setDept] = useState("");
//   const [used, setUsed] = useState("");
//   const [page, setPage] = useState(1);
//   const [size, setSize] = useState(25);
//   const [total, setTotal] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const [err, setErr] = useState("");

//   // Checkbox selection state
//   const [selectedIds, setSelectedIds] = useState([]);
//   const selectAllRef = useRef();

//   // Modal for batch QR PDF
//   const [showQrModal, setShowQrModal] = useState(false);
//   const [qrRows, setQrRows] = useState([]);
//   const [qrSizeOption, setQrSizeOption] = useState("Large");

//   // Modal for details
//   const [open, setOpen] = useState(false);
//   const [selected, setSelected] = useState(null);
//   const [detail, setDetail] = useState(null);
//   const [detailLoading, setDetailLoading] = useState(false);
//   const [detailErr, setDetailErr] = useState("");

//   // Query params (for paged mode)
//   const params = useMemo(() => {
//     const p = new URLSearchParams();
//     if (inst) p.set("institute", inst);
//     if (dept) p.set("department", dept);
//     if (used) p.set("used", used);
//     p.set("page", String(page));
//     p.set("size", String(size));
//     return p.toString();
//   }, [inst, dept, used, page, size]);

//   // Load list
//   const fetchList = useCallback(async (signal) => {
//     setLoading(true);
//     setErr("");
//     try {
//       if (size === 0) {
//         const all = await fetchAllMatchingQR({ inst, dept, used });
//         setItems(all);
//         setTotal(all.length);
//         return;
//       }
//       const r = await fetch(`${API}/api/qr?${params}`, { credentials: "include", signal });
//       if (!r.ok) throw new Error("load");
//       const data = await r.json();
//       setItems(Array.isArray(data.items) ? data.items : []);
//       setTotal(Number.isFinite(data.total) ? data.total : 0);
//     } catch (e) {
//       if (e.name !== "AbortError") setErr("Failed to load");
//     } finally {
//       setLoading(false);
//     }
//   }, [params, size, inst, dept, used]);

//   useEffect(() => {
//     const ctrl = new AbortController();
//     fetchList(ctrl.signal);
//     return () => ctrl.abort();
//   }, [fetchList]);

//   // Checkbox handlers & select-all logic
//   const handleSelectAll = (checked) => {
//     setSelectedIds(checked ? items.map((row) => row._id) : []);
//   };
//   const handleSelectOne = (id) => {
//     setSelectedIds((curr) =>
//       curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
//     );
//   };
//   useEffect(() => {
//     if (selectAllRef.current) {
//       selectAllRef.current.indeterminate =
//         selectedIds.length > 0 && selectedIds.length < items.length;
//     }
//   }, [selectedIds, items.length]);
//   const isAllSelected = items.length > 0 && selectedIds.length === items.length;
//   const selectedRows = useMemo(
//     () => items.filter((row) => selectedIds.includes(row._id)),
//     [selectedIds, items]
//   );

//   // Download (selected rows preferred, fallback to filter)
//   const onDownloadAllFiltered = async () => {
//     if (selectedRows.length) {
//       downloadExcel(selectedRows, "bulk_inventory_selected");
//       return;
//     }
//     try {
//       const allRows = await fetchAllMatchingQR({ inst, dept, used });
//       const prefix = inst || dept || used ? "bulk_inventory_filtered_all" : "bulk_inventory_all";
//       downloadExcel(allRows, prefix);
//     } catch {
//       alert("Failed to download full report");
//     }
//   };
//   const onBatchQrDownloadClick = async () => {
//     if (selectedRows.length) {
//       setQrRows(selectedRows);
//       setShowQrModal(true);
//       return;
//     }
//     try {
//       const allRows = await fetchAllMatchingQR({ inst, dept, used });
//       setQrRows(allRows);
//       setShowQrModal(true);
//     } catch {
//       alert("Failed to fetch assets for QR export");
//     }
//   };

//   // ...rest of the component remains exactly as in your original (details, delete, etc)
//   const onGenerateQR = async (row) => {
//     try {
//       const dataUrl = await QRCode.toDataURL(row.qr_id, { margin: 1, width: 512 });
//       const img = new window.Image();
//       img.src = dataUrl;
//       await img.decode();
//       const padding = 16;
//       const textH = 34;
//       const canvas = document.createElement("canvas");
//       canvas.width = img.width + padding * 2;
//       canvas.height = img.height + padding * 2 + textH;
//       const ctx = canvas.getContext("2d");
//       ctx.fillStyle = "#fff";
//       ctx.fillRect(0, 0, canvas.width, canvas.height);
//       ctx.drawImage(img, padding, padding);
//       ctx.fillStyle = "#111";
//       ctx.font = "600 20px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
//       const text = `Serial No: ${row.serial_no}`;
//       const w = ctx.measureText(text).width;
//       ctx.fillText(text, (canvas.width - w) / 2, img.height + padding + 24);
//       const a = document.createElement("a");
//       a.href = canvas.toDataURL("image/png");
//       a.download = `${row.serial_no}_${row.ts || "qr"}.png`;
//       a.click();
//     } catch {
//       alert("Unable to generate QR image");
//     }
//   };

//   const totalPages = size === 0 ? 1 : Math.max(1, Math.ceil(total / size));
//   const onViewDetails = async (row) => {
//     setSelected(row);
//     setOpen(true);
//     setDetailErr("");
//     setDetail(null);
//     if (row.used && row.asset_id) {
//       setDetailLoading(true);
//       try {
//         const res = await fetch(`${API}/api/assets/${row.asset_id}`, { credentials: "include" });
//         if (!res.ok) {
//           setDetailErr("Failed to load asset details");
//           setDetail(row);
//         } else {
//           const asset = await res.json();
//           setDetail({ ...row, ...asset });
//         }
//       } catch {
//         setDetailErr("Network error");
//         setDetail(row);
//       } finally {
//         setDetailLoading(false);
//       }
//     } else {
//       setDetail(row);
//     }
//   };

//   const onDeleteByQr = async (row) => {
//     try {
//       if (!window.confirm("Delete this asset and its QR permanently?")) return;
//       const resp = await fetch(`${API}/api/qr/${encodeURIComponent(row.qr_id)}/delete-asset`, {
//         method: "DELETE",
//         credentials: "include"
//       });
//       if (!resp.ok) {
//         const ej = await resp.json().catch(() => ({}));
//         alert(ej.error || "Failed to delete.");
//         return;
//       }
//       setItems((prev) => prev.filter((x) => x._id !== row._id));
//       setTotal((t) => Math.max(0, t - 1));
//       if (open && selected && selected._id === row._id) {
//         setOpen(false);
//         setSelected(null);
//         setDetail(null);
//         setDetailErr("");
//         setDetailLoading(false);
//       }
//     } catch {
//       alert("Delete failed due to a network error.");
//     }
//   };

//   const onCloseModal = async () => {
//     setOpen(false);
//     setSelected(null);
//     setDetail(null);
//     setDetailErr("");
//     setDetailLoading(false);
//     const ctrl = new AbortController();
//     await fetchList(ctrl.signal);
//   };

//   // Confirm modal/button for QR export
//   const onConfirmQrSize = async () => {
//     setShowQrModal(false);
//     await downloadAllQrPdf(qrRows, qrSizeOption);
//   };

//   return (
//     <div className="bg-white rounded shadow p-4">
//       <div className="flex items-center justify-between">
//         <h2 className="text-lg font-semibold mb-3">Bulk Inventory</h2>
//         <div className="flex items-center gap-2">
//           <button
//             onClick={onDownloadAllFiltered}
//             className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
//             title="Export all matching records"
//           >
//             Download report
//           </button>
//           <button
//             type="button"
//             className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
//             onClick={onBatchQrDownloadClick}
//             title="Download all QRs as PDF"
//           >
//             Download QR
//           </button>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
//         <select
//           className="border rounded px-3 py-2"
//           value={inst}
//           onChange={(e) => { setPage(1); setInst(e.target.value); }}
//         >
//           {INSTITUTES.map((v) => (
//             <option key={v || "all"} value={v}>
//               {v || "All institutes"}
//             </option>
//           ))}
//         </select>
//         <select
//           className="border rounded px-3 py-2"
//           value={dept}
//           onChange={(e) => { setPage(1); setDept(e.target.value); }}
//         >
//           {DEPARTMENTS.map((v) => (
//             <option key={v || "all"} value={v}>
//               {v || "All departments"}
//             </option>
//           ))}
//         </select>
//         <select
//           className="border rounded px-3 py-2"
//           value={used}
//           onChange={(e) => { setPage(1); setUsed(e.target.value); }}
//         >
//           {USED_OPTIONS.map((o) => (
//             <option key={o.value || "all"} value={o.value}>
//               {o.label}
//             </option>
//           ))}
//         </select>
//         <select
//           className="border rounded px-3 py-2"
//           value={size}
//           onChange={(e) => {
//             const v = Number(e.target.value);
//             setPage(1);
//             setSize(v);
//           }}
//         >
//           {[10, 25, 50, 100, 0].map((n) => (
//             <option key={n} value={n}>
//               {n === 0 ? "All" : `${n} / page`}
//             </option>
//           ))}
//         </select>
//         <div className="flex items-center justify-between md:justify-end gap-2">
//           <button
//             className="px-3 py-2 border rounded"
//             onClick={() => setPage((p) => Math.max(1, p - 1))}
//             disabled={size === 0 || page <= 1}
//           >
//             Prev
//           </button>
//           <div className="text-sm">
//             {size === 0 ? "All" : `Page ${page} / ${totalPages}`}
//           </div>
//           <button
//             className="px-3 py-2 border rounded"
//             onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
//             disabled={size === 0 || page >= totalPages}
//           >
//             Next
//           </button>
//         </div>
//       </div>

//       {loading ? (
//         <div className="text-gray-600">Loading…</div>
//       ) : err ? (
//         <div className="text-red-600">{err}</div>
//       ) : items.length === 0 ? (
//         <div className="text-gray-600">No QR entries found.</div>
//       ) : (
//         <div className="overflow-auto">
//           <table className="min-w-full text-sm">
//             <thead>
//               <tr className="border-b bg-gray-50">
//                 <th className="px-2 py-2 text-left">
//                   {/* Select All */}
//                   <input
//                     type="checkbox"
//                     ref={selectAllRef}
//                     checked={isAllSelected}
//                     onChange={e => handleSelectAll(e.target.checked)}
//                     aria-label="Select all"
//                   />
//                 </th>
//                 <th className="text-left px-3 py-2">Serial No</th>
//                 <th className="text-left px-3 py-2">Asset Name</th>
//                 <th className="text-left px-3 py-2">Status</th>
//                 <th className="text-left px-3 py-2">Assign Date</th>
//                 <th className="text-left px-3 py-2">QR ID</th>
//                 <th className="text-left px-3 py-2">Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {items.map((r) => (
//                 <tr key={r._id} className="border-b">
//                   <td className="px-2 py-2">
//                     <input
//                       type="checkbox"
//                       checked={selectedIds.includes(r._id)}
//                       onChange={() => handleSelectOne(r._id)}
//                       aria-label="Select"
//                     />
//                   </td>
//                   <td className="px-3 py-2 font-medium">{r.serial_no}</td>
//                   <td className="px-3 py-2">{r.asset_name || "-"}</td>
//                   <td className="px-3 py-2">{r.status || "-"}</td>
//                   <td className="px-3 py-2">{r.assign_date || "-"}</td>
//                   <td className="px-3 py-2 font-mono">{r.qr_id}</td>
//                   <td className="px-3 py-2">
//                     <div className="flex items-center gap-2">
//                       <button
//                         onClick={() => onGenerateQR(r)}
//                         className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
//                       >
//                         Generate QR
//                       </button>
//                       <button
//                         onClick={() => onViewDetails(r)}
//                         className="px-3 py-1.5 rounded border hover:bg-gray-50"
//                       >
//                         View details
//                       </button>
//                       <button
//                         onClick={() => onDeleteByQr(r)}
//                         className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-700"
//                         title="Delete asset and this QR"
//                       >
//                         Delete
//                       </button>
//                     </div>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       )}

//       {/* ... QR Modal and Details modal code is unchanged ... */}
//       {showQrModal && (
//         <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
//           <div className="bg-white rounded shadow-lg p-6 max-w-sm w-full">
//             <h3 className="mb-4 text-lg font-semibold">Select QR Code Size</h3>
//             <select
//               className="border rounded px-3 py-2 w-full mb-4"
//               value={qrSizeOption}
//               onChange={e => setQrSizeOption(e.target.value)}
//               aria-label="QR code size selection"
//             >
//               <option>Large</option>
//               <option>Medium</option>
//               <option>Small</option>
//             </select>
//             <div className="flex justify-end gap-3">
//               <button
//                 className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
//                 onClick={() => setShowQrModal(false)}
//               >
//                 Cancel
//               </button>
//               <button
//                 className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
//                 onClick={onConfirmQrSize}
//               >
//                 Generate PDF
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {open && selected && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center">
//           <div className="fixed inset-0 bg-black/50" onClick={onCloseModal} />
//           <div className="relative z-50 w/[90vw] max-w-3xl rounded-lg bg-white shadow-xl">
//             <div className="px-5 py-3 border-b">
//               <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
//                 <h3 className="text-base font-semibold">QR {selected.serial_no}</h3>
//                 <span className="text-xs px-2 py-0.5 rounded bg-gray-100 font-mono">{selected.qr_id}</span>
//                 <span
//                   className={`text-xs px-2 py-0.5 rounded ${
//                     selected.used ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
//                   }`}
//                 >
//                   {selected.used ? "Linked" : "Not linked"}
//                 </span>
//               </div>
//             </div>
//             <div className="max-h-[70vh] overflow-auto px-5 py-4">
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
//                 <Field label="Serial No" value={selected.serial_no || "-"} />
//                 <Field label="Created" value={selected.ts || "-"} />
//                 <Field label="Institute" value={selected.institute || "-"} />
//                 <Field label="Department" value={selected.department || "-"} />
//               </div>
//               <div className="my-4 border-t" />
//               {detailLoading ? (
//                 <div className="text-sm text-gray-600">Loading details…</div>
//               ) : detailErr ? (
//                 <div className="text-sm text-red-600">{detailErr}</div>
//               ) : (
//                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
//                   <Field label="Asset Name" value={detail?.asset_name || "-"} />
//                   <Field label="Category" value={detail?.category || "-"} />
//                   <Field label="Location" value={detail?.location || "-"} />
//                   <Field label="Assign Date" value={detail?.assign_date || "-"} />
//                   <Field label="Status" value={detail?.status || "-"} />
//                   <Field
//                     label="Verified"
//                     value={detail?.verified ? "true" : (detail?.verified === false ? "false" : "-")}
//                   />
//                   <Field label="Verified By" value={detail?.verified_by || "-"} />
//                   <Field label="Verification Date" value={detail?.verification_date || "-"} />
//                   <Field label="Assigned Type" value={detail?.assigned_type || "-"} />
//                   <Field label="Assigned Faculty Name" value={detail?.assigned_faculty_name || "-"} />
//                   <Field label="Description" value={detail?.desc || "-"} full lineClamp />
//                 </div>
//               )}
//               {!selected.used && (
//                 <div className="mt-3 rounded border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-xs">
//                   Not linked yet. Ask a verifier to scan this QR and fill details; once saved or linked, they will appear here.
//                 </div>
//               )}
//             </div>
//             <div className="flex justify-end gap-2 px-5 py-3 border-t">
//               <button
//                 onClick={() => onGenerateQR(selected)}
//                 className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
//               >
//                 Download QR
//               </button>
//               <button
//                 onClick={() => onDeleteByQr(selected)}
//                 className="px-3 py-2 rounded bg-rose-600 text-white hover:bg-rose-700 text-sm"
//                 title="Delete asset and this QR"
//               >
//                 Delete
//               </button>
//               <button onClick={onCloseModal} className="px-3 py-2 rounded border hover:bg-gray-50 text-sm">
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// function Field({ label, value, mono = false, full = false, lineClamp = false }) {
//   return (
//     <div className={full ? "sm:col-span-2" : ""}>
//       <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
//       <div className={`${mono ? "font-mono" : "font-medium"} text-sm ${lineClamp ? "line-clamp-2" : ""}`}>
//         {value || "-"}
//       </div>
//     </div>
//   );
// }
