// // src/components/BulkAddAssets.jsx
// import React, { useState } from "react";
// import axios from "axios";

// // Use the SAME host you used for login everywhere.
// // If your Login.jsx posts to http://localhost:5000, use that here too.
// const API = "http://localhost:5000";

// const COLLEGES = ["UVPCE", "BSPP", "CSPIT", "DEPSTAR"];
// const DEPARTMENTS = ["IT", "CE", "ME", "EC", "EE"];

// export default function BulkAddAssets() {
//   const [college, setCollege] = useState("");
//   const [department, setDepartment] = useState("");
//   const [count, setCount] = useState(1);

//   const [items, setItems] = useState([]);     // [{ qr_id, serial_no, ... }]
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const handleGenerate = async () => {
//     // Basic validation
//     const qty = parseInt(count, 10);
//     if (!college || !department || !Number.isFinite(qty) || qty <= 0) {
//       setError("Please fill all fields correctly.");
//       return;
//     }

//     setError("");
//     setLoading(true);
//     setItems([]);

//     try {
//       // IMPORTANT: withCredentials sends the HttpOnly cookie to Flask
//       const res = await axios.post(
//         `${API}/api/qr/bulk`,
//         {
//           institute: college,       // map UI "college" -> API "institute"
//           department,
//           quantity: qty,            // map UI "count" -> API "quantity"
//         },
//         { withCredentials: true }
//       );

//       const data = res.data;
//       if (!data || !Array.isArray(data.items)) {
//         setError("Unexpected response from server.");
//       } else {
//         setItems(data.items);
//       }
//     } catch (err) {
//       const code = err?.response?.status;
//       if (code === 401) {
//         setError("Unauthorized. Please log in.");
//       } else if (code === 403) {
//         setError("Forbidden. Admin access required.");
//       } else if (code === 400) {
//         setError(err?.response?.data?.error || "Invalid request.");
//       } else {
//         setError("Error generating QR codes.");
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
//       <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
//         <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">
//           Bulk Add Assets (QR Only)
//         </h2>

//         <label className="block mb-2 font-medium text-gray-700">Select College</label>
//         <select
//           value={college}
//           onChange={(e) => setCollege(e.target.value)}
//           className="w-full mb-4 border rounded p-2"
//         >
//           <option value="">-- Select College --</option>
//           {COLLEGES.map((col) => (
//             <option key={col} value={col}>
//               {col}
//             </option>
//           ))}
//         </select>

//         <label className="block mb-2 font-medium text-gray-700">Select Department</label>
//         <select
//           value={department}
//           onChange={(e) => setDepartment(e.target.value)}
//           className="w-full mb-4 border rounded p-2"
//         >
//           <option value="">-- Select Department --</option>
//           {DEPARTMENTS.map((dep) => (
//             <option key={dep} value={dep}>
//               {dep}
//             </option>
//           ))}
//         </select>

//         <label className="block mb-2 font-medium text-gray-700">Number of QRs</label>
//         <input
//           type="number"
//           value={count}
//           onChange={(e) => setCount(e.target.value)}
//           className="w-full mb-4 border rounded p-2"
//           min="1"
//         />

//         <button
//           onClick={handleGenerate}
//           disabled={loading}
//           className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 w-full"
//         >
//           {loading ? "Generating..." : "Generate QR Codes"}
//         </button>

//         {error && <p className="text-red-500 mt-4 text-center">{error}</p>}

//         {items.length > 0 && (
//           <div className="mt-6">
//             <h3 className="font-semibold mb-2 text-center text-gray-800">Generated QRs</h3>
//             <div className="bg-gray-100 rounded p-3 overflow-auto h-60">
//               {items.map((row, i) => (
//                 <div key={i} className="text-sm text-gray-800">
//                   <div className="font-mono">{row.qr_id}</div>
//                   <div className="text-gray-600">Serial: {row.serial_no}</div>
//                   <hr className="my-2 border-gray-300" />
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
