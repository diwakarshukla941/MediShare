const cleanEnvValue = (name) => {
  const value = String(process.env[name] || "").trim();
  return /^(undefined|null)$/i.test(value) ? "" : value;
};

function envConfig() {
  return {
    provider: "r2",
    values: {
      r2: {
        accountId: cleanEnvValue("CLOUDFLARE_ACCOUNT_ID"),
        accessKeyId: cleanEnvValue("CLOUDFLARE_ACCESS_KEY_ID"),
        secretAccessKey: cleanEnvValue("CLOUDFLARE_SECRET_ACCESS_KEY"),
        bucket: cleanEnvValue("CLOUDFLARE_BUCKET_NAME"),
        publicBaseUrl: cleanEnvValue("CLOUDFLARE_PUBLIC_DOMAIN").replace(/\/$/, ""),
        folderPrefix: cleanEnvValue("CLOUDFLARE_FOLDER_PREFIX").replace(/^\/+|\/+$/g, ""),
      },
    },
    source: "environment",
  };
}

export async function getActiveStorageConfig() {
  return envConfig();
}

export function publicStorageConfig(config = envConfig()) {
  const values = config.values?.r2 || {};
  const has = (value) => Boolean(value && String(value).trim());
  return {
    provider: "r2",
    source: "environment",
    configured: {
      r2: [values.accountId, values.accessKeyId, values.secretAccessKey, values.bucket, values.publicBaseUrl, values.folderPrefix].every(has),
    },
  };
}
