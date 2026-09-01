export default function StatCard({ label, value, sub, icon: Icon, iconClass = "bg-brand-100 text-brand-700" }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        {Icon && (
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
            <Icon size={20} />
          </span>
        )}
      </div>
      {sub && <p className="mt-3 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
