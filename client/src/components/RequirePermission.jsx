import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { hasPermission } from "../lib/accessPermissions.js";

export default function RequirePermission({ permission, children }) {
  const { admin } = useAuth();
  if (!hasPermission(admin, permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
