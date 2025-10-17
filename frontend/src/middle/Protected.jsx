// src/middle/Protected.jsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";

const API = "http://localhost:5000";

export default function Protected({ children }) {
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API}/api/auth/me`, { credentials: "include" });
        if (!alive) return;
        if (!res.ok) {
          setState({ loading: false, user: null });
          return;
        }
        const data = await res.json();
        setState({ loading: false, user: data });
      } catch {
        if (!alive) return;
        setState({ loading: false, user: null });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state.loading) return <div className="p-6">Checking session…</div>;
  if (!state.user) return <Navigate to="/login" replace />;

  return (
    <AuthContext.Provider value={state.user}>
      {children}
    </AuthContext.Provider>
  );
}
