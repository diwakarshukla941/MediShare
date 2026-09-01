import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <Logo />
      <h1 className="text-lg font-semibold text-slate-900">Page not found</h1>
      <Link to="/" className="text-sm font-semibold text-brand-700 hover:underline">
        Go home
      </Link>
    </div>
  );
}
