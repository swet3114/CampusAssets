// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_BACKEND_PORT || "http://localhost:5000";
const ROLES = ["Super_Admin", "Admin", "Faculty", "Verifier"];

export default function Login() {
    const [mode, setMode] = useState("login"); // "login" | "signup"
    const [status, setStatus] = useState(null); // { ok:boolean, msg:string }
    const navigate = useNavigate();

    const [signup, setSignup] = useState({
        emp_id: "",
        name: "",
        password: "",
        role: "Faculty",
        secret_key: "",
    });

    const [login, setLogin] = useState({
        emp_id: "",
        password: "",
    });

    const onChangeSignup = (e) => {
        const { name, value } = e.target;
        setSignup((s) => ({ ...s, [name]: value }));
    };

    const onChangeLogin = (e) => {
        const { name, value } = e.target;
        setLogin((s) => ({ ...s, [name]: value }));
    };


    const doSignup = async (e) => {
        e.preventDefault();
        setStatus(null);
        const payload = {
            emp_id: signup.emp_id,
            name: signup.name,
            password: signup.password,
            role: signup.role,
            secret_key: signup.secret_key,
        };
        try {
            const res = await fetch("http://localhost:5000/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                setStatus({ ok: false, msg: data.error || "Signup failed" });
            } else {
                if (data.user) sessionStorage.setItem("user", JSON.stringify(data.user));
                navigate("/home", { replace: true });
            }
        } catch {
            setStatus({ ok: false, msg: "Network error" });
        }
    };


    const doLogin = async (e) => {
        e.preventDefault();
        setStatus(null);
        try {
            const res = await fetch("http://localhost:5000/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ emp_id: login.emp_id, password: login.password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setStatus({ ok: false, msg: data.error || "Invalid credentials" });
            } else {
                if (data.user) sessionStorage.setItem("user", JSON.stringify(data.user));
                navigate("/home", { replace: true });
            }
        } catch {
            setStatus({ ok: false, msg: "Network error" });
        }
    };



    return (
        // Full-height centered wrapper
        <div className="min-h-screen grid place-items-center bg-gray-50 px-4">
            {/* Responsive grid: mobile = 1 col (gif above), md+ = 2 cols (gif left, form right) */}
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

                {/* GIF column */}
                <div className="flex justify-center md:justify-start">
                    <img
                        src="/animation/Animation.gif"
                        alt="Login animation"
                        className="w-full max-w-sm md:max-w-md h-auto object-contain"
                        loading="eager"
                    />
                </div>

                {/* Card column (your existing form card) */}
                <div className="w-full max-w-md mx-auto p-6 bg-white rounded shadow">
                    <div className="flex items-center justify-center gap-2 mb-6">
                        <button
                            onClick={() => setMode("login")}
                            className={`px-4 py-2 rounded ${mode === "login" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
                        >
                            Log in
                        </button>
                        <button
                            onClick={() => setMode("signup")}
                            className={`px-4 py-2 rounded ${mode === "signup" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
                        >
                            Sign up
                        </button>
                    </div>


                    {mode === "signup" ? (
                        <form onSubmit={doSignup} className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1">Employee ID</label>
                                <input
                                    className="w-full border rounded px-3 py-2"
                                    name="emp_id"
                                    value={signup.emp_id}
                                    onChange={onChangeSignup}
                                    placeholder="EMP00123"
                                    required
                                    autoComplete="username"
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-1">Name</label>
                                <input
                                    className="w-full border rounded px-3 py-2"
                                    name="name"
                                    value={signup.name}
                                    onChange={onChangeSignup}
                                    placeholder="Jane Doe"
                                    required
                                    autoComplete="name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-1">Password</label>
                                <input
                                    type="password"
                                    className="w-full border rounded px-3 py-2"
                                    name="password"
                                    value={signup.password}
                                    onChange={onChangeSignup}
                                    required
                                    autoComplete="new-password"
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-1">Role</label>
                                <select
                                    className="w-full border rounded px-3 py-2"
                                    name="role"
                                    value={signup.role}
                                    onChange={onChangeSignup}
                                    required
                                >
                                    {ROLES.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm mb-1">Secret key</label>
                                <input
                                    type="password"
                                    className="w-full border rounded px-3 py-2"
                                    name="secret_key"
                                    value={signup.secret_key}
                                    onChange={onChangeSignup}
                                    placeholder="Enter org secret"
                                    required
                                    autoComplete="off"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Ask the administrator for the secret key to create an account.
                                </p>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                            >
                                Create account
                            </button>

                            <p className="text-sm text-center mt-2">
                                Already signed up?{" "}
                                <button type="button" onClick={() => setMode("login")} className="text-indigo-600 underline">
                                    Log in
                                </button>
                            </p>
                        </form>
                    ) : (
                        <form onSubmit={doLogin} className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1">Employee ID</label>
                                <input
                                    className="w-full border rounded px-3 py-2"
                                    name="emp_id"
                                    value={login.emp_id}
                                    onChange={onChangeLogin}
                                    placeholder="EMP00123"
                                    required
                                    autoComplete="username"
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-1">Password</label>
                                <input
                                    type="password"
                                    className="w-full border rounded px-3 py-2"
                                    name="password"
                                    value={login.password}
                                    onChange={onChangeLogin}
                                    required
                                    autoComplete="current-password"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gray-900 text-white px-4 py-2 rounded hover:bg-black"
                            >
                                Log in
                            </button>

                            <p className="text-sm text-center mt-2">
                                New user?{" "}
                                <button type="button" onClick={() => setMode("signup")} className="text-indigo-600 underline">
                                    Create an account
                                </button>
                            </p>
                        </form>
                    )}


                    {status && (
                        <p className={`mt-4 text-sm ${status.ok ? "text-green-600" : "text-red-600"}`}>{status.msg}</p>
                    )}
                </div>
            </div>
        </div>
    );
}








// ------------Github------------------

// // src/pages/Login.jsx
// import { useState } from "react";
// import { useNavigate } from "react-router-dom";

// const API = "http://localhost:5000";
// const ROLES = ["Super_Admin", "Admin", "Faculty", "Verifier"];

// export default function Login() {
//     const [mode, setMode] = useState("login"); // "login" | "signup"
//     const [status, setStatus] = useState(null); // { ok:boolean, msg:string }
//     const navigate = useNavigate();

//     const [signup, setSignup] = useState({
//         emp_id: "",
//         name: "",
//         password: "",
//         role: "Faculty",
//         secret_key: "",
//     });

//     const [login, setLogin] = useState({
//         emp_id: "",
//         password: "",
//     });

//     const onChangeSignup = (e) => {
//         const { name, value } = e.target;
//         setSignup((s) => ({ ...s, [name]: value }));
//     };

//     const onChangeLogin = (e) => {
//         const { name, value } = e.target;
//         setLogin((s) => ({ ...s, [name]: value }));
//     };


//     const doSignup = async (e) => {
//         e.preventDefault();
//         setStatus(null);
//         const payload = {
//             emp_id: signup.emp_id,
//             name: signup.name,
//             password: signup.password,
//             role: signup.role,
//             secret_key: signup.secret_key,
//         };
//         try {
//             const res = await fetch("http://localhost:5000/api/auth/signup", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 credentials: "include",
//                 body: JSON.stringify(payload),
//             });
//             const data = await res.json();
//             if (!res.ok) {
//                 setStatus({ ok: false, msg: data.error || "Signup failed" });
//             } else {
//                 if (data.user) sessionStorage.setItem("user", JSON.stringify(data.user));
//                 navigate("/home", { replace: true });
//             }
//         } catch {
//             setStatus({ ok: false, msg: "Network error" });
//         }
//     };


//     const doLogin = async (e) => {
//         e.preventDefault();
//         setStatus(null);
//         try {
//             const res = await fetch("http://localhost:5000/api/auth/login", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 credentials: "include",
//                 body: JSON.stringify({ emp_id: login.emp_id, password: login.password }),
//             });
//             const data = await res.json();
//             if (!res.ok) {
//                 setStatus({ ok: false, msg: data.error || "Invalid credentials" });
//             } else {
//                 if (data.user) sessionStorage.setItem("user", JSON.stringify(data.user));
//                 navigate("/home", { replace: true });
//             }
//         } catch {
//             setStatus({ ok: false, msg: "Network error" });
//         }
//     };




//     return (
//         <div className="max-w-md mx-auto p-6 bg-white rounded shadow">
//             <div className="flex items-center justify-center gap-2 mb-6">
//                 <button
//                     onClick={() => setMode("login")}
//                     className={`px-4 py-2 rounded ${mode === "login" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
//                 >
//                     Log in
//                 </button>
//                 <button
//                     onClick={() => setMode("signup")}
//                     className={`px-4 py-2 rounded ${mode === "signup" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
//                 >
//                     Sign up
//                 </button>
//             </div>

//             {mode === "signup" ? (
//                 <form onSubmit={doSignup} className="space-y-4">
//                     <div>
//                         <label className="block text-sm mb-1">Employee ID</label>
//                         <input
//                             className="w-full border rounded px-3 py-2"
//                             name="emp_id"
//                             value={signup.emp_id}
//                             onChange={onChangeSignup}
//                             placeholder="EMP00123"
//                             required
//                             autoComplete="username"
//                         />
//                     </div>

//                     <div>
//                         <label className="block text-sm mb-1">Name</label>
//                         <input
//                             className="w-full border rounded px-3 py-2"
//                             name="name"
//                             value={signup.name}
//                             onChange={onChangeSignup}
//                             placeholder="Jane Doe"
//                             required
//                             autoComplete="name"
//                         />
//                     </div>

//                     <div>
//                         <label className="block text-sm mb-1">Password</label>
//                         <input
//                             type="password"
//                             className="w-full border rounded px-3 py-2"
//                             name="password"
//                             value={signup.password}
//                             onChange={onChangeSignup}
//                             required
//                             autoComplete="new-password"
//                         />
//                     </div>

//                     <div>
//                         <label className="block text-sm mb-1">Role</label>
//                         <select
//                             className="w-full border rounded px-3 py-2"
//                             name="role"
//                             value={signup.role}
//                             onChange={onChangeSignup}
//                             required
//                         >
//                             {ROLES.map((r) => (
//                                 <option key={r} value={r}>{r}</option>
//                             ))}
//                         </select>
//                     </div>

//                     <div>
//                         <label className="block text-sm mb-1">Secret key</label>
//                         <input
//                             type="password"
//                             className="w-full border rounded px-3 py-2"
//                             name="secret_key"
//                             value={signup.secret_key}
//                             onChange={onChangeSignup}
//                             placeholder="Enter org secret"
//                             required
//                             autoComplete="off"
//                         />
//                         <p className="text-xs text-gray-500 mt-1">
//                             Ask the administrator for the secret key to create an account.
//                         </p>
//                     </div>

//                     <button
//                         type="submit"
//                         className="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
//                     >
//                         Create account
//                     </button>

//                     <p className="text-sm text-center mt-2">
//                         Already signed up?{" "}
//                         <button type="button" onClick={() => setMode("login")} className="text-indigo-600 underline">
//                             Log in
//                         </button>
//                     </p>
//                 </form>
//             ) : (
//                 <form onSubmit={doLogin} className="space-y-4">
//                     <div>
//                         <label className="block text-sm mb-1">Employee ID</label>
//                         <input
//                             className="w-full border rounded px-3 py-2"
//                             name="emp_id"
//                             value={login.emp_id}
//                             onChange={onChangeLogin}
//                             placeholder="EMP00123"
//                             required
//                             autoComplete="username"
//                         />
//                     </div>

//                     <div>
//                         <label className="block text-sm mb-1">Password</label>
//                         <input
//                             type="password"
//                             className="w-full border rounded px-3 py-2"
//                             name="password"
//                             value={login.password}
//                             onChange={onChangeLogin}
//                             required
//                             autoComplete="current-password"
//                         />
//                     </div>

//                     <button
//                         type="submit"
//                         className="w-full bg-gray-900 text-white px-4 py-2 rounded hover:bg-black"
//                     >
//                         Log in
//                     </button>

//                     <p className="text-sm text-center mt-2">
//                         New user?{" "}
//                         <button type="button" onClick={() => setMode("signup")} className="text-indigo-600 underline">
//                             Create an account
//                         </button>
//                     </p>
//                 </form>
//             )}

//             {status && (
//                 <p className={`mt-4 text-sm ${status.ok ? "text-green-600" : "text-red-600"}`}>
//                     {status.msg}
//                 </p>
//             )}
//         </div>
//     );
// }


















// // src/pages/Login.jsx
// import { useState } from "react";
// import { useNavigate } from "react-router-dom";

// const API = "http://localhost:5000";

// const ROLES = ["Super_Admin", "Admin", "Faculty", "Verifier"];

// export default function Login() {
//   const [mode, setMode] = useState("login"); // "login" | "signup"
//   const [status, setStatus] = useState(null); // { ok:boolean, msg:string }
//   const navigate = useNavigate();

//   const [signup, setSignup] = useState({
//     emp_id: "",
//     name: "",
//     password: "",
//     role: "Faculty",
//     secret_key: "",
//   });

//   const [login, setLogin] = useState({
//     emp_id: "",
//     password: "",
//   });

//   const onChangeSignup = (e) => {
//     const { name, value } = e.target;
//     setSignup((s) => ({ ...s, [name]: value }));
//   };
//   const onChangeLogin = (e) => {
//     const { name, value } = e.target;
//     setLogin((s) => ({ ...s, [name]: value }));
//   };

//   const doSignup = async (e) => {
//     e.preventDefault();
//     setStatus(null);
//     try {
//       const res = await fetch(`${API}/api/auth/signup`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(signup),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         setStatus({ ok: false, msg: data.error || "Signup failed" });
//       } else {
//         setStatus({ ok: true, msg: "Signup successful. You can log in now." });
//         setMode("login");
//         setSignup({ emp_id: "", name: "", password: "", role: "Faculty", secret_key: "" });
//       }
//     } catch {
//       setStatus({ ok: false, msg: "Network error" });
//     }
//   };

//   const doLogin = async (e) => {
//     e.preventDefault();
//     setStatus(null);
//     try {
//       const res = await fetch(`${API}/api/auth/login`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(login),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         setStatus({ ok: false, msg: data.error || "Invalid credentials" });
//       } else {
//         // Store token/user profile if provided
//         if (data.token) localStorage.setItem("token", data.token);
//         if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
//         setStatus({ ok: true, msg: "Logged in successfully" });
//         navigate("/"); // redirect home or dashboard
//       }
//     } catch {
//       setStatus({ ok: false, msg: "Network error" });
//     }
//   };

//   return (
//     <div className="max-w-md mx-auto p-6 bg-white rounded shadow">
//       <div className="flex items-center justify-center gap-2 mb-6">
//         <button
//           onClick={() => setMode("login")}
//           className={`px-4 py-2 rounded ${mode === "login" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
//         >
//           Log in
//         </button>
//         <button
//           onClick={() => setMode("signup")}
//           className={`px-4 py-2 rounded ${mode === "signup" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
//         >
//           Sign up
//         </button>
//       </div>

//       {mode === "signup" ? (
//         <form onSubmit={doSignup} className="space-y-4">
//           <div>
//             <label className="block text-sm mb-1">Employee ID</label>
//             <input
//               className="w-full border rounded px-3 py-2"
//               name="emp_id"
//               value={signup.emp_id}
//               onChange={onChangeSignup}
//               placeholder="EMP00123"
//               required
//             />
//           </div>

//           <div>
//             <label className="block text-sm mb-1">Name</label>
//             <input
//               className="w-full border rounded px-3 py-2"
//               name="name"
//               value={signup.name}
//               onChange={onChangeSignup}
//               placeholder="Jane Doe"
//               required
//             />
//           </div>

//           <div>
//             <label className="block text-sm mb-1">Password</label>
//             <input
//               type="password"
//               className="w-full border rounded px-3 py-2"
//               name="password"
//               value={signup.password}
//               onChange={onChangeSignup}
//               required
//             />
//           </div>

//           <div>
//             <label className="block text-sm mb-1">Role</label>
//             <select
//               className="w-full border rounded px-3 py-2"
//               name="role"
//               value={signup.role}
//               onChange={onChangeSignup}
//               required
//             >
//               {ROLES.map((r) => (
//                 <option key={r} value={r}>{r}</option>
//               ))}
//             </select>
//           </div>

//           <div>
//             <label className="block text-sm mb-1">Secret key</label>
//             <input
//               type="password"
//               className="w-full border rounded px-3 py-2"
//               name="secret_key"
//               value={signup.secret_key}
//               onChange={onChangeSignup}
//               placeholder="Enter org secret"
//               required
//             />
//             <p className="text-xs text-gray-500 mt-1">
//               Ask the administrator for the secret key to create an account.
//             </p>
//           </div>

//           <button
//             type="submit"
//             className="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
//           >
//             Create account
//           </button>

//           <p className="text-sm text-center mt-2">
//             Already signed up?{" "}
//             <button type="button" onClick={() => setMode("login")} className="text-indigo-600 underline">
//               Log in
//             </button>
//           </p>
//         </form>
//       ) : (
//         <form onSubmit={doLogin} className="space-y-4">
//           <div>
//             <label className="block text-sm mb-1">Employee ID</label>
//             <input
//               className="w-full border rounded px-3 py-2"
//               name="emp_id"
//               value={login.emp_id}
//               onChange={onChangeLogin}
//               placeholder="EMP00123"
//               required
//             />
//           </div>

//           <div>
//             <label className="block text-sm mb-1">Password</label>
//             <input
//               type="password"
//               className="w-full border rounded px-3 py-2"
//               name="password"
//               value={login.password}
//               onChange={onChangeLogin}
//               required
//             />
//           </div>

//           <button
//             type="submit"
//             className="w-full bg-gray-900 text-white px-4 py-2 rounded hover:bg-black"
//           >
//             Log in
//           </button>

//           <p className="text-sm text-center mt-2">
//             New user?{" "}
//             <button type="button" onClick={() => setMode("signup")} className="text-indigo-600 underline">
//               Create an account
//             </button>
//           </p>
//         </form>
//       )}

//       {status && (
//         <p className={`mt-4 text-sm ${status.ok ? "text-green-600" : "text-red-600"}`}>
//           {status.msg}
//         </p>
//       )}
//     </div>
//   );
// }
