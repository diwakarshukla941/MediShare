import { Container } from "@cloudflare/containers";

export class MediShareApiContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
  enableInternet = true;

  envVars = {
    NODE_ENV: this.env.NODE_ENV,
    APP_ENV: this.env.APP_ENV,
    PORT: this.env.PORT,
    JWT_EXPIRES_IN: this.env.JWT_EXPIRES_IN,
    MONGODB_URI: this.env.MONGODB_URI,
    JWT_SECRET: this.env.JWT_SECRET,
    STORAGE_CONFIG_ENCRYPTION_KEY: this.env.STORAGE_CONFIG_ENCRYPTION_KEY,
    CLIENT_URL: this.env.CLIENT_URL,
    CLOUDFLARE_ACCOUNT_ID: this.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_ACCESS_KEY_ID: this.env.CLOUDFLARE_ACCESS_KEY_ID,
    CLOUDFLARE_SECRET_ACCESS_KEY: this.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    CLOUDFLARE_BUCKET_NAME: this.env.CLOUDFLARE_BUCKET_NAME,
    CLOUDFLARE_PUBLIC_DOMAIN: this.env.CLOUDFLARE_PUBLIC_DOMAIN,
    CLOUDFLARE_FOLDER_PREFIX: this.env.CLOUDFLARE_FOLDER_PREFIX,
  };
}
