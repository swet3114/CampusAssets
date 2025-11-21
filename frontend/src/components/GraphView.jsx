// // src/components/GraphView.jsx
// import { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   Chart as ChartJS,
//   CategoryScale,
//   LinearScale,
//   BarElement,
//   LineElement,
//   PointElement,
//   ArcElement,
//   Title,
//   Tooltip,
//   Legend,
// } from "chart.js";
// import { Bar, Pie, Doughnut, Line } from "react-chartjs-2";

// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   BarElement,
//   LineElement,
//   PointElement,
//   ArcElement,
//   Title,
//   Tooltip,
//   Legend
// );

// const API = "http://localhost:5000";

// export default function GraphView() {
//   const navigate = useNavigate();

//   // Single Asset Stats
//   const [stats, setStats] = useState(null);

//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   // Filter options from database (single only)
//   const [filterOptions, setFilterOptions] = useState({
//     institutes: [],
//     departments: [],
//     categories: [],
//     statuses: [],
//     assetnames: [],
//     assignedtypes: [],
//     locations: [],
//   });

//   // Single Asset Filters
//   const [filters, setFilters] = useState({
//     institute: "",
//     department: "",
//     category: "",
//     status: "",
//     assetname: "",
//     assignedtype: "",
//     location: "",
//   });

//   // Fetch filter options from backend for single assets

//   // const fetchFilterOptions = async () => {
//   //   try {
//   //     const res = await fetch(`${API}/api/assets/filter-options`, {
//   //       credentials: "include",
//   //     });
//   //     if (!res.ok) throw new Error("Failed to fetch filter options");
//   //     const data = await res.json();
//   //     if (data.success) {
//   //       setFilterOptions({
//   //         institutes: data.institutes || [],
//   //         departments: data.departments || [],
//   //         categories: data.categories || [],
//   //         statuses: data.statuses || [],
//   //         assetnames: data.assetnames || [],
//   //         assignedtypes: data.assignedtypes || [],
//   //         locations: data.locations || [],
//   //       });
//   //     }
//   //   } catch (err) {
//   //     console.error("Error fetching filter options:", err);
//   //   }
//   // };
// // Fetch filter options from backend for single assets


// // const fetchFilterOptions = async () => {
// //   try {
// //     const res = await fetch(`${API}/api/assets/filter-options`, {
// //       credentials: "include",
// //     });
// //     if (!res.ok) throw new Error("Failed to fetch filter options");
// //     const data = await res.json();
// //     if (data.success) {
// //       setFilterOptions({
// //         institutes: data.institutes || [],
// //         departments: data.departments || [],
// //         categories: data.categories || [],
// //         statuses: data.statuses || [],
// //         assetnames: data.asset_names || [],        // note rename
// //         assignedtypes: data.assigned_types || [],  // note rename
// //         locations: data.locations || [],
// //       });
// //     } else {
// //       throw new Error(data.error || "Failed to fetch filter options");
// //     }
// //   } catch (err) {
// //     console.error("Error fetching filter options:", err);
// //     setError("Failed to fetch filter options");
// //   }
// // };

// const fetchFilterOptions = async () => {
//   try {
//     const res = await fetch(`${API}/api/assets/filter-options`, {
//       credentials: "include",
//     });
//     if (!res.ok) throw new Error("Failed to fetch filter options");
//     const data = await res.json();
//     if (data.success) {
//       setFilterOptions({
//         institutes: data.institutes || [],
//         departments: data.departments || [],
//         categories: data.categories || [],
//         statuses: data.statuses || [],
//         assetnames: data.asset_names || [],        // map snake_case -> local
//         assignedtypes: data.assigned_types || [],  // map snake_case -> local
//         locations: data.locations || [],
//       });
//     } else {
//       throw new Error(data.error || "Failed to fetch filter options");
//     }
//   } catch (err) {
//     console.error("Error fetching filter options:", err);
//     setError("Failed to fetch filter options");
//   }
// };





//   // Fetch SINGLE asset stats

//   // const fetchStats = async () => {
//   //   setLoading(true);
//   //   setError("");
//   //   try {
//   //     const params = new URLSearchParams();
//   //     if (filters.institute) params.set("institute", filters.institute);
//   //     if (filters.department) params.set("department", filters.department);
//   //     if (filters.category) params.set("category", filters.category);
//   //     if (filters.status) params.set("status", filters.status);
//   //     if (filters.assetname) params.set("assetname", filters.assetname);
//   //     if (filters.assignedtype) params.set("assignedtype", filters.assignedtype);
//   //     if (filters.location) params.set("location", filters.location);

//   //     const res = await fetch(`${API}/api/assets/stats?${params.toString()}`, {
//   //       credentials: "include",
//   //     });
//   //     if (!res.ok) throw new Error("Failed to fetch statistics");
//   //     const data = await res.json();
//   //     if (data.success) {
//   //       setStats(data);
//   //     } else {
//   //       setError(data.error || "Failed to load data");
//   //     }
//   //   } catch (err) {
//   //     setError(err.message);
//   //     console.error("Error fetching stats:", err);
//   //   } finally {
//   //     setLoading(false);
//   //   }
//   // };

//   const fetchStats = async () => {
//   setLoading(true);
//   setError("");
//   try {
//     const params = new URLSearchParams();
//     if (filters.institute) params.set("institute", filters.institute);
//     if (filters.department) params.set("department", filters.department);
//     if (filters.category) params.set("category", filters.category);
//     if (filters.status) params.set("status", filters.status);
//     if (filters.assetname) params.set("asset_name", filters.assetname);       // snake_case
//     if (filters.assignedtype) params.set("assigned_type", filters.assignedtype); // snake_case
//     if (filters.location) params.set("location", filters.location);

//     const res = await fetch(`${API}/api/assets/stats?${params.toString()}`, {
//       credentials: "include",
//     });
//     if (!res.ok) throw new Error("Failed to fetch statistics");
//     const data = await res.json();
//     if (data.success) {
//       // map API response keys to your state usage
//       setStats({
//         totalassets: data.total_assets,
//         bycategory: data.by_category || [],
//         bystatus: data.by_status || [],
//         bydepartment: data.by_department || [],
//         byinstitute: data.by_institute || [],
//         bylocation: data.by_location || [],
//         byassignedtype: data.by_assigned_type || [],
//         verified: data.verified_stats || { verified: 0, unverified: 0 },
//         assetsbydate: data.assets_by_date || [],
//       });
//     } else {
//       setError(data.error || "Failed to load data");
//     }
//   } catch (err) {
//     setError(err.message);
//   } finally {
//     setLoading(false);
//   }
// };




//   // Fetch filter options on component mount
//   useEffect(() => {
//     fetchFilterOptions();
//   }, []);

//   // Fetch stats when filters change
//   useEffect(() => {
//     fetchStats();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [filters]);

//   // Prepare chart data helper
//   const prepareChartData = (dataArray, label) => {
//     const colors = [
//       "#3b82f6",
//       "#10b981",
//       "#f59e0b",
//       "#ef4444",
//       "#8b5cf6",
//       "#ec4899",
//       "#06b6d4",
//       "#84cc16",
//     ];
//     return {
//       labels: dataArray.map((item) => item.id || "Unknown"),
//       datasets: [
//         {
//           label,
//           data: dataArray.map((item) => item.count),
//           backgroundColor: colors.slice(0, dataArray.length),
//           borderWidth: 1,
//         },
//       ],
//     };
//   };

//   // Prepare simple date data (total assets per date)
//   const prepareDateData = (assetsByDate) => {
//     if (!assetsByDate || assetsByDate.length === 0) {
//       console.warn("No date data available");
//       return null;
//     }
//     const sortedData = [...assetsByDate].sort((a, b) =>
//       a.id.localeCompare(b.id)
//     );
//     return {
//       labels: sortedData.map((item) => item.id),
//       datasets: [
//         {
//           label: "Total Assets",
//           data: sortedData.map((item) => item.count),
//           backgroundColor: "rgba(59, 130, 246, 0.6)",
//           borderColor: "rgba(59, 130, 246, 1)",
//           borderWidth: 2,
//           fill: true,
//           tension: 0.4,
//           pointRadius: 4,
//           pointHoverRadius: 6,
//           pointBackgroundColor: "rgba(59, 130, 246, 1)",
//           pointBorderColor: "#fff",
//           pointBorderWidth: 2,
//         },
//       ],
//     };
//   };

//   const chartOptions = {
//     responsive: true,
//     maintainAspectRatio: true,
//     plugins: {
//       legend: { position: "bottom" },
//     },
//   };

//   const timeSeriesOptions = {
//     responsive: true,
//     maintainAspectRatio: true,
//     plugins: {
//       legend: { position: "bottom" },
//       title: { display: false },
//     },
//     scales: {
//       y: { beginAtZero: true, ticks: { stepSize: 1 } },
//     },
//   };

//   const selectStyle = {
//     width: "100%",
//     padding: "10px 12px",
//     border: "1px solid #d1d5db",
//     borderRadius: "8px",
//     backgroundColor: "white",
//     fontSize: "14px",
//     color: "#1f2937",
//     cursor: "pointer",
//     outline: "none",
//     appearance: "none",
//     backgroundImage:
//       "url('data:image/svg+xml,%3Csvg xmlns=http://www.w3.org/2000/svg width=16 height=16 viewBox=0 0 24 24 fill=none stroke=%236b7280 stroke-width=2 stroke-linecap=round stroke-linejoin=round%3E%3Cpolyline points=6 9 12 15 18 9/%3E%3Cpolyline/%3E%3C/svg%3E')",
//     backgroundRepeat: "no-repeat",
//     backgroundPosition: "right 12px center",
//     backgroundSize: "16px",
//     paddingRight: "36px",
//   };

//   const labelStyle = {
//     display: "block",
//     fontSize: "13px",
//     fontWeight: 500,
//     marginBottom: "8px",
//     color: "#374151",
//   };

//   return (
//     <div style={{ maxWidth: "1400px", margin: "0 auto", padding: 24 }}>
//       <div
//         style={{
//           backgroundColor: "white",
//           borderRadius: "12px",
//           boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
//           padding: 24,
//         }}
//       >
//         {/* Header */}
//         <div
//           style={{
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "space-between",
//             marginBottom: 24,
//             flexWrap: "wrap",
//             gap: 16,
//           }}
//         >
//           <div
//             style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}
//           >
//             <h2
//               style={{
//                 fontSize: 28,
//                 fontWeight: "bold",
//                 color: "#1f2937",
//                 display: "flex",
//                 alignItems: "center",
//                 gap: 8,
//                 margin: 0,
//               }}
//             >
//               <span>Asset Analytics Dashboard</span>
//             </h2>
//           </div>

//           <button
//             onClick={() => navigate(-1)}
//             style={{
//               padding: "10px 16px",
//               border: "1px solid #d1d5db",
//               borderRadius: 8,
//               backgroundColor: "white",
//               cursor: "pointer",
//               display: "flex",
//               alignItems: "center",
//               gap: 8,
//               fontSize: 14,
//               transition: "background-color 0.15s",
//             }}
//             onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
//             onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "white")}
//           >
//             {/* Back icon */}
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               style={{ height: 20, width: 20 }}
//               fill="none"
//               viewBox="0 0 24 24"
//               stroke="currentColor"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth="2"
//                 d="M10 19l-7-7m0 0l7-7m-7 7h18"
//               />
//             </svg>
//             Back
//           </button>
//         </div>

//         {/* Loading / Error */}
//         {loading && (
//           <div style={{ textAlign: "center", padding: "48px 0" }}>
//             <div
//               style={{
//                 display: "inline-block",
//                 width: 48,
//                 height: 48,
//                 border: "3px solid #e5e7eb",
//                 borderTop: "3px solid #4f46e5",
//                 borderRadius: "50%",
//                 animation: "spin 1s linear infinite",
//               }}
//             />
//             <style>
//               {`@keyframes spin { to { transform: rotate(360deg); } }`}
//             </style>
//             <p style={{ marginTop: 16, color: "#6b7280" }}>Loading statistics...</p>
//           </div>
//         )}

//         {error && !loading && (
//           <div style={{ textAlign: "center", padding: "48px 0" }}>
//             <div
//               style={{
//                 color: "#dc2626",
//                 backgroundColor: "#fef2f2",
//                 border: "1px solid #fecaca",
//                 borderRadius: 8,
//                 padding: 16,
//                 display: "inline-block",
//               }}
//             >
//               <p style={{ fontWeight: 600, margin: "0 0 8px 0" }}>Error</p>
//               <p style={{ margin: 0 }}>{error}</p>
//             </div>
//           </div>
//         )}

//         {/* SINGLE ASSET VIEW */}
//         {!loading && !error && (
//           <>
//             {/* Single Asset Filters - 7 DROPDOWNS */}
//             <div
//               style={{
//                 display: "grid",
//                 gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
//                 gap: 16,
//                 marginBottom: 24,
//                 padding: 20,
//                 background: "linear-gradient(to right, #eef2ff, #f3e8ff)",
//                 borderRadius: 12,
//                 border: "1px solid #e0e7ff",
//               }}
//             >
//               {/* Institute */}
//               <div>
//                 <label style={labelStyle}>Institute</label>
//                 <select
//                   style={selectStyle}
//                   value={filters.institute}
//                   onChange={(e) =>
//                     setFilters({ ...filters, institute: e.target.value })
//                   }
//                 >
//                   <option value="">All institutes</option>
//                   {filterOptions.institutes.map((institute) => (
//                     <option key={institute} value={institute}>
//                       {institute}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               {/* Department */}
//               <div>
//                 <label style={labelStyle}>Department</label>
//                 <select
//                   style={selectStyle}
//                   value={filters.department}
//                   onChange={(e) =>
//                     setFilters({ ...filters, department: e.target.value })
//                   }
//                 >
//                   <option value="">All departments</option>
//                   {filterOptions.departments.map((department) => (
//                     <option key={department} value={department}>
//                       {department}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               {/* Category */}
//               <div>
//                 <label style={labelStyle}>Category</label>
//                 <select
//                   style={selectStyle}
//                   value={filters.category}
//                   onChange={(e) =>
//                     setFilters({ ...filters, category: e.target.value })
//                   }
//                 >
//                   <option value="">All categories</option>
//                   {filterOptions.categories.map((category) => (
//                     <option key={category} value={category}>
//                       {category}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               {/* Status */}
//               <div>
//                 <label style={labelStyle}>Status</label>
//                 <select
//                   style={selectStyle}
//                   value={filters.status}
//                   onChange={(e) =>
//                     setFilters({ ...filters, status: e.target.value })
//                   }
//                 >
//                   <option value="">All statuses</option>
//                   {filterOptions.statuses.map((status) => (
//                     <option key={status} value={status}>
//                       {status}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               {/* Asset Name */}
//               <div>
//                 <label style={labelStyle}>Asset Name</label>
//                 <select
//                   style={selectStyle}
//                   value={filters.assetname}
//                   onChange={(e) =>
//                     setFilters({ ...filters, assetname: e.target.value })
//                   }
//                 >
//                   <option value="">All asset names</option>
//                   {filterOptions.assetnames.map((name) => (
//                     <option key={name} value={name}>
//                       {name}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               {/* Assigned Type */}
//               <div>
//                 <label style={labelStyle}>Assigned Type</label>
//                 <select
//                   style={selectStyle}
//                   value={filters.assignedtype}
//                   onChange={(e) =>
//                     setFilters({ ...filters, assignedtype: e.target.value })
//                   }
//                 >
//                   <option value="">All assigned types</option>
//                   {filterOptions.assignedtypes.map((type) => (
//                     <option key={type} value={type}>
//                       {type}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               {/* Location */}
//               <div>
//                 <label style={labelStyle}>Location</label>
//                 <select
//                   style={selectStyle}
//                   value={filters.location}
//                   onChange={(e) =>
//                     setFilters({ ...filters, location: e.target.value })
//                   }
//                 >
//                   <option value="">All locations</option>
//                   {filterOptions.locations.map((location) => (
//                     <option key={location} value={location}>
//                       {location}
//                     </option>
//                   ))}
//                 </select>
//               </div>
//             </div>

//             {stats && (
//               <>
//                 {/* Single Asset Summary Cards */}
//                 <div
//                   style={{
//                     display: "grid",
//                     gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
//                     gap: 16,
//                     marginBottom: 24,
//                   }}
//                 >
//                   {/* Total Assets */}
//                   <div
//                     style={{
//                       padding: 24,
//                       background: "linear-gradient(to bottom right, #dbeafe, #bfdbfe)",
//                       border: "1px solid #93c5fd",
//                       borderRadius: 12,
//                       boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//                     }}
//                   >
//                     <div
//                       style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
//                     >
//                       <div>
//                         <h3
//                           style={{ fontSize: 13, fontWeight: 500, color: "#1e3a8a", margin: "0 0 8px 0" }}
//                         >
//                           Total Assets
//                         </h3>
//                         <p style={{ fontSize: 36, fontWeight: "bold", color: "#1d4ed8", margin: 0 }}>
//                           {stats.totalassets}
//                         </p>
//                       </div>
//                       <div style={{ color: "#93c5fd", opacity: 0.5 }}>
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           style={{ height: 48, width: 48 }}
//                           fill="none"
//                           viewBox="0 0 24 24"
//                           stroke="currentColor"
//                         >
//                           <path
//                             strokeLinecap="round"
//                             strokeLinejoin="round"
//                             strokeWidth="2"
//                             d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
//                           />
//                         </svg>
//                       </div>
//                     </div>
//                   </div>

//                   {/* Verified */}
//                   <div
//                     style={{
//                       padding: 24,
//                       background: "linear-gradient(to bottom right, #d1fae5, #a7f3d0)",
//                       border: "1px solid #6ee7b7",
//                       borderRadius: 12,
//                       boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//                     }}
//                   >
//                     <div
//                       style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
//                     >
//                       <div>
//                         <h3
//                           style={{ fontSize: 13, fontWeight: 500, color: "#065f46", margin: "0 0 8px 0" }}
//                         >
//                           Verified
//                         </h3>
//                         <p style={{ fontSize: 36, fontWeight: "bold", color: "#059669", margin: 0 }}>
//                           {stats.verified?.verified}
//                         </p>
//                       </div>
//                       <div style={{ color: "#6ee7b7", opacity: 0.5 }}>
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           style={{ height: 48, width: 48 }}
//                           fill="none"
//                           viewBox="0 0 24 24"
//                           stroke="currentColor"
//                         >
//                           <path
//                             strokeLinecap="round"
//                             strokeLinejoin="round"
//                             strokeWidth="2"
//                             d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
//                           />
//                         </svg>
//                       </div>
//                     </div>
//                   </div>

//                   {/* Unverified */}
//                   <div
//                     style={{
//                       padding: 24,
//                       background: "linear-gradient(to bottom right, #fef3c7, #fde68a)",
//                       border: "1px solid #fcd34d",
//                       borderRadius: 12,
//                       boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//                     }}
//                   >
//                     <div
//                       style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
//                     >
//                       <div>
//                         <h3
//                           style={{ fontSize: 13, fontWeight: 500, color: "#78350f", margin: "0 0 8px 0" }}
//                         >
//                           Unverified
//                         </h3>
//                         <p style={{ fontSize: 36, fontWeight: "bold", color: "#b45309", margin: 0 }}>
//                           {stats.verified?.unverified}
//                         </p>
//                       </div>
//                       <div style={{ color: "#fcd34d", opacity: 0.5 }}>
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           style={{ height: 48, width: 48 }}
//                           fill="none"
//                           viewBox="0 0 24 24"
//                           stroke="currentColor"
//                         >
//                           <path
//                             strokeLinecap="round"
//                             strokeLinejoin="round"
//                             strokeWidth="2"
//                             d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
//                           />
//                         </svg>
//                       </div>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Single Assets by Date Chart */}
//                 {stats.assetsbydate && stats.assetsbydate.length > 0 ? (
//                   <div
//                     style={{
//                       border: "1px solid #e5e7eb",
//                       borderRadius: 12,
//                       padding: 24,
//                       backgroundColor: "white",
//                       boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//                       marginBottom: 24,
//                     }}
//                   >
//                     <h3
//                       style={{
//                         fontSize: 18,
//                         fontWeight: 600,
//                         marginBottom: 16,
//                         color: "#374151",
//                         display: "flex",
//                         alignItems: "center",
//                         gap: 8,
//                       }}
//                     >
//                       <span style={{ color: "#6366f1" }}>•</span> Total Assets Added by Date
//                     </h3>
//                     <Line data={prepareDateData(stats.assetsbydate)} options={timeSeriesOptions} />
//                   </div>
//                 ) : null}

//                 {/* Single Asset Charts Grid */}
//                 <div
//                   style={{
//                     display: "grid",
//                     gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
//                     gap: 24,
//                   }}
//                 >
//                   {/* Assets by Category */}
//                   {stats.bycategory && stats.bycategory.length > 0 && (
//                     <div
//                       style={{
//                         border: "1px solid #e5e7eb",
//                         borderRadius: 12,
//                         padding: 24,
//                         backgroundColor: "white",
//                         boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//                       }}
//                     >
//                       <h3
//                         style={{
//                           fontSize: 18,
//                           fontWeight: 600,
//                           marginBottom: 16,
//                           color: "#374151",
//                           display: "flex",
//                           alignItems: "center",
//                           gap: 8,
//                         }}
//                       >
//                         <span style={{ color: "#3b82f6" }}>•</span> Assets by Category
//                       </h3>
//                       <Bar data={prepareChartData(stats.bycategory, "Assets")} options={chartOptions} />
//                     </div>
//                   )}

//                   {/* Assets by Status */}
//                   {stats.bystatus && stats.bystatus.length > 0 && (
//                     <div
//                       style={{
//                         border: "1px solid #e5e7eb",
//                         borderRadius: 12,
//                         padding: 24,
//                         backgroundColor: "white",
//                         boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//                       }}
//                     >
//                       <h3
//                         style={{
//                           fontSize: 18,
//                           fontWeight: 600,
//                           marginBottom: 16,
//                           color: "#374151",
//                           display: "flex",
//                           alignItems: "center",
//                           gap: 8,
//                         }}
//                       >
//                         <span style={{ color: "#10b981" }}>•</span> Assets by Status
//                       </h3>
//                       <Pie data={prepareChartData(stats.bystatus, "Assets")} options={chartOptions} />
//                     </div>
//                   )}

//                   {/* Assets by Department */}
//                   {stats.bydepartment && stats.bydepartment.length > 0 && (
//                     <div
//                       style={{
//                         border: "1px solid #e5e7eb",
//                         borderRadius: 12,
//                         padding: 24,
//                         backgroundColor: "white",
//                         boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//                       }}
//                     >
//                       <h3
//                         style={{
//                           fontSize: 18,
//                           fontWeight: 600,
//                           marginBottom: 16,
//                           color: "#374151",
//                           display: "flex",
//                           alignItems: "center",
//                           gap: 8,
//                         }}
//                       >
//                         <span style={{ color: "#8b5cf6" }}>•</span> Assets by Department
//                       </h3>
//                       <Bar data={prepareChartData(stats.bydepartment, "Assets")} options={chartOptions} />
//                     </div>
//                   )}

//                   {/* Assets by Institute */}
//                   {stats.byinstitute && stats.byinstitute.length > 0 && (
//                     <div
//                       style={{
//                         border: "1px solid #e5e7eb",
//                         borderRadius: 12,
//                         padding: 24,
//                         backgroundColor: "white",
//                         boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//                       }}
//                     >
//                       <h3
//                         style={{
//                           fontSize: 18,
//                           fontWeight: 600,
//                           marginBottom: 16,
//                           color: "#374151",
//                           display: "flex",
//                           alignItems: "center",
//                           gap: 8,
//                         }}
//                       >
//                         <span style={{ color: "#6366f1" }}>•</span> Assets by Institute
//                       </h3>
//                       <Doughnut data={prepareChartData(stats.byinstitute, "Assets")} options={chartOptions} />
//                     </div>
//                   )}

//                   {/* Single Assets by Assigned Type */}
//                   {stats.byassignedtype && stats.byassignedtype.length > 0 && (
//                     <div
//                       style={{
//                         border: "1px solid #e5e7eb",
//                         borderRadius: 12,
//                         padding: 24,
//                         backgroundColor: "white",
//                         boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//                       }}
//                     >
//                       <h3
//                         style={{
//                           fontSize: 18,
//                           fontWeight: 600,
//                           marginBottom: 16,
//                           color: "#374151",
//                           display: "flex",
//                           alignItems: "center",
//                           gap: 8,
//                         }}
//                       >
//                         <span style={{ color: "#f97316" }}>•</span> Single Assets by Type (General/Individual)
//                       </h3>
//                       <Doughnut
//                         data={prepareChartData(stats.byassignedtype, "Single Assets")}
//                         options={chartOptions}
//                       />
//                     </div>
//                   )}

//                   {/* Top Locations */}
//                   {stats.bylocation && stats.bylocation.length > 0 && (
//                     <div
//                       style={{
//                         border: "1px solid #e5e7eb",
//                         borderRadius: 12,
//                         padding: 24,
//                         backgroundColor: "white",
//                         boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//                       }}
//                     >
//                       <h3
//                         style={{
//                           fontSize: 18,
//                           fontWeight: 600,
//                           marginBottom: 16,
//                           color: "#374151",
//                           display: "flex",
//                           alignItems: "center",
//                           gap: 8,
//                         }}
//                       >
//                         <span style={{ color: "#ef4444" }}>•</span> Locations
//                       </h3>
//                       <Bar data={prepareChartData(stats.bylocation, "Assets")} options={chartOptions} />
//                     </div>
//                   )}
//                 </div>
//               </>
//             )}
//           </>
//         )}
//       </div>
//     </div>
//   );
// }






// src/components/GraphView.jsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const API = process.env.REACT_APP_BACKEND_PORT || "http://localhost:5000";

export default function GraphView() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filterOptions, setFilterOptions] = useState({
    asset_names: [],
    categories: []
  });

  const [filters, setFilters] = useState({
    asset_name: "",
    category: ""
  });

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const res = await fetch(`${API}/api/assets/filter-options`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch filter options");
      const data = await res.json();
      if (data.success) {
        setFilterOptions({
          asset_names: data.asset_names || [],
          categories: data.categories || [],
        });
      }
    } catch (err) {
      setFilterOptions({ asset_names: [], categories: [] });
    }
  };

  useEffect(() => {
    fetchStats();
  }, [filters]);

  const fetchStats = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.asset_name) params.set("asset_name", filters.asset_name);
      if (filters.category) params.set("category", filters.category);
      const res = await fetch(`${API}/api/assets/stats?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch statistics");
      const data = await res.json();
      if (data.success) {
        setStats(data);
      } else {
        setError(data.error || "Failed to load data");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Provide color palette for many asset types
  const palette = [
    "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16",
    "#6366f1","#eab308","#d97706","#f472b6","#f87171","#2563eb","#059669","#a21caf",
    "#facc15","#292524","#d1fae5","#60a5fa","#b91c1c","#0077b6","#9ca3af","#c026d3",
    "#475569","#fde047","#be185d","#ffb703","#fb7185"
  ];
  const prepareChartData = (dataArray, label) => {
    const colors = [];
    for(let i=0;i<dataArray.length;i++) colors.push(palette[i%palette.length]);
    return {
      labels: dataArray.map(item => item._id || "Unknown"),
      datasets: [{
        label: label,
        data: dataArray.map(item => item.count),
        backgroundColor: colors,
        borderWidth: 1,
      }],
    };
  };

  const horizontalScrollContainer = {
    overflowX: "auto",
    paddingBottom: "8px",
    maxWidth: "100%",
    minWidth: 0
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    layout: { padding: 12 },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { autoSkip: false, maxRotation: 70, minRotation: 10, font: { size: 14 } }
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 }
      }
    }
  };

  const selectStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    backgroundColor: 'white',
    fontSize: '14px',
    color: '#1f2937',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px',
    paddingRight: '36px'
  };
  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '8px',
    color: '#374151'
  };

  // Use stats.by_asset for asset name graph (how many chairs, tables, etc)
  const assetNameGraphData = stats && stats.by_asset ? stats.by_asset : [];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', margin: 0, display: "flex", alignItems:"center", gap:'7px' }}>
            <span>📊</span> Asset Analytics Dashboard
          </h2>
          <button onClick={() => navigate(-1)} style={{ padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}>
            <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '20px', width: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '30px', padding: '14px 10px', background: 'linear-gradient(to right, #eef2ff, #f3e8ff)', borderRadius: '12px', border: '1px solid #e0e7ff', }}>
          <div>
            <label style={labelStyle}>Asset Name</label>
            <select style={selectStyle} value={filters.asset_name} onChange={e => setFilters({ ...filters, asset_name: e.target.value })}>
              <option value="">All asset names</option>
              {filterOptions.asset_names.map(name => (<option key={name} value={name}>{name}</option>))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={selectStyle} value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All categories</option>
              {filterOptions.categories.map(category => (<option key={category} value={category}>{category}</option>))}
            </select>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ display: 'inline-block', width: '48px', height: '48px', border: '3px solid #e5e7eb', borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading statistics...</p>
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px' }}>
              <p style={{ fontWeight: '600', margin: '0 0 8px 0' }}>Error:</p>
              <p style={{ margin: 0 }}>{error}</p>
            </div>
          </div>
        )}

        {/* Asset Name Graph (counts of each asset like Chair, Table, etc) */}
    

        {/* Asset Category Graph */}
        {stats && stats.by_asset && stats.by_asset.length > 0 && (
          <div style={{ ...horizontalScrollContainer, minHeight: 410, background: "#f8fafc", borderRadius: "10px", border: "1px solid #e5e7eb", padding: "18px 18px 12px 18px" }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
              <span style={{ color: '#0ea5e9' }}>🪑</span> Asset Names: Quantity of Each Type
            </h3>
            <div style={{ width: Math.max(600, stats.by_asset.length * 50), minWidth: 600, height: 350 }}>
              <Bar data={prepareChartData(stats.by_asset, "Asset Quantity")} options={chartOptions} />
            </div>
          </div>
        )}

        {stats && stats.by_category && stats.by_category.length > 0 && (
          <div style={{ ...horizontalScrollContainer, minHeight: 410, background: "#f8fafc", borderRadius: "10px", border: "1px solid #e5e7eb", padding: "18px 18px 12px 18px", marginTop: "24px" }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
              <span style={{ color: '#3b82f6' }}>📦</span> Assets by Category
            </h3>
            <div style={{ width: Math.max(600, stats.by_category.length * 50), minWidth: 600, height: 350 }}>
              <Bar data={prepareChartData(stats.by_category, "Assets")} options={chartOptions} />
            </div>
          </div>
        )}


        


      </div>
    </div>
  );
}
