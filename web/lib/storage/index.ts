import { googleDriveAdapter } from "./drive";
import { localStorageAdapter } from "./local";
import type { StorageAdapter } from "./types";

const driveConfigured = Boolean(
  (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE) &&
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
);

export const storage: StorageAdapter = driveConfigured
  ? googleDriveAdapter
  : localStorageAdapter;

export const storageBackend: "google-drive" | "local" = driveConfigured
  ? "google-drive"
  : "local";

export type { StorageAdapter, StoredFile } from "./types";
