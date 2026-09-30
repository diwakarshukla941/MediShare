# MediShare

A MERN app for doctors/clinics to upload patient-education videos and get a shareable public watch link — no login needed to upload or watch. A separate, authenticated admin dashboard manages everything (videos, analytics, settings), plus a **hidden Frame Studio** where a branded frame is designed and burned into every video via FFmpeg.

## Contents
- [Full frontend/backend handoff documentation](docs/PROJECT_DOCUMENTATION.md)
- [Stack](#stack)
- [Project layout](#project-layout)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Public routes (no login)](#public-routes-no-login)
- [Admin dashboard (login required)](#admin-dashboard-login-required)
- [⚠️ The hidden Frame Studio](#️-the-hidden-frame-studio)
- [How video rendering works](#how-video-rendering-works)
- [Bulk upload CSV format](#bulk-upload-csv-format)
- [API reference](#api-reference)
- [Environments (dev / staging / production)](#environments-dev--staging--production)
- [Deployment notes](#deployment-notes)

---

## Stack
- **Client**: React 19 + Vite + Tailwind CSS + React Router + Axios + Recharts (analytics charts) + Konva/react-konva (Frame Designer canvas)
- **Server**: Express + Mongoose (MongoDB) + JWT auth + Multer (uploads) + Cloudflare R2 (video/image storage) + FFmpeg (`ffmpeg-static` + `fluent-ffmpeg`) + `p-queue` (background render queue)

## Project layout
```
medishare/
  client/   React app — public upload page, watch page, admin dashboard, Frame Studio
  server/   Express API — auth, video CRUD, bulk CSV upload, analytics, frames, rendering
```

## Setup


1. Install dependencies (root, npm workspaces):
   ```
   npm install
   ```

2. Configure `server/.env` — see `server/.env.example` for the full list. You need a MongoDB connection string and Cloudflare R2 credentials at minimum.
3. To migrate existing frame background/logo images from ImageKit, set `IMAGEKIT_URL_ENDPOINT` temporarily and run `npm run migrate:frame-assets:r2` for a dry run, then `npm run migrate:frame-assets:r2 -- --apply` to copy the files and update MongoDB. The migration leaves the ImageKit originals in place.

4. Create the admin account (reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `server/.env`):
   ```
   npm run seed
   ```

5. Start both the API and the client together:
   ```
   npm run dev
   ```
   - API: http://localhost:5000
   - Client: http://localhost:5173

## Environment variables

All in `server/.env` (see `server/.env.example`):

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 5000) |
| `NODE_ENV` | `development` or `production` |
| `CLIENT_URL` | The client's origin — used for CORS. **Must be set to your production frontend URL when deployed.** |
| `MONGODB_URI` | MongoDB connection string (Atlas or self-hosted) |
| `JWT_SECRET` | Long random string signing admin session tokens. **Rotate this before going to production** — a leaked/default secret lets anyone forge an admin login. |
| `JWT_EXPIRES_IN` | Admin session lifetime (default `7d`) |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used only by `npm run seed` to create/update the single admin account |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_ACCESS_KEY_ID` / `CLOUDFLARE_SECRET_ACCESS_KEY` | Cloudflare R2 S3-compatible credentials |
| `CLOUDFLARE_BUCKET_NAME` / `CLOUDFLARE_PUBLIC_DOMAIN` | R2 bucket and public CDN/custom-domain base URL |
| `CLOUDFLARE_FOLDER_PREFIX` | Object prefix; defaults to `bonconnect` |

There is only **one admin account** for the whole app — whoever has that login sees the full dashboard (My Videos, Upload, Bulk Upload, Analytics, Settings). There's no per-client account separation.

---

## Public routes (no login)

| Route | What it does |
|---|---|
| `/upload` | Public upload form — doctor name, degree, specialization, title. No frame-related fields; the active frame (if any) is applied automatically after upload. |
| `/watch/:slug` | Public watch page. `:slug` is a random 10-character ID (via `nanoid`), never a raw database ID. Shows the video live inside the active frame (HTML overlay), with Share and Download buttons. Play/pause/fullscreen/volume/speed are the browser's native video controls. |

Both are rate-limited server-side (10 uploads / 15 min per IP on `/upload`) since they require no authentication.

## Admin dashboard (login required)

Reached via `/login`, then `/dashboard/*`. Sidebar sections:

- **Dashboard** — overview stat cards (total videos, views, shares, storage used) and a recent-videos table.
- **My Videos** — full list with search, per-row Watch / Copy Link / Share / **Download** (framed MP4) / Edit / Delete. Rows show a live "Processing… NN%" or "Render failed" badge while a background render is in flight.
- **Upload Video** — single video upload with doctor name, degree, specialization, designation, organization name, title, description, phone. No frame picker — whichever frame is currently active gets applied automatically once the video finishes uploading.
- **Bulk Upload** — multiple video files + a CSV of matching metadata (see [Bulk upload CSV format](#bulk-upload-csv-format)). Same auto-frame behavior as single upload.
- **Analytics** — real (not mocked) tracking: views over time, unique viewers, average/total watch time, device breakdown, share rate, top-performing videos, all backed by an `AnalyticsEvent` collection. Date range selectable (7/30/90 days). Location/geo tracking is deliberately **not** implemented (would require sending viewer IPs to a third-party geolocation service — a privacy decision left to you).
- **Settings** — change the admin password.

---

## ⚠️ The hidden Frame Studio

**URL:** `/dashboard/frame-studio-1845fd3e26ad`

This is deliberately **not** linked anywhere in the dashboard sidebar or UI — it's where you (the owner) design the branded video frame, kept separate from what a client using the dashboard sees. Only someone who knows/bookmarks this exact URL can reach it.

**Important — this is obscurity, not access control:**
- It's still behind the same login as the rest of the dashboard. Anyone who has the admin email/password can reach it if they know or find the URL — there's no separate permission system.
- The route string is compiled into the client's JavaScript bundle regardless of whether it's linked in the UI. A technically curious person who opens browser DevTools → Sources and searches the bundle would find it. It stops casual discovery, not a determined technical user.
- If you ever need this to be *actually* locked down (not just hidden), that requires a server-side gate — e.g. a secret key the Frame Studio's API calls must include — which is not currently implemented. Ask if you want that added before handing off access to anyone you don't fully trust.

**What's there:**
- **Frames list** (`/dashboard/frame-studio-1845fd3e26ad`) — every saved frame template as a card (live-rendered thumbnail, aspect ratio, "used in N videos", Active badge). Actions: Edit, Duplicate, Preview, Delete, **Activate**.
- **Frame Designer** (`/dashboard/frame-studio-1845fd3e26ad/new` or `/…/:frameId`) — a Canva/Figma-style editor (built on Konva):
  - **Elements** panel — add Text, Image, **Video Area** (defines exactly where the doctor's video plays), Rectangle, Circle, Line.
  - **Dynamic Fields** panel — drag `{{doctorName}}`, `{{degree}}`, `{{specialization}}`, `{{designation}}`, `{{title}}`, `{{description}}`, or `{{organizationName}}` straight onto the canvas; each becomes a text element that auto-fills from the actual video being rendered.
  - **Uploads** — upload your own background image or a logo/graphic (PNG/JPG/WEBP/SVG).
  - **Layers** panel — select, hide, lock, delete, drag-reorder.
  - Selecting an element opens a **Properties** panel on the right (position/size/rotation/opacity plus type-specific fields: font, color, border, padding, fill, stroke, object-fit, etc.). With nothing selected, the right panel shows a **live preview** — pick any uploaded video from a dropdown and see it rendered inside the current frame design in real time.
  - Undo/redo, zoom, Save.
  - New frames start with a Video Area + a `{{doctorName}}` text field already placed, so you're never starting from a totally blank canvas.

**How activation works:** only one frame can be "Active" at a time. Clicking **Activate** on a frame in the list immediately applies it to the live watch-page preview for every video, and queues a background re-render of every existing video's downloadable MP4 against the new design. New uploads automatically queue for rendering the moment they're created, using whichever frame is currently active — nothing else in the dashboard exposes frame selection.

---

## How video rendering works

1. A video is uploaded (public page, dashboard, or bulk) → the **original** file is stored in Cloudflare R2 immediately, and the video record is created.
2. If an active frame exists, a render job is queued (`server/src/utils/renderQueue.js`, backed by `p-queue`, concurrency 2 — tune this if you deploy on a bigger box and want more parallel renders).
3. The job reads the frame's JSON (`server/src/models/Frame.js`), resolves `{{variables}}` against the video's fields, builds an SVG overlay (`server/src/utils/renderFrameSvg.js`) with a transparent "hole" exactly where the Video Area element is, and rasterizes it with `sharp`.
4. FFmpeg (`server/src/utils/composeFramedVideo.js`) scales/crops (or scales/pads, depending on the Video Area's `objectFit`) the original video into that hole's exact position, overlays the frame graphic on top, and outputs a new MP4.
5. The rendered MP4 uploads to Cloudflare R2; the video record is updated. If it fails, `renderingStatus: "failed"` with the error message.
6. The **watch page** always shows the live HTML overlay version (instant, no rendering needed) using whichever frame is currently active. **Download** serves the burned-in `renderedUrl` — a normal, playable-anywhere MP4 — falling back to rendering on-demand if it isn't ready yet.
7. Editing a video's text fields (name, degree, etc.) or activating a different frame automatically re-queues a render so the downloadable file stays in sync.

This needs a real FFmpeg binary at runtime — `ffmpeg-static` bundles one per-platform as an npm dependency, so no separate system install is required, including in most deployment environments (see [Deployment notes](#deployment-notes)).

## Bulk upload CSV format

Download the template from the Bulk Upload page ("Download Sample CSV"). Columns, matched to files by `fileName`:

```
fileName,doctorName,degree,specialization,designation,title,description,phone,organizationName
```

`fileName` must exactly match the name of one of the video files selected in the same upload.

## API reference

All routes are mounted under `/api`. Base URLs: `/api/auth`, `/api/videos`, `/api/analytics`, `/api/frames`.

**Public (no auth):**
- `POST /videos` — create video (public upload page uses this)
- `GET /videos/public/:slug`, `POST /videos/:id/share`, `POST /videos/:id/track-watch`, `POST /videos/:id/download`
- `GET /frames/active` — the currently active frame, for the watch page's live overlay
- `POST /auth/login`

**Admin (JWT required):**
- `GET/POST/PATCH/DELETE /videos`, `/videos/:id`, `/videos/bulk`, `/videos/sample-csv`, `/videos/stats`
- `GET /analytics?range=7|30|90`
- `GET/POST/PATCH/DELETE /frames`, `/frames/:id`, `/frames/:id/duplicate`, `/frames/:id/activate`, `/frames/assets` (image upload for the Designer)
- `GET /auth/me`, `POST /auth/change-password`

## Environments (dev / staging / production)

Three environments, same repo, kept fully separate at the data layer so nothing accidental crosses over:

| | Development | Staging | Production |
|---|---|---|---|
| Where | Your local machine (`npm run dev`) | Render, deployed from the `staging` branch | Render, deployed from the `main` branch |
| Purpose | Free experimentation | Safe testing of real changes before they go live | The real, stable app |
| MongoDB | Local `.env`, its own database name (e.g. `medishare_dev`) | Its own database name (e.g. `medishare_staging`) | Its own database name (e.g. `medishare_production`) |
| ImageKit | Same account, `IMAGEKIT_FOLDER_PREFIX=/medishare-dev` (or leave default) | Same account, `IMAGEKIT_FOLDER_PREFIX=/medishare-staging` | Same account, `IMAGEKIT_FOLDER_PREFIX=/medishare` |
| Client badge | — | Amber "STAGING" badge in the dashboard sidebar | No badge |

All three use the **same MongoDB Atlas cluster and the same ImageKit account** — only the database name and folder prefix differ per environment (both are just env var values, no separate accounts needed). `render.yaml` declares all four Render services (`medishare-api`/`medishare-client` on `main`, `medishare-api-staging`/`medishare-client-staging` on `staging`) in one blueprint.

**Branches — three, not two — and every promotion goes through a pull request, never a direct push:**
```
develop  →  (PR)  →  staging  →  (PR)  →  main
(work here)          (deploys to        (deploys to
                       staging)           production)
```
- `develop` — where day-to-day work happens. Never deployed anywhere directly.
- `staging` — only updated via a PR from `develop`. Auto-deploys to the two `-staging` Render services on merge.
- `main` — only updated via a PR from `staging`, once staging's been verified. Auto-deploys to production on merge.

Set this up as a hard rule, not just a habit: in the GitHub repo, go to **Settings → Branches → Add branch ruleset** (or "Add rule" on older GitHub UIs) for both `staging` and `main`, and require a pull request before merging (optionally require it to come from a specific branch, and disable direct pushes for repo admins too if you want it fully enforced). Without that setting, GitHub still allows a direct push to either branch — the workflow above is a convention until the ruleset is in place.

**Verifying which environment you're hitting:** `GET /api/health` on any deployed API echoes back `{ "environment": "staging" | "production" | "development" }` (set via the `APP_ENV` env var). The dashboard sidebar also shows a "STAGING"/"DEV" badge next to the logo whenever `VITE_APP_ENV` isn't `production`.

## Deployment notes

For step-by-step Cloudflare Pages + Workers/Containers + R2 deployment, see [Cloudflare deployment](docs/CLOUDFLARE_DEPLOYMENT.md).

**Architecture: frontend and API are separate hosted services from one repo.**
- `server/` → a persistent Node.js process or container. FFmpeg rendering starts a subprocess and writes temporary files to disk, so the API needs a runtime that supports normal Node.js processes and local temporary storage. Options include Render/Railway/Fly.io or Cloudflare Workers with Containers.
- `client/` → builds to static files (`npm run build` → `client/dist`) and is hosted as a static site.
- Both can use this GitHub repo with different build settings; no second repository is needed.

**The existing production blueprint targets Render.** A Cloudflare Pages + Workers/Containers deployment scaffold is also provided in `cloudflare/api` and documented in [Cloudflare deployment](docs/CLOUDFLARE_DEPLOYMENT.md).
- `render.yaml` at the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec) — connecting the repo via Render's "New Blueprint" flow provisions both services (`medishare-api` web service, `medishare-client` static site) in one step, including the SPA rewrite rule the client needs (all routes → `index.html`, since it's client-side-routed with React Router).
- The blueprint intentionally leaves secrets blank (`sync: false`) — you fill those in Render's dashboard after the services are created, they're never written to the repo. `JWT_SECRET` is auto-generated by Render.
- Required secrets to fill in on `medishare-api`: `MONGODB_URI`, `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`, `IMAGEKIT_PUBLIC_KEY`/`IMAGEKIT_PRIVATE_KEY`/`IMAGEKIT_URL_ENDPOINT`, and `CLIENT_URL` (the static site's URL, once you know it).
- Required on `medishare-client`: `VITE_API_BASE_URL` = the API service's URL + `/api` (e.g. `https://medishare-api.onrender.com/api`).
- MongoDB Atlas → Network Access must allow connections from anywhere (`0.0.0.0/0`), since Render's free tier doesn't have a fixed outbound IP.
- After the first deploy, run the admin seed once against the production database — either via a Render Shell on the API service (`npm run seed`) or temporarily pointing local `server/.env`'s `MONGODB_URI` at the production database and running `npm run seed` locally.
- Free-tier web services spin down after 15 minutes idle and cold-start on the next request (~50s) — fine for testing, but background video rendering can't run while the service is asleep. Move to a paid instance type before relying on it for real traffic.
- `p-queue`'s concurrency (currently 2, in `server/src/utils/renderQueue.js`) caps how many videos render at once — raise it only if the instance has the CPU for it.
