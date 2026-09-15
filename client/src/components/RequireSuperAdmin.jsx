import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RequireSuperAdmin({ children }) {
  const { admin } = useAuth();
  return admin?.role === "super_admin" ? children : <Navigate to="/dashboard" replace />;
}
