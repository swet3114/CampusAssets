// src/components/Profile.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_BACKEND_PORT || "http://localhost:5000";

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API}/api/auth/me`, { credentials: "include" });
        if (!alive) return;
        if (!res.ok) {
          setLoading(false);
          setStatus({ ok: false, msg: "Unauthorized. Please log in." });
          return;
        }
        const data = await res.json();
        setUser(data);
        setName(data.name || "");
        setLoading(false);
      } catch {
        if (!alive) return;
        setLoading(false);
        setStatus({ ok: false, msg: "Network error" });
      }
    })();
    return () => { alive = false; };
  }, []);

  const onSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setStatus({ ok: false, msg: "Name cannot be empty" });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`${API}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, msg: data.error || "Failed to update" });
      } else {
        setUser((u) => (u ? { ...u, name: data.name } : u));
        setStatus({ ok: true, msg: "Profile updated" });
      }
    } catch {
      setStatus({ ok: false, msg: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    } finally {
      sessionStorage.removeItem("user");
      navigate("/login", { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <p className="text-gray-600">Loading profile…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <p className="text-red-600">Unable to load profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Profile</h2>
        <button
          onClick={onLogout}
          className="px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-black"
          title="Logout"
        >
          Logout
        </button>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <div className="text-gray-500">Employee ID</div>
          <div className="font-medium">{user.emp_id}</div>
        </div>
        <div>
          <div className="text-gray-500">Role</div>
          <div className="font-medium">{user.role}</div>
        </div>
      </div>

      <form onSubmit={onSave} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            required
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className={`px-4 py-2 rounded text-white ${saving ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </form>

      {status && (
        <p className={`mt-4 text-sm ${status.ok ? "text-green-600" : "text-red-600"}`}>
          {status.msg}
        </p>
      )}
    </div>
  );
}



// --------------------------Working----------------------------------

// // src/components/Profile.jsx
// import { useEffect, useState } from "react";

// const API = "http://localhost:5000";

// export default function Profile() {
//   const [loading, setLoading] = useState(true);
//   const [user, setUser] = useState(null); // {_id, emp_id, name, role}
//   const [name, setName] = useState("");
//   const [status, setStatus] = useState(null); // { ok:boolean, msg:string }
//   const [saving, setSaving] = useState(false);

//   useEffect(() => {
//     let alive = true;
//     (async () => {
//       try {
//         const res = await fetch(`${API}/api/auth/me`, { credentials: "include" });
//         if (!alive) return;
//         if (!res.ok) {
//           setLoading(false);
//           setStatus({ ok: false, msg: "Unauthorized. Please log in." });
//           return;
//         }
//         const data = await res.json();
//         setUser(data);
//         setName(data.name || "");
//         setLoading(false);
//       } catch {
//         if (!alive) return;
//         setLoading(false);
//         setStatus({ ok: false, msg: "Network error" });
//       }
//     })();
//     return () => { alive = false; };
//   }, []);

//   const onSave = async (e) => {
//     e.preventDefault();
//     if (!name.trim()) {
//       setStatus({ ok: false, msg: "Name cannot be empty" });
//       return;
//     }
//     setSaving(true);
//     setStatus(null);
//     try {
//       const res = await fetch(`${API}/api/auth/profile`, {
//         method: "PUT",
//         headers: { "Content-Type": "application/json" },
//         credentials: "include",
//         body: JSON.stringify({ name: name.trim() }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         setStatus({ ok: false, msg: data.error || "Failed to update" });
//       } else {
//         setUser((u) => (u ? { ...u, name: data.name } : u));
//         setStatus({ ok: true, msg: "Profile updated" });
//       }
//     } catch {
//       setStatus({ ok: false, msg: "Network error" });
//     } finally {
//       setSaving(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="max-w-xl mx-auto p-6">
//         <p className="text-gray-600">Loading profile…</p>
//       </div>
//     );
//   }

//   if (!user) {
//     return (
//       <div className="max-w-xl mx-auto p-6">
//         <p className="text-red-600">Unable to load profile.</p>
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-xl mx-auto p-6 bg-white rounded shadow">
//       <h2 className="text-xl font-semibold mb-4">My Profile</h2>

//       <div className="space-y-3 text-sm">
//         <div>
//           <div className="text-gray-500">Employee ID</div>
//           <div className="font-medium">{user.emp_id}</div>
//         </div>
//         <div>
//           <div className="text-gray-500">Role</div>
//           <div className="font-medium">{user.role}</div>
//         </div>
//       </div>

//       <form onSubmit={onSave} className="mt-6 space-y-4">
//         <div>
//           <label className="block text-sm mb-1">Name</label>
//           <input
//             className="w-full border rounded px-3 py-2"
//             value={name}
//             onChange={(e) => setName(e.target.value)}
//             placeholder="Enter your name"
//             required
//           />
//         </div>

//         <button
//           type="submit"
//           disabled={saving}
//           className={`px-4 py-2 rounded text-white ${saving ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
//         >
//           {saving ? "Saving..." : "Save"}
//         </button>
//       </form>

//       {status && (
//         <p className={`mt-4 text-sm ${status.ok ? "text-green-600" : "text-red-600"}`}>
//           {status.msg}
//         </p>
//       )}
//     </div>
//   );
// }
