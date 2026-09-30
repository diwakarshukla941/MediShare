# Deploy MediShare on Cloudflare

This repository now includes a Cloudflare deployment scaffold:

| Part | Cloudflare service |
| --- | --- |
| React website | Pages |
| Express API and FFmpeg | Workers + Containers |
| Video and image files | R2 |
| Application database | MongoDB Atlas |

The API runs in a Linux Container because the current Node API uses FFmpeg, Sharp, temporary files, and background processing. Cloudflare Containers are available on the Workers Paid plan, which starts at $5/month plus usage. R2 egress is free; storage and operations are billed separately. See [Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/) and [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

At 20,000 videos averaging 50 MB, the stored source files total about 1 TB. R2 Standard storage is approximately $14.85/month for one copy after the 10 GB free allowance, or about $29.85/month if each has both an original and a separate rendered copy. As a rough processing example, 20,000 renders taking one minute each add about $23 in Container compute on the configured 4 GiB / 0.5 vCPU instance, before considering idle time or other API usage.

## Video uploads and rendering

The single, public, and bulk upload pages send each video directly from the browser to R2 using a short-lived signed `PUT` URL. Video bytes do not pass through the Worker or Container. The API receives metadata only, verifies the uploaded object's size, type, and signed upload marker, then stores the R2 source key in MongoDB. Files are limited to 500 MB. The Container renders the active frame as a background job and stores that final video separately; the original remains in R2 for retries and future re-renders. Bulk exports snapshot completed videos and stream their final stored objects into a ZIP in R2.

R2's single-object `PUT` supports the current 500 MB limit. Multipart upload can be added later for resumable uploads or files larger than the current cap. See [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/) and [R2 upload limits](https://developers.cloudflare.com/r2/objects/upload-objects/).

## 1. Create or confirm Cloudflare resources

1. Enable the Workers Paid plan for the Cloudflare account that will host the API Container.
2. Create an R2 bucket and an R2 API token with read/write access to that bucket. Add a public custom domain to the bucket for playback URLs.
3. Create the Cloudflare Queue named `bonconnect-video-renders` before deploying the API's Wrangler config.
4. Keep the existing MongoDB Atlas cluster, but use a production database name. Add network access for the Cloudflare Container's outbound connections as required by your Atlas configuration.
5. Keep your current data until the Cloudflare deployment is verified. This setup uses the same MongoDB and R2 data, so it does not require a data migration.

### Configure direct browser uploads in R2

In the existing R2 bucket, open **Settings → CORS Policy** and add a rule allowing browser `PUT` uploads from the exact website origins. For production and local development, use a rule like:

```json
[
  {
    "AllowedOrigins": ["https://bonconnect.pages.dev", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type", "x-amz-meta-upload-intent"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add any custom Pages domain to `AllowedOrigins` exactly, including `https://`. The upload uses the R2 S3 API endpoint in the signed URL; the public R2 domain remains for playback. Completed uploads are promoted to the `sources/` prefix and retained for retries, edits, and re-rendering. You can add an R2 lifecycle rule to delete abandoned objects under `uploads/` after a few days; do not apply that rule to `sources/` or `videos/`.

## 2. Configure and deploy the API Container without local Docker

The Worker gateway is in `cloudflare/api`; the container image is built from `Dockerfile.cloudflare` at the repository root. Use Cloudflare Workers Builds to build and deploy it from GitHub. The deployment scaffold must be committed and merged to the production branch before Cloudflare can build it.

1. In **Workers & Pages**, create a Worker by connecting the GitHub repository. Name the Worker `bonconnect-api` to match `cloudflare/api/wrangler.jsonc`.
2. Set the production branch to `main` and the Workers Builds **Root directory** to `/` (repository root), so the build can access both the Wrangler config and `Dockerfile.cloudflare`.
3. Leave the Build command empty. Set the Deploy command to:

   ```text
   cd cloudflare/api && npm install && npx wrangler deploy
   ```

4. Save the settings and trigger a production deploy. Workers Builds runs the full `wrangler deploy`, which builds and publishes the Container image from Cloudflare's build environment. Do not use `wrangler versions upload` for production Container changes; it does not roll out a new image.
5. After the first deploy, open the Worker **Settings → Variables and Secrets** and add the secrets and variables below. Redeploy the Worker so its Container starts with those settings.

See [Cloudflare's Workers Builds deployment guide](https://developers.cloudflare.com/containers/guides/deploy/) and [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

Add these Worker secrets under **Settings → Variables and Secrets**:

```text
MONGODB_URI
JWT_SECRET
STORAGE_CONFIG_ENCRYPTION_KEY
CLOUDFLARE_ACCESS_KEY_ID
CLOUDFLARE_SECRET_ACCESS_KEY
```

Add these production variables:

```text
CLIENT_URL=https://bonconnect.pages.dev
CLOUDFLARE_ACCOUNT_ID=<Cloudflare account ID>
CLOUDFLARE_BUCKET_NAME=<existing R2 bucket name>
CLOUDFLARE_PUBLIC_DOMAIN=https://<existing R2 public domain>
CLOUDFLARE_FOLDER_PREFIX=<existing R2 folder prefix>
```

Use the same production MongoDB URI, JWT secret, and storage-config encryption key as the existing API. Keep secrets in Cloudflare's encrypted fields, not in `wrangler.jsonc` or Git.

The configured Container has 4 GiB memory and 8 GB ephemeral disk. Temporary render files are deleted after processing; video files remain in R2. Container disk is not durable storage.

### Create the render queue before deploying the API config

In **Workers & Pages → Queues**, create a queue named `bonconnect-video-renders`. The Wrangler config uses one concurrent consumer, retries failed renders five times, and routes exhausted messages to `bonconnect-video-renders-dlq` (Cloudflare creates the dead-letter queue as needed). MongoDB render leases make duplicate queue deliveries safe, and Cloudflare retains accepted messages until they are acknowledged. Keep consumer concurrency at one because FFmpeg renders use Container CPU and memory.

For storage hygiene, configure R2 to abort incomplete multipart uploads after several days. This affects abandoned archive uploads, not completed `sources/`, `videos/`, or `archives/` objects.

### Alternative: deploy from your PC with Docker

If you later install Docker Desktop, deploy directly from PowerShell instead:

```powershell
cd cloudflare/api
npm install
npx wrangler login
npx wrangler deploy
```

Open Workers & Pages in Cloudflare and add an API custom domain, for example `api.example.com`, to this Worker. Verify `https://api.example.com/api/health` returns `status: "ok"`.

## 3. Deploy the frontend to Pages

Create a Cloudflare Pages project connected to this repository and use:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `npm ci && npm run build -w client` |
| Build output directory | `client/dist` |
| `NODE_VERSION` | `22` |
| `VITE_API_BASE_URL` | `https://<API custom domain>/api` |
| `VITE_APP_ENV` | `production` |

Set the API Worker `CLIENT_URL` to the exact Pages site origin, including `https://` and any custom subdomain, then deploy the API again. The frontend embeds `VITE_API_BASE_URL` at build time, so redeploy Pages whenever that setting changes.

Cloudflare Pages serves React single-page routes such as `/login`, `/upload`, and `/watch/<slug>` with SPA fallback behavior. See [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/) and [SPA serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).

## 4. Seed the admin account

Use the production MongoDB connection and the admin credentials to run the existing seed script once from a trusted machine:

```powershell
$env:MONGODB_URI = '<production MongoDB URI>'
$env:ADMIN_NAME = '<admin name>'
$env:ADMIN_EMAIL = '<admin email>'
$env:ADMIN_PASSWORD = '<strong initial password>'
npm run seed -w server
```

After confirming login, remove those temporary environment values from the shell. Change the initial password from the dashboard.

## 5. Staging

Create a separate Worker and Pages project for staging. Use a separate MongoDB database, `APP_ENV=staging`, `VITE_APP_ENV=staging`, the staging Pages origin in `CLIENT_URL`, and an R2 prefix such as `medishare-staging`. Configure staging secrets separately; do not point staging at production data.

## 6. Deploy after setup

Build/deploy the Pages frontend from Git integration. Deploy API and Container changes from `cloudflare/api` with `npx wrangler deploy` while Docker is running, or configure Workers Builds to run that deploy command with the repository root available as the Docker build context. Keep Cloudflare Container deployments on the production branch because non-production Workers Builds may upload Worker code without rolling out a new Container image.

## Before using all upload flows

- Apply the R2 CORS rule, create the `bonconnect-video-renders` queue, and deploy the updated API and Pages projects.
- Verify a single upload, a public upload, a multi-file upload, frame rendering, playback, and a bulk ZIP download. The upload response can arrive while framing is still processing; during that interval, playback shows the original with a live frame overlay.
- Monitor Container memory, CPU, and disk usage during rendering. Queue concurrency is deliberately one; increase it only after measuring real render loads.
- If you already have an active production app, deploy to a separate staging Worker and Pages project first and verify with non-production data.
