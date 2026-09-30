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

## Upload size note

Cloudflare's standard Free and Pro plans allow request bodies up to 100 MB. MediShare accepts individual videos up to 500 MB and its current upload forms send files through the API. A single 50 MB upload fits under the standard request limit, but large bulk-upload requests can exceed it. To preserve the 500 MB limit and support large bulk uploads reliably, the upload flow needs a direct-to-R2 multipart upload path before relying on this Cloudflare API gateway for production uploads. See [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/).

## 1. Create or confirm Cloudflare resources

1. Enable the Workers Paid plan for the Cloudflare account that will host the API Container.
2. Create an R2 bucket and an R2 API token with read/write access to that bucket. Add a public custom domain to the bucket for playback URLs.
3. Keep the existing MongoDB Atlas cluster, but use a production database name. Add network access for the Cloudflare Container's outbound connections as required by your Atlas configuration.
4. Keep your current data until the Cloudflare deployment is verified. This setup uses the same MongoDB and R2 data, so it does not require a data migration.

## 2. Configure and deploy the API Container without local Docker

The Worker gateway is in `cloudflare/api`; the container image is built from `Dockerfile.cloudflare` at the repository root. Use Cloudflare Workers Builds to build and deploy it from GitHub. The deployment scaffold must be committed and merged to the production branch before Cloudflare can build it.

1. In **Workers & Pages**, create a Worker by connecting the GitHub repository. Name the Worker `medishare-api` to match `cloudflare/api/wrangler.jsonc`.
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

- Test a single upload below 100 MB, playback from the R2 custom domain, login, and a framed download.
- The direct-to-R2 multipart upload flow is required before bulk uploads whose combined request exceeds 100 MB or any individual file above that limit.
- Monitor Cloudflare Container memory, CPU, and disk usage during rendering. Rendering time and idle container time affect the bill.
- If you already have an active production app, deploy to a separate staging Worker and Pages project first and verify with non-production data.
