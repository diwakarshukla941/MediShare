# MediShare - Frontend and Backend Handoff Documentation

## 1. Project overview

MediShare is a video-sharing platform for doctor and clinic patient-education
content. It has two user-facing surfaces:

1. A public upload and watch experience that does not require an account.
2. An authenticated admin dashboard for managing videos, analytics, branded
   frames, content templates, and team access.

The application is a monorepo:

```text
medishare/
├── client/   React/Vite frontend
├── server/   Express/Mongoose backend
├── render.yaml
└── package.json
```

### Technology stack

| Area | Technology | Responsibility |
|---|---|---|
| Frontend | React 19, Vite | SPA and UI rendering |
| Routing | React Router | Public, dashboard, and editor routes |
| Styling | Tailwind CSS | Responsive layout and visual styling |
| HTTP | Axios | API calls and JWT injection |
| Charts | Recharts | Analytics visualizations |
| Frame editor | Konva/react-konva | Canvas-based frame design |
| Backend | Node.js, Express | HTTP API and middleware |
| Database | MongoDB, Mongoose | Admins, videos, frames, templates, analytics |
| Authentication | JWT, bcryptjs | Token sessions and password hashing |
| File uploads | Multer | Multipart video, spreadsheet, and image uploads |
| Storage/CDN | ImageKit | Videos, rendered videos, thumbnails, frame assets |
| Video processing | FFmpeg, sharp | Burned-in frame rendering |
| Validation | Zod | Request validation at the API boundary |

## 2. Local development

### Prerequisites

- Node.js and npm
- MongoDB connection (local MongoDB or MongoDB Atlas)
- ImageKit account and API credentials

### Install and run

From the repository root:

```bash
npm install
```

Create `server/.env` from `server/.env.example` and set at least
`MONGODB_URI`, `JWT_SECRET`, and the ImageKit variables. Then create the first
admin account:

```bash
npm run seed
npm run dev
```

The development services are:

| Service | URL |
|---|---|
| Client | `http://localhost:5173` |
| API | `http://localhost:5000` |
| API health check | `http://localhost:5000/api/health` |

Useful root scripts:

```bash
npm run dev      # client and server concurrently
npm run build    # client production build
npm run lint     # client ESLint
npm run seed     # seed/update the server admin account
```

### Environment variables

#### Backend (`server/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | API port, normally `5000` |
| `NODE_ENV` | `development`, `test`, or `production` |
| `APP_ENV` | Display/health environment name |
| `CLIENT_URL` | Allowed frontend origin for CORS |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs |
| `JWT_EXPIRES_IN` | Token lifetime, normally `7d` |
| `ADMIN_NAME` | Seed administrator name |
| `ADMIN_EMAIL` | Seed administrator email |
| `ADMIN_PASSWORD` | Seed administrator password |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public key |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private key |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit CDN endpoint |
| `IMAGEKIT_FOLDER_PREFIX` | Per-environment storage folder |

#### Frontend (`client/.env`)

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | API base URL, including `/api`; defaults to `/api` locally |
| `VITE_APP_ENV` | Sidebar environment badge (`DEV` or `STAGING`) |

Never commit `.env` files or private ImageKit/JWT credentials.

## 3. Frontend documentation

### Application bootstrap

The frontend starts in [main.jsx](C:/Users/diwak/Desktop/medishare/client/src/main.jsx).
The root tree is:

```text
StrictMode
└── BrowserRouter
    └── AuthProvider
        └── App
```

- `BrowserRouter` enables client-side routes.
- `AuthProvider` restores `medishare_token` and `medishare_admin` from
  `localStorage`, then verifies the token through `GET /api/auth/me`.
- `App` defines all route-level access rules.
- `Toaster` provides global success/error notifications.

API behavior is centralized in [api.js](C:/Users/diwak/Desktop/medishare/client/src/lib/api.js).
It uses `VITE_API_BASE_URL`, adds `Authorization: Bearer <token>`, and redirects
dashboard users to `/login` after a `401` response.

### Public UI routes

| Browser route | UI source | What the user sees | API dependencies |
|---|---|---|---|
| `/` | [App.jsx](C:/Users/diwak/Desktop/medishare/client/src/App.jsx) | Redirects to `/upload` | None |
| `/upload` | [PublicUpload.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/PublicUpload.jsx) | Public doctor/video upload form | `POST /api/videos` |
| `/watch/:slug` | [WatchVideo.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/WatchVideo.jsx) | Public video player, branded frame overlay, share and download actions | `GET /api/videos/public/:slug`, `GET /api/frames/active`, share/watch/download endpoints |
| `/login` | [Login.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/Login.jsx) | Admin email/password login | `POST /api/auth/login` |
| `*` | [NotFound.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/NotFound.jsx) | Fallback not-found page | None |

The public watch link uses a random video slug rather than exposing a MongoDB
document ID. Public uploads are rate-limited by the API.

### Authenticated dashboard routes

All dashboard routes are nested under [DashboardLayout.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/DashboardLayout.jsx),
which supplies the responsive sidebar and content outlet. The sidebar is
implemented in [Sidebar.jsx](C:/Users/diwak/Desktop/medishare/client/src/components/dashboard/Sidebar.jsx);
the page title and signed-in user identity are rendered by
[Topbar.jsx](C:/Users/diwak/Desktop/medishare/client/src/components/dashboard/Topbar.jsx).

| Browser route | UI source | Main UI responsibilities | Permission |
|---|---|---|---|
| `/dashboard` | [Overview.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/Overview.jsx) | KPI cards and recent videos | Authenticated |
| `/dashboard/videos` | [MyVideos.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/MyVideos.jsx) | Search, watch, copy/share, download, edit, delete | `videos:view` |
| `/dashboard/upload` | [UploadSingle.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/UploadSingle.jsx) | Single video upload and metadata form | `videos:upload` |
| `/dashboard/bulk-upload` | [BulkUpload.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/BulkUpload.jsx) | Multiple video files plus CSV/Excel metadata upload | `videos:bulk_upload` |
| `/dashboard/analytics` | [Analytics.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/Analytics.jsx) | KPI trends, views over time, devices, locations, top videos | `analytics:view` |
| `/dashboard/settings` | [Settings.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/Settings.jsx) | Change current admin password | Authenticated |
| `/dashboard/team` | [Team.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/Team.jsx) | Manage administrators, roles, and permission overrides | `team:manage` |

### Frame Studio UI routes

Frame Studio intentionally uses an unlisted route, but it is still protected
by login and server-side permissions. It is not a security boundary by itself.

| Browser route | UI source | Purpose | Permission |
|---|---|---|---|
| `/dashboard/frame-studio-1845fd3e26ad` | [FramesList.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/frames/FramesList.jsx) | List, preview, duplicate, activate, edit, and delete frames | `frames:manage` |
| `/dashboard/frame-studio-1845fd3e26ad/new` | [FrameDesigner.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/frames/FrameDesigner.jsx) | Create a frame on a full-screen canvas | `frames:manage` |
| `/dashboard/frame-studio-1845fd3e26ad/:frameId` | [FrameDesigner.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/frames/FrameDesigner.jsx) | Edit an existing frame | `frames:manage` |
| `/dashboard/frame-studio-1845fd3e26ad/content-templates` | [ContentTemplates.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/frames/ContentTemplates.jsx) | Manage default and doctor-specific title/description templates | `content_templates:manage` |

The editor is composed of:

- [DesignerCanvas.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/frames/designer/DesignerCanvas.jsx):
  Konva canvas and element placement.
- [ElementsPanel.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/frames/designer/ElementsPanel.jsx):
  add text, image, video area, rectangle, circle, and line elements.
- [LayersPanel.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/frames/designer/LayersPanel.jsx):
  select, hide, lock, delete, and reorder layers.
- [PropertiesPanel.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/frames/designer/PropertiesPanel.jsx):
  edit geometry, typography, colors, opacity, borders, and object-fit.
- [PreviewPanel.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/frames/designer/PreviewPanel.jsx):
  preview a selected video inside the current design.
- [useFrameEditor.js](C:/Users/diwak/Desktop/medishare/client/src/pages/dashboard/frames/designer/useFrameEditor.js):
  editor state, undo/redo, persistence, and selection behavior.

Dynamic frame variables are defined in
[frameVariables.js](C:/Users/diwak/Desktop/medishare/client/src/lib/frameVariables.js).
They include `doctorName`, `degree`, `specialization`, `designation`, `title`,
`description`, and `organizationName`.

### Shared frontend components and utilities

| Source | Responsibility |
|---|---|
| [ProtectedRoute.jsx](C:/Users/diwak/Desktop/medishare/client/src/components/ProtectedRoute.jsx) | Redirects unauthenticated users to `/login` |
| [RequirePermission.jsx](C:/Users/diwak/Desktop/medishare/client/src/components/RequirePermission.jsx) | Blocks authenticated users without a permission |
| [VideoDropzone.jsx](C:/Users/diwak/Desktop/medishare/client/src/components/VideoDropzone.jsx) | Video file selection and drag/drop |
| [VideoTable.jsx](C:/Users/diwak/Desktop/medishare/client/src/components/VideoTable.jsx) | Reusable video list/table actions |
| [EditVideoModal.jsx](C:/Users/diwak/Desktop/medishare/client/src/components/EditVideoModal.jsx) | Edit video metadata |
| [FrameRenderer.jsx](C:/Users/diwak/Desktop/medishare/client/src/components/FrameRenderer.jsx) | Live frame overlay for watch/preview experiences |
| [VideoControls.jsx](C:/Users/diwak/Desktop/medishare/client/src/components/VideoControls.jsx) | Playback controls |
| [CopyLinkField.jsx](C:/Users/diwak/Desktop/medishare/client/src/components/CopyLinkField.jsx) | Copy/shareable public URL |
| [accessPermissions.js](C:/Users/diwak/Desktop/medishare/client/src/lib/accessPermissions.js) | Frontend permission checks |
| [parseSheet.js](C:/Users/diwak/Desktop/medishare/client/src/lib/parseSheet.js) | Bulk spreadsheet parsing |
| [downloadVideo.js](C:/Users/diwak/Desktop/medishare/client/src/lib/downloadVideo.js) | Download helper |

## 4. Backend documentation

### Server lifecycle and middleware

[server.js](C:/Users/diwak/Desktop/medishare/server/src/server.js) loads
environment variables, connects to MongoDB, creates the Express app, and starts
the listener. [app.js](C:/Users/diwak/Desktop/medishare/server/src/app.js)
configures:

1. Trusted proxy handling for hosted deployments.
2. Helmet security headers.
3. CORS with `CLIENT_URL` and credentials enabled.
4. JSON (`2mb`) and URL-encoded parsers.
5. Morgan request logging outside test mode.
6. `/api/health`.
7. Route modules and centralized 404/error handlers.

Authentication is implemented in
[auth.middleware.js](C:/Users/diwak/Desktop/medishare/server/src/middleware/auth.middleware.js):

- `requireAuth` requires a valid, non-expired Bearer JWT and an active admin.
- `optionalAuth` attaches an active admin when a token is present, but permits
  anonymous access for public upload.
- `requirePermission(key)` checks effective role/override permissions.
- `requireSuperAdmin` restricts irreversible frame operations.

### API conventions

- All API paths are prefixed with `/api`.
- Protected endpoints use `Authorization: Bearer <JWT>`.
- Multipart endpoints use Multer field names documented below.
- Validation errors and application errors flow through
  [error.middleware.js](C:/Users/diwak/Desktop/medishare/server/src/middleware/error.middleware.js).
- JSON response shapes are controller-owned; clients should use the returned
  `message`, `data`, or resource fields rather than relying on HTTP text.

### Route reference

#### Health and authentication

| Method and path | Access | Purpose | Request |
|---|---|---|---|
| `GET /api/health` | Public | Liveness check and environment name | None |
| `POST /api/auth/login` | Public, rate-limited | Validate credentials and issue JWT | JSON: `email`, `password` |
| `GET /api/auth/me` | JWT | Return current admin and effective permissions | None |
| `POST /api/auth/change-password` | JWT | Change current admin password | JSON: `currentPassword`, `newPassword` |

#### Videos

| Method and path | Access | Purpose | Request/notes |
|---|---|---|---|
| `POST /api/videos` | Public or optional JWT; upload rate-limited | Create one video | Multipart video plus doctor metadata |
| `GET /api/videos` | JWT + `videos:view` | List dashboard videos | Query: `page`, `limit`, `search`, and `ownership=all|mine`; `mine` restricts results to the authenticated admin's `uploadedBy` ID |
| `GET /api/videos/stats` | JWT + `videos:view` | Dashboard summary statistics | None |
| `GET /api/videos/sample-csv` | JWT + `videos:bulk_upload` | Download bulk-upload template | None |
| `POST /api/videos/bulk` | JWT + `videos:bulk_upload` | Create multiple videos | Multipart videos plus CSV/Excel sheet |
| `GET /api/videos/:id` | JWT + `videos:view` | Get one dashboard video | MongoDB video ID |
| `PATCH /api/videos/:id` | JWT + `videos:view` | Update metadata | JSON metadata fields |
| `DELETE /api/videos/:id` | JWT + `videos:view` | Delete a video and associated assets | MongoDB video ID |
| `GET /api/videos/public/:slug` | Public | Resolve a shareable watch link | Random video slug |
| `POST /api/videos/:id/share` | Public | Increment share count and record share event | MongoDB video ID |
| `POST /api/videos/:id/track-watch` | Public, rate-limited | Record watch duration/device/session | JSON watch tracking payload |
| `GET /api/videos/:id/download` | Public, rate-limited | Stream or redirect to a framed MP4 | MongoDB video ID; may render/cache on demand |

Single uploads are handled by `uploadSingleVideo`; bulk uploads are handled by
`uploadBulk`. The bulk metadata template is:

```csv
fileName,doctorName,degree,specialization,designation,title,description,phone,organizationName
```

`fileName` must exactly match one of the selected video filenames.

#### Analytics

| Method and path | Access | Purpose |
|---|---|---|
| `GET /api/analytics` | JWT + `analytics:view` | Return KPI totals, trends, daily views, device breakdown, top locations, and top videos |

Supported query values are `?range=7`, `?range=30`, and `?range=90`; invalid or
missing values default to 30 days. Analytics events are created by view, watch,
and share interactions.

#### Frames

| Method and path | Access | Purpose |
|---|---|---|
| `GET /api/frames/active` | Public | Return the active frame for the public watch overlay |
| `GET /api/frames` | JWT + `frames:manage` | List saved frames |
| `POST /api/frames` | JWT + `frames:manage` | Create a frame |
| `POST /api/frames/assets` | JWT + `frames:manage` | Upload a frame image/logo asset |
| `GET /api/frames/:id` | JWT + `frames:manage` | Get a frame |
| `PATCH /api/frames/:id` | JWT + `frames:manage` | Update frame JSON and metadata |
| `DELETE /api/frames/:id` | JWT + `frames:manage` | Delete a frame |
| `POST /api/frames/:id/duplicate` | JWT + `frames:manage` | Duplicate a frame |
| `POST /api/frames/:id/activate` | JWT + `frames:manage` | Make one frame active and queue affected renders |
| `GET /api/frames/videos/unbaked` | Super admin | List videos eligible for permanent rebaking |
| `POST /api/frames/:id/burn-existing` | Super admin | Permanently burn a frame into selected existing videos |

Frame assets are accepted through `uploadFrameImage`. Frame element structure is
validated by `frame.validator.js`; MongoDB stores the flexible `elements` array
as mixed values.

#### Content templates

| Method and path | Access | Purpose |
|---|---|---|
| `GET /api/content-templates` | JWT + `content_templates:manage` | List default and doctor-specific templates |
| `PUT /api/content-templates/default` | JWT + `content_templates:manage` | Upsert fallback template |
| `POST /api/content-templates/doctor` | JWT + `content_templates:manage` | Create doctor-specific template |
| `PATCH /api/content-templates/doctor/:id` | JWT + `content_templates:manage` | Update doctor-specific template |
| `DELETE /api/content-templates/doctor/:id` | JWT + `content_templates:manage` | Delete doctor-specific template |

On upload, the backend resolves a doctor-specific template by email and falls
back to the default template. The resolved title and description remain
editable video fields.

#### Team and roles

| Method and path | Access | Purpose |
|---|---|---|
| `GET /api/admins` | JWT + `team:manage` | List admin accounts |
| `POST /api/admins` | JWT + `team:manage` | Create one admin |
| `POST /api/admins/bulk` | JWT + `team:manage` | Create admins from a sheet |
| `GET /api/admins/sample-csv` | JWT + `team:manage` | Download admin import template |
| `PATCH /api/admins/:id` | JWT + `team:manage` | Update account, role, active state, and overrides |
| `DELETE /api/admins/:id` | JWT + `team:manage` | Delete an admin |
| `GET /api/roles/permissions` | JWT + `team:manage` | List assignable permission definitions |
| `GET /api/roles` | JWT + `team:manage` | List roles |
| `POST /api/roles` | JWT + `team:manage` | Create role |
| `PATCH /api/roles/:id` | JWT + `team:manage` | Update role permissions |
| `DELETE /api/roles/:id` | JWT + `team:manage` | Delete role |

### Permission model

Permission constants are defined in
[permissions.js](C:/Users/diwak/Desktop/medishare/server/src/constants/permissions.js):

| Permission | Capability |
|---|---|
| `videos:view` | View, search, edit, download, and delete videos |
| `videos:upload` | Upload one video |
| `videos:bulk_upload` | Upload multiple videos with a sheet |
| `analytics:view` | View analytics |
| `frames:manage` | Manage and activate Frame Studio designs |
| `content_templates:manage` | Manage title/description templates |
| `team:manage` | Manage admin accounts and roles |

`super_admin` bypasses normal permission checks. `frames:manage` and
`content_templates:manage` are marked super-admin-only for granting purposes.
Regular admin permissions are calculated from the assigned role plus
`permissionOverrides.add` and `permissionOverrides.remove`.

## 5. Data model

| Model | Important fields | Purpose |
|---|---|---|
| `Admin` | `name`, `email`, `passwordHash`, `role`, `roleId`, `permissionOverrides`, `isActive` | Dashboard identity and access |
| `Role` | `name`, `permissions`, `createdBy` | Reusable permission bundle |
| `Video` | doctor metadata, `videoUrl`, `thumbnailUrl`, `slug`, `views`, `shareCount`, `source`, render cache fields | Uploaded video and public-link record |
| `Frame` | `name`, `width`, `height`, `aspectRatio`, `background`, `elements`, `isActive` | Branded frame design JSON |
| `ContentTemplate` | `targetType`, `doctorEmail`, `title`, `description` | Default/doctor-specific metadata defaults |
| `AnalyticsEvent` | `video`, `eventType`, `sessionId`, `device`, `country`, `watchDuration` | View, watch, and share telemetry |

### Video rendering lifecycle

1. The original upload is stored in ImageKit and a `Video` record is created.
2. If an active frame exists, the backend queues a render through
   [burnQueue.js](C:/Users/diwak/Desktop/medishare/server/src/utils/burnQueue.js).
3. Frame variables are resolved against video metadata.
4. An SVG overlay is generated and rasterized with `sharp`.
5. FFmpeg places/scales the source video into the frame's Video Area and outputs
   an MP4.
6. The rendered asset is uploaded to ImageKit and cached on the video record.
7. The watch page uses a live browser overlay for fast display. Download uses a
   cached/rendered MP4 and can render on demand when necessary.

Updating video fields or activating/editing a frame invalidates affected cached
renders. `frameBakedId` identifies videos that were deliberately permanently
burned with a specific frame.

## 6. End-to-end user flows

### Public upload to share

1. User opens `/upload`.
2. [PublicUpload.jsx](C:/Users/diwak/Desktop/medishare/client/src/pages/PublicUpload.jsx)
   validates/selects a video and submits metadata.
3. `POST /api/videos` uploads the file to ImageKit and creates the record.
4. The UI receives a public slug/link.
5. Recipient opens `/watch/:slug`.
6. The watch page fetches the video and active frame, records views/watch time,
   and supports share/download.

### Admin single upload

1. Admin signs in at `/login`.
2. JWT is stored in local storage and attached by Axios.
3. Admin opens `/dashboard/upload`.
4. The same video API is called with optional authenticated context, recording
   the source as `dashboard` and uploader attribution.

### Bulk upload

1. Admin opens `/dashboard/bulk-upload`.
2. Admin downloads the sample sheet, selects matching videos, and submits both.
3. The client parses the sheet; the server validates file/row matching.
4. Each valid row becomes a video and enters the same frame/render workflow.

### Frame activation

1. An authorized user edits/saves a frame in Frame Studio.
2. `POST /api/frames/:id/activate` marks it as the only active frame.
3. Public watch overlays immediately use the new frame.
4. Existing downloadable outputs are re-rendered or invalidated as required.

## 7. Deployment and operations

`render.yaml` defines four Render services:

- `medishare-api` from `main`
- `medishare-client` from `main`
- `medishare-api-staging` from `staging`
- `medishare-client-staging` from `staging`

The client is a static SPA and rewrites all paths to `index.html`. The API must
run as a persistent Node web service because FFmpeg rendering uses subprocesses
and temporary disk files.

Keep environments isolated by using:

- Separate MongoDB database names.
- Separate `IMAGEKIT_FOLDER_PREFIX` values.
- Separate `APP_ENV`/`VITE_APP_ENV` values.
- Separate Render environment secrets.

Recommended promotion flow:

```text
develop -> pull request -> staging -> pull request -> main
```

After deployment, verify:

1. `GET /api/health` returns the expected environment.
2. The client can log in and load `/api/auth/me`.
3. A small upload reaches ImageKit.
4. A public watch link loads.
5. Download rendering completes.
6. Staging and production use different database and ImageKit prefixes.

## 8. Troubleshooting and ownership guide

| Symptom | First files to inspect |
|---|---|
| Login fails | `client/src/context/AuthContext.jsx`, `server/src/controllers/auth.controller.js`, `server/src/middleware/auth.middleware.js` |
| Dashboard redirects to login | `client/src/lib/api.js`, token in local storage, JWT secret/expiry |
| Sidebar item is missing | `client/src/components/dashboard/Sidebar.jsx`, permission constants, assigned role |
| Upload fails | `VideoDropzone.jsx`, `video.routes.js`, `upload.middleware.js`, `video.controller.js`, ImageKit env |
| Bulk rows do not match | `parseSheet.js`, `parseSheetFile.js`, bulk upload controller and sample CSV |
| Frame preview is wrong | `FrameRenderer.jsx`, Frame Studio designer panels, `renderFrameSvg.js` |
| Download is not ready | `burnQueue.js`, `composeFramedVideo.js`, FFmpeg/ImageKit configuration |
| Analytics are empty | `session.js`, video tracking routes, `AnalyticsEvent` model, analytics controller |
| Refreshing a client route returns 404 | Render SPA rewrite configuration in `render.yaml` |

## 9. Security and handoff notes

- The Frame Studio URL is unlisted, not secret. Real protection comes from JWT
  authentication and `frames:manage`.
- Public endpoints are intentionally unauthenticated but rate-limited.
- Passwords are stored as bcrypt hashes; never log or expose them.
- JWT secrets, ImageKit private keys, and MongoDB credentials must remain in
  deployment secrets.
- Use separate staging data before testing destructive actions such as frame
  reburning or bulk deletion.
