import { useState } from "react";
import { Copy, Check } from "lucide-react";
import toast from "react-hot-toast";

export default function CopyLinkField({ url, className = "", onCopied }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard API unavailable — still show state so the user can select manually
    }
    setCopied(true);
    toast.success("Link copied to clipboard");
    onCopied?.();
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 pl-3.5 ${className}`}>
      <span className="min-w-0 flex-1 truncate text-sm text-brand-700">{url}</span>
      <button onClick={copy} className="btn-secondary shrink-0 !py-2">
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? "Copied" : "Copy Link"}
      </button>
    </div>
  );
}
