const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const CACHE_TTL_MS = 10 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 60 * 1000;

let cachedUsage = null;
let cacheExpiresAt = 0;
let pendingRequest = null;

const STORAGE_QUERY = `
  query R2StorageUsage($accountTag: string!, $startDate: Time, $endDate: Time, $bucketName: string) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        r2StorageAdaptiveGroups(
          limit: 1
          filter: {
            datetime_geq: $startDate
            datetime_leq: $endDate
            bucketName: $bucketName
          }
          orderBy: [datetime_DESC]
        ) {
          max {
            objectCount
            payloadSize
            metadataSize
          }
          dimensions {
            datetime
          }
        }
      }
    }
  }
`;

function unavailable(bucketName, reason) {
  return { available: false, bucketName, reason };
}

async function fetchR2StorageUsage(accountId, bucketName, apiToken) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: STORAGE_QUERY,
      variables: {
        accountTag: accountId,
        bucketName,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`Cloudflare analytics returned HTTP ${response.status}`);
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join("; "));

  const point = result.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups?.[0];
  if (!point) throw new Error("Cloudflare returned no R2 storage metrics for this bucket");

  return {
    available: true,
    bucketName,
    bytes: Number(point.max?.payloadSize || 0),
    objectCount: Number(point.max?.objectCount || 0),
    metadataBytes: Number(point.max?.metadataSize || 0),
    updatedAt: point.dimensions?.datetime || null,
  };
}

export async function getR2StorageUsage() {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const bucketName = String(process.env.CLOUDFLARE_BUCKET_NAME || "").trim();
  const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();

  if (!accountId || !bucketName || !apiToken) return unavailable(bucketName, "not_configured");
  if (cachedUsage && Date.now() < cacheExpiresAt) return cachedUsage;
  if (pendingRequest) return pendingRequest;

  pendingRequest = fetchR2StorageUsage(accountId, bucketName, apiToken)
    .then((usage) => {
      cachedUsage = usage;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return usage;
    })
    .catch((error) => {
      console.error("Could not fetch Cloudflare R2 storage metrics:", error.message);
      const usage = unavailable(bucketName, "unavailable");
      cachedUsage = usage;
      cacheExpiresAt = Date.now() + FAILURE_CACHE_TTL_MS;
      return usage;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}
