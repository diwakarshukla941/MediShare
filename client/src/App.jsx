import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import PublicUpload from "./pages/PublicUpload.jsx";
import WatchVideo from "./pages/WatchVideo.jsx";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";

import DashboardLayout from "./pages/dashboard/DashboardLayout.jsx";
import Overview from "./pages/dashboard/Overview.jsx";
import MyVideos from "./pages/dashboard/MyVideos.jsx";
import UploadSingle from "./pages/dashboard/UploadSingle.jsx";
import BulkUpload from "./pages/dashboard/BulkUpload.jsx";
import FramesList from "./pages/dashboard/frames/FramesList.jsx";
import FrameDesigner from "./pages/dashboard/frames/FrameDesigner.jsx";
import Analytics from "./pages/dashboard/Analytics.jsx";
import Settings from "./pages/dashboard/Settings.jsx";

export default function App() {
  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/" element={<Navigate to="/upload" replace />} />
        <Route path="/upload" element={<PublicUpload />} />
        <Route path="/watch/:slug" element={<WatchVideo />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Overview />} />
          <Route path="videos" element={<MyVideos />} />
          <Route path="upload" element={<UploadSingle />} />
          <Route path="bulk-upload" element={<BulkUpload />} />
          {/* Unlisted on purpose — not in the sidebar. Bookmark this URL. */}
          <Route path="frame-studio-1845fd3e26ad" element={<FramesList />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Full-screen editor — deliberately outside DashboardLayout (no app sidebar) */}
        <Route
          path="/dashboard/frame-studio-1845fd3e26ad/new"
          element={
            <ProtectedRoute>
              <FrameDesigner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/frame-studio-1845fd3e26ad/:frameId"
          element={
            <ProtectedRoute>
              <FrameDesigner />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
