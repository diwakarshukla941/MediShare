import { useEffect, useState, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Video,
  Eye,
  Share2,
  HardDrive,
  Users,
  Clock,
  PlayCircle,
  TrendingUp,
  Download,
  CalendarDays,
  TrendingDown,
} from "lucide-react";
import Topbar from "../../components/dashboard/Topbar.jsx";
import { api, formatBytes } from "../../lib/api.js";

const RANGE_OPTIONS = [
  { value: 7, label: "7 Days" },
  { value: 30, label: "30 Days" },
  { value: 90, label: "90 Days" },
];

const DEVICE_COLORS = { mobile: "#2563eb", desktop: "#22c55e", tablet: "#a855f7", other: "#f59e0b" };

function formatDuration(seconds) {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTotalDuration(seconds) {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDateLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function Trend({ value }) {
  if (value === 0) return <span className="text-xs font-medium text-slate-400">No change vs prior period</span>;
  const positive = value > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${positive ? "text-green-600" : "text-red-500"}`}>
      <Icon size={13} />
      {Math.abs(value)}% vs prior period
    </span>
  );
}

function KpiCard({ label, value, icon: Icon, iconClass, trend }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon size={20} />
        </span>
      </div>
      {trend !== undefined && (
        <div className="mt-3">
          <Trend value={trend} />
        </div>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-700">{formatDateLabel(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-slate-500">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-slate-800">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r) => {
    setLoading(true);
    const { data: res } = await api.get("/analytics", { params: { range: r } });
    setData(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const k = data?.kpis;

  return (
    <div>
      <Topbar title="Analytics" subtitle="Track your video performance and audience engagement." />

      <div className="px-4 py-6 sm:px-8">
        <div className="mb-5 flex justify-end">
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setRange(o.value)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                  range === o.value ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Videos"
            value={loading ? "—" : (k?.totalVideos ?? 0)}
            icon={Video}
            iconClass="bg-brand-100 text-brand-700"
            trend={loading ? undefined : k.trends.videos}
          />
          <KpiCard
            label="Total Views"
            value={loading ? "—" : (k?.totalViews ?? 0).toLocaleString()}
            icon={Eye}
            iconClass="bg-green-100 text-green-700"
            trend={loading ? undefined : k.trends.views}
          />
          <KpiCard
            label="Total Shares"
            value={loading ? "—" : (k?.totalShares ?? 0).toLocaleString()}
            icon={Share2}
            iconClass="bg-purple-100 text-purple-700"
            trend={loading ? undefined : k.trends.shares}
          />
          <KpiCard
            label="Storage Used"
            value={loading ? "—" : formatBytes(k?.storageUsed || 0)}
            icon={HardDrive}
            iconClass="bg-amber-100 text-amber-700"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-900">Views Over Time</h2>
            <div className="mt-4 h-72">
              {!loading && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.viewsOverTime}>
                    <defs>
                      <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} minTickGap={30} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="views" name="Views" stroke="#2563eb" fill="url(#viewsFill)" strokeWidth={2} />
                    <Area
                      type="monotone"
                      dataKey="uniqueViews"
                      name="Unique Views"
                      stroke="#93b4fd"
                      fill="none"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card flex flex-col p-6">
            <h2 className="text-sm font-semibold text-slate-900">Views by Device</h2>
            {!loading && data.deviceBreakdown.length > 0 ? (
              <div className="mt-2 flex flex-1 items-center gap-5">
                <div className="relative h-36 w-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.deviceBreakdown}
                        dataKey="count"
                        nameKey="device"
                        innerRadius={44}
                        outerRadius={66}
                        paddingAngle={data.deviceBreakdown.length > 1 ? 3 : 0}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {data.deviceBreakdown.map((d) => (
                          <Cell key={d.device} fill={DEVICE_COLORS[d.device] || "#94a3b8"} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value} views`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-slate-900">{data.deviceBreakdown.reduce((s, d) => s + d.count, 0)}</span>
                    <span className="text-[10px] text-slate-400">views</span>
                  </div>
                </div>
                <ul className="min-w-0 flex-1 space-y-2.5">
                  {data.deviceBreakdown.map((d) => (
                    <li key={d.device} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 capitalize text-slate-600">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DEVICE_COLORS[d.device] || "#94a3b8" }} />
                        {d.device}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {d.pct}% <span className="text-slate-400">({d.count})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              !loading && (
                <div className="flex flex-1 items-center justify-center py-10 text-sm text-slate-400">No views yet</div>
              )
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Unique Viewers"
            value={loading ? "—" : (k?.uniqueViewers ?? 0).toLocaleString()}
            icon={Users}
            iconClass="bg-blue-100 text-blue-700"
          />
          <KpiCard
            label="Avg. Watch Time"
            value={loading ? "—" : formatDuration(k.avgWatchTime)}
            icon={Clock}
            iconClass="bg-purple-100 text-purple-700"
          />
          <KpiCard
            label="Total Watch Time"
            value={loading ? "—" : formatTotalDuration(k.totalWatchTime)}
            icon={PlayCircle}
            iconClass="bg-green-100 text-green-700"
          />
          <KpiCard
            label="Share Rate"
            value={loading ? "—" : `${k?.shareRate ?? 0}%`}
            icon={Share2}
            iconClass="bg-amber-100 text-amber-700"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card overflow-hidden lg:col-span-2">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Top Performing Videos</h2>
            </div>
            {!loading && data.topVideos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Video</th>
                      <th className="px-5 py-2.5 font-medium">Views</th>
                      <th className="px-5 py-2.5 font-medium">Unique</th>
                      <th className="px-5 py-2.5 font-medium">Avg. Watch</th>
                      <th className="px-5 py-2.5 font-medium">Shares</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topVideos.map((v) => (
                      <tr key={v._id} className="hover:bg-slate-50/60">
                        <td className="max-w-[220px] px-5 py-3">
                          <p className="truncate font-medium text-slate-900">{v.doctorName}</p>
                          <p className="truncate text-xs text-slate-500">
                            {v.phone ? ` · ${v.phone}` : ""}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{v.views}</td>
                        <td className="px-5 py-3 text-slate-600">{v.uniqueViews}</td>
                        <td className="px-5 py-3 text-slate-600">{formatDuration(v.avgWatchTime)}</td>
                        <td className="px-5 py-3 text-slate-600">{v.shares}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !loading && <p className="px-5 py-10 text-center text-sm text-slate-400">No videos yet</p>
            )}
          </div>

          <div className="card flex min-h-[260px] flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Audience Overview</h2>
                  <p className="mt-1 text-xs text-slate-500">Privacy-friendly analytics for your shared videos.</p>
                </div>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Privacy first</span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Unique viewers</span>
                    <span className="text-sm font-bold text-slate-900">{loading ? "—" : (k?.uniqueViewers ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-3/4 rounded-full bg-brand-500" />
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Average watch time</span>
                    <span className="text-sm font-bold text-slate-900">{loading ? "—" : formatDuration(k?.avgWatchTime)}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-1/2 rounded-full bg-violet-500" />
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-5 text-xs leading-5 text-slate-400">
              Location tracking is intentionally disabled. The dashboard reports views, devices, watch time and shares without storing viewer location.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
