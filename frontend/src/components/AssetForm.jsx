// // src/components/AssetForm.jsx
// import { useState } from "react";

// export default function AssetForm() {
//   const [form, setForm] = useState({
//     product_name: "",
//     location: "",
//     desc: "",
//   });
//   const [status, setStatus] = useState(null);

//   const onChange = (e) => {
//     setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
//   };

//   const onSubmit = async (e) => {
//     e.preventDefault();
//     setStatus(null);
//     try {
//       const res = await fetch("http://localhost:5000/api/assets", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(form),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         setStatus({ ok: false, msg: data.error || "Failed to create asset" });
//       } else {
//         setStatus({ ok: true, msg: `Asset created. QR ID: ${data.qr_id}` });
//         setForm({ product_name: "", location: "", desc: "" });
//       }
//     } catch {
//       setStatus({ ok: false, msg: "Network error" });
//     }
//   };

//   return (
//     <div className="max-w-xl mx-auto p-6 bg-white rounded shadow">
//       <h2 className="text-xl font-semibold mb-4">Add Asset</h2>
//       <form onSubmit={onSubmit} className="space-y-4">
//         <div>
//           <label className="block text-sm mb-1">Product Name</label>
//           <input
//             className="w-full border rounded px-3 py-2"
//             name="product_name"
//             value={form.product_name}
//             onChange={onChange}
//             required
//           />
//         </div>
//         <div>
//           <label className="block text-sm mb-1">Location</label>
//           <input
//             className="w-full border rounded px-3 py-2"
//             name="location"
//             value={form.location}
//             onChange={onChange}
//             required
//           />
//         </div>
//         <div>
//           <label className="block text-sm mb-1">Description</label>
//           <textarea
//             className="w-full border rounded px-3 py-2"
//             name="desc"
//             value={form.desc}
//             onChange={onChange}
//             rows={3}
//           />
//         </div>

//         <button
//           type="submit"
//           className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
//         >
//           Save
//         </button>
//       </form>
//       {status && (
//         <p className={`mt-3 ${status.ok ? "text-green-600" : "text-red-600"}`}>
//           {status.msg}
//         </p>
//       )}
//     </div>
//   );
// }









// import { useState } from "react";

// export default function AssetForm() {
//   const [form, setForm] = useState({
//     product_name: "",
//     location: "",
//     desc: "",
//     quantity: 1,
//   });
//   const [status, setStatus] = useState(null);
//   const [created, setCreated] = useState([]); // store created items to show qr_ids
//   const API = "http://localhost:5000";

//   const onChange = (e) => {
//     const { name, value } = e.target;
//     setForm((f) => ({
//       ...f,
//       [name]: name === "quantity" ? Math.max(1, parseInt(value || "1", 10)) : value,
//     }));
//   };

//   const onSubmit = async (e) => {
//     e.preventDefault();
//     setStatus(null);
//     setCreated([]);
//     try {
//       const res = await fetch(`${API}/api/assets/bulk`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           product_name: form.product_name,
//           location: form.location,
//           desc: form.desc,
//           quantity: form.quantity,
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         setStatus({ ok: false, msg: data.error || "Failed to create assets" });
//       } else {
//         setStatus({ ok: true, msg: `Created ${data.count} assets` });
//         setCreated(Array.isArray(data.items) ? data.items : []);
//         setForm({ product_name: "", location: "", desc: "", quantity: 1 });
//       }
//     } catch (err) {
//       setStatus({ ok: false, msg: "Network error" });
//     }
//   };

//   return (
//     <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
//       <h2 className="text-xl font-semibold mb-4">Add Assets (Bulk)</h2>
//       <form onSubmit={onSubmit} className="space-y-4">
//         <div>
//           <label className="block text-sm mb-1">Product Name</label>
//           <input
//             className="w-full border rounded px-3 py-2"
//             name="product_name"
//             value={form.product_name}
//             onChange={onChange}
//             placeholder="Chair"
//             required
//           />
//         </div>
//         <div>
//           <label className="block text-sm mb-1">Location</label>
//           <input
//             className="w-full border rounded px-3 py-2"
//             name="location"
//             value={form.location}
//             onChange={onChange}
//             placeholder="Hall A"
//             required
//           />
//         </div>
//         <div>
//           <label className="block text-sm mb-1">Description</label>
//           <textarea
//             className="w-full border rounded px-3 py-2"
//             name="desc"
//             value={form.desc}
//             onChange={onChange}
//             rows={3}
//             placeholder="Plastic chair, black"
//           />
//         </div>
//         <div>
//           <label className="block text-sm mb-1">Quantity</label>
//           <input
//             type="number"
//             className="w-full border rounded px-3 py-2"
//             name="quantity"
//             min={1}
//             value={form.quantity}
//             onChange={onChange}
//             required
//           />
//         </div>
//         <button
//           type="submit"
//           className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
//         >
//           Save
//         </button>
//       </form>

//       {status && (
//         <p className={`mt-3 ${status.ok ? "text-green-600" : "text-red-600"}`}>
//           {status.msg}
//         </p>
//       )}

//       {created.length > 0 && (
//         <div className="mt-6">
//           <h3 className="text-lg font-semibold mb-2">Generated QR IDs</h3>
//           <ul className="list-disc pl-5 space-y-1">
//             {created.map((it) => (
//               <li key={it._id} className="font-mono text-sm">
//                 {it.qr_id} — {it.product_name} @ {it.location}
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}
//     </div>
//   );
// }
























// src/components/AssetForm.jsx
import { useMemo, useState } from "react";

const API = "http://localhost:5000";

const STATUS_OPTIONS = ["active", "inactive", "repair", "scrape", "damage"];
const ASSIGNED_TYPE_OPTIONS = ["general", "individual"];

export default function AssetForm() {
  const [form, setForm] = useState({
    asset_name: "",
    category: "",
    location: "",
    assign_date: "",               // optional (YYYY-MM-DD)
    status: "active",
    desc: "",                      // optional
    institute: "",                 // optional
    department: "",                // optional
    assigned_type: "general",
    assigned_faculty_name: "",
    quantity: 1,
  });

  const [statusMsg, setStatusMsg] = useState(null);
  const [created, setCreated] = useState([]);

  const needsFaculty = useMemo(
    () => form.assigned_type === "individual",
    [form.assigned_type]
  );

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
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
        };
      }
      return { ...f, [name]: value };
    });
  };

  const validate = () => {
    const errors = [];
    if (!form.asset_name.trim()) errors.push("Asset Name is required");
    if (!form.category.trim()) errors.push("Category is required");
    if (!form.location.trim()) errors.push("Location is required");
    if (!STATUS_OPTIONS.includes(form.status)) errors.push("Invalid status");
    if (!ASSIGNED_TYPE_OPTIONS.includes(form.assigned_type)) errors.push("Invalid assigned type");
    if (needsFaculty && !form.assigned_faculty_name.trim()) {
      errors.push("Assigned Faculty Name is required for 'individual'");
    }
    if (form.quantity < 1) errors.push("Quantity must be at least 1");
    return errors;
  };

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
      // Do NOT send verification_date, verified, or verified_by — backend sets defaults
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
          quantity: 1,
        });
      }
    } catch {
      setStatusMsg({ ok: false, msg: "Network error" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Add Assets</h2>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Primary details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Asset Name</label>
            <input
              className="w-full border rounded px-3 py-2"
              name="asset_name"
              value={form.asset_name}
              onChange={onChange}
              placeholder="Laptop"
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
              placeholder="Electronics / Stationary"
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
              placeholder="Lab-101"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Assign Date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              name="assign_date"
              required
              value={form.assign_date}
              onChange={onChange}
            />
          </div>
        </div>

        {/* Status and description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <label className="block text-sm mb-1">Description</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              name="desc"
              value={form.desc}
              onChange={onChange}
              rows={3}
              placeholder="Model, specs, condition..."
            />
          </div>
        </div>

        {/* Institute / Department (optional) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Institute</label>
            <input
              className="w-full border rounded px-3 py-2"
              name="institute"
              value={form.institute}
              onChange={onChange}
              placeholder="UVPCE"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Department</label>
            <input
              className="w-full border rounded px-3 py-2"
              name="department"
              value={form.department}
              onChange={onChange}
              placeholder="IT"
              required
            />
          </div>
        </div>

        {/* Assignment */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1">Assigned Type</label>
            <select
              className="w-full border rounded px-3 py-2"
              name="assigned_type"
              value={form.assigned_type}
              onChange={onChange}
              required
            >
              <option value="general">general</option>
              <option value="individual">individual</option>
            </select>
          </div>

          <div className={`${form.assigned_type === "individual" ? "" : "opacity-60"}`}>
            <label className="block text-sm mb-1">
              Assigned Faculty Name {form.assigned_type === "individual" ? "" : "(disabled)"}
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              name="assigned_faculty_name"
              value={form.assigned_faculty_name}
              onChange={onChange}
              placeholder="Dr. A B"
              disabled={form.assigned_type !== "individual"}
              required={form.assigned_type === "individual"}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Quantity</label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2"
              name="quantity"
              min={1}
              value={form.quantity}
              onChange={onChange}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
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
              <li key={it._id} className="font-mono text-sm">
                {it.registration_number} — {it.asset_name} @ {it.location} [{it.status}]
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
