import ImageKit from "imagekit";

let client = null;

export function getImageKit() {
  if (client) return client;

  const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;

  if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
    throw new Error(
      "ImageKit is not configured. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT in server/.env"
    );
  }

  client = new ImageKit({
    publicKey: IMAGEKIT_PUBLIC_KEY,
    privateKey: IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: IMAGEKIT_URL_ENDPOINT,
  });

  return client;
}

// Keeps environments' uploads physically separate in the same ImageKit
// account (e.g. "/medishare-staging/videos" vs "/medishare/videos") so
// staging test uploads never mix with production files. Defaults to
// "/medishare" when unset, matching the original single-environment setup.
export function imagekitFolder(subfolder) {
  const prefix = (process.env.IMAGEKIT_FOLDER_PREFIX || "/medishare").replace(/\/+$/, "");
  return `${prefix}/${subfolder}`;
}
