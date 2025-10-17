// src/middle/RoleGate.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RoleGate({ allow = [], children }) {
  const user = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allow.length === 0) return children;
  return allow.includes(user.role) ? children : <Navigate to="/home" replace />;
}
