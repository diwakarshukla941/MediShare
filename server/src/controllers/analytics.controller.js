import { Video } from "../models/Video.js";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const ALLOWED_RANGES = new Set([7, 30, 90]);
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUTCDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseRange(query) {
  const days = ALLOWED_RANGES.has(Number(query.range)) ? Number(query.range) : 30;
  const end = new Date();
  const start = new Date(startOfUTCDay(end).getTime() - (days - 1) * DAY_MS);
  const prevStart = new Date(start.getTime() - days * DAY_MS);
  const prevEnd = new Date(start.getTime() - 1);
  return { days, start, end, prevStart, prevEnd };
}

function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

export const getAnalytics = asyncHandler(async (req, res) => {
  const { days, start, end, prevStart, prevEnd } = parseRange(req.query);
  const matchCurrent = { createdAt: { $gte: start, $lte: end } };
  const matchPrevious = { createdAt: { $gte: prevStart, $lte: prevEnd } };

  const [
    totalVideos,
    totalsAgg,
    currentViewCount,
    previousViewCount,
    currentVideoCount,
    previousVideoCount,
    currentShareCount,
    previousShareCount,
    uniqueViewersAgg,
    watchAgg,
    viewsByDay,
    deviceAgg,
    countryAgg,
    topVideosBase,
  ] = await Promise.all([
    Video.countDocuments(),
    Video.aggregate([
      { $group: { _id: null, views: { $sum: "$views" }, shares: { $sum: "$shareCount" }, storage: { $sum: "$fileSize" } } },
    ]),
    AnalyticsEvent.countDocuments({ eventType: "view", ...matchCurrent }),
    AnalyticsEvent.countDocuments({ eventType: "view", ...matchPrevious }),
    Video.countDocuments(matchCurrent),
    Video.countDocuments(matchPrevious),
    AnalyticsEvent.countDocuments({ eventType: "share", ...matchCurrent }),
    AnalyticsEvent.countDocuments({ eventType: "share", ...matchPrevious }),
    AnalyticsEvent.aggregate([
      { $match: { eventType: "view", sessionId: { $ne: "" }, ...matchCurrent } },
      { $group: { _id: "$sessionId" } },
      { $count: "count" },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { eventType: "watch", ...matchCurrent } },
      { $group: { _id: null, avg: { $avg: "$watchDuration" }, total: { $sum: "$watchDuration" } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { eventType: "view", ...matchCurrent } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          views: { $sum: 1 },
          sessions: { $addToSet: "$sessionId" },
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { eventType: "view", ...matchCurrent } },
      { $group: { _id: "$device", count: { $sum: 1 } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { eventType: "view", ...matchCurrent } },
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Video.find().sort({ views: -1 }).limit(8).select("doctorName email phone views shareCount slug thumbnailUrl"),
  ]);

  const topVideoIds = topVideosBase.map((v) => v._id);
  const [viewsPerVideo, watchPerVideo] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: { eventType: "view", video: { $in: topVideoIds }, ...matchCurrent } },
      { $group: { _id: "$video", uniqueSessions: { $addToSet: "$sessionId" }, views: { $sum: 1 } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { eventType: "watch", video: { $in: topVideoIds }, ...matchCurrent } },
      { $group: { _id: "$video", avgWatchTime: { $avg: "$watchDuration" } } },
    ]),
  ]);

  const viewsMap = new Map(viewsPerVideo.map((v) => [v._id.toString(), v]));
  const watchMap = new Map(watchPerVideo.map((v) => [v._id.toString(), v.avgWatchTime]));

  const topVideos = topVideosBase.map((v) => {
    const rangeStats = viewsMap.get(v._id.toString());
    return {
      _id: v._id,
      doctorName: v.doctorName,
      email: v.email,
      phone: v.phone,
      slug: v.slug,
      thumbnailUrl: v.thumbnailUrl,
      views: v.views,
      uniqueViews: rangeStats?.uniqueSessions?.filter(Boolean).length || 0,
      avgWatchTime: Math.round(watchMap.get(v._id.toString()) || 0),
      shares: v.shareCount,
    };
  });

  // Build a zero-filled daily series so the chart has no gaps
  const byDayMap = new Map(viewsByDay.map((d) => [d._id, d]));
  const viewsOverTime = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    const key = dateKey(d);
    const entry = byDayMap.get(key);
    viewsOverTime.push({
      date: key,
      views: entry?.views || 0,
      uniqueViews: entry?.sessions?.filter(Boolean).length || 0,
    });
  }

  const deviceTotal = deviceAgg.reduce((sum, d) => sum + d.count, 0);
  const deviceBreakdown = deviceAgg
    .map((d) => ({
      device: d._id || "other",
      count: d.count,
      pct: deviceTotal ? Math.round((d.count / deviceTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topLocations = countryAgg.map((c) => ({ country: c._id || "Unknown", count: c.count }));

  const totals = totalsAgg[0] || { views: 0, shares: 0, storage: 0 };
  const watch = watchAgg[0] || { avg: 0, total: 0 };
  const uniqueViewers = uniqueViewersAgg[0]?.count || 0;

  res.json({
    range: days,
    kpis: {
      totalVideos,
      totalViews: currentViewCount,
      totalShares: currentShareCount,
      storageUsed: totals.storage,
      uniqueViewers,
      avgWatchTime: Math.round(watch.avg || 0),
      totalWatchTime: Math.round(watch.total || 0),
      shareRate: currentViewCount ? Math.round((currentShareCount / currentViewCount) * 1000) / 10 : 0,
      trends: {
        views: pctChange(currentViewCount, previousViewCount),
        videos: pctChange(currentVideoCount, previousVideoCount),
        shares: pctChange(currentShareCount, previousShareCount),
      },
    },
    viewsOverTime,
    deviceBreakdown,
    topLocations,
    topVideos,
  });
});
