import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RequirePermission from "./components/RequirePermission.jsx";
import RequireSuperAdmin from "./components/RequireSuperAdmin.jsx";

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
import ContentTemplates from "./pages/dashboard/frames/ContentTemplates.jsx";
import Analytics from "./pages/dashboard/Analytics.jsx";
import Settings from "./pages/dashboard/Settings.jsx";
import Team from "./pages/dashboard/Team.jsx";
import Zones from "./pages/dashboard/Zones.jsx";
import StorageSettings from "./pages/dashboard/StorageSettings.jsx";

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
          <Route
            path="videos"
            element={
              <RequirePermission permission="videos:view">
                <MyVideos />
              </RequirePermission>
            }
          />
          <Route
            path="upload"
            element={
              <RequirePermission permission="videos:upload">
                <UploadSingle />
              </RequirePermission>
            }
          />
          <Route
            path="bulk-upload"
            element={
              <RequireSuperAdmin>
                <BulkUpload />
              </RequireSuperAdmin>
            }
          />
          {/* Unlisted URL for non-super-admins; only super_admin grants this permission to anyone */}
          <Route
            path="frame-studio-1845fd3e26ad"
            element={
              <RequirePermission permission="frames:manage">
                <FramesList />
              </RequirePermission>
            }
          />
          <Route
            path="analytics"
            element={
              <RequirePermission permission="analytics:view">
                <Analytics />
              </RequirePermission>
            }
          />
          <Route path="settings" element={<Settings />} />
          <Route path="zones" element={<RequireSuperAdmin><Zones /></RequireSuperAdmin>} />
          <Route path="storage" element={<RequireSuperAdmin><StorageSettings /></RequireSuperAdmin>} />
          <Route
            path="team"
            element={
              <RequirePermission permission="team:manage">
                <Team />
              </RequirePermission>
            }
          />
        </Route>

        {/* Full-screen editor — deliberately outside DashboardLayout (no app sidebar) */}
        <Route
          path="/dashboard/frame-studio-1845fd3e26ad/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission="frames:manage">
                <FrameDesigner />
              </RequirePermission>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/frame-studio-1845fd3e26ad/content-templates"
          element={
            <ProtectedRoute>
              <RequirePermission permission="content_templates:manage">
                <ContentTemplates />
              </RequirePermission>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/frame-studio-1845fd3e26ad/:frameId"
          element={
            <ProtectedRoute>
              <RequirePermission permission="frames:manage">
                <FrameDesigner />
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
